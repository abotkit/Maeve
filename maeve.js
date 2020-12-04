require('dotenv').config()
const express = require("express");
const app = express();
const {
  initDatabase,
  executeQuery,
  executeSelectQuery,
} = require("./db.js");
const cors = require("cors");
const fs = require("fs");
const axios = require("axios").default;
app.use(express.json());
app.use(cors());
const https = require('https');

const bunyan = require('bunyan');
const { env } = require('process');
const logger = bunyan.createLogger({name: 'maeve'});

logger.level(process.env.ABOTKIT_MAEVE_LOG_LEVEL || 'info');

const keycloak = {
  enabled: typeof process.env.ABOTKIT_MAEVE_USE_KEYCLOAK !== 'undefined' && process.env.ABOTKIT_MAEVE_USE_KEYCLOAK.toLowerCase() === 'true',
  realm: process.env.ABOTKIT_MAEVE_KEYCLOAK_REALM,
  url: `${process.env.ABOTKIT_MAEVE_KEYCLOAK_HOST}:${process.env.ABOTKIT_MAEVE_KEYCLOAK_PORT}`,
  client_id: process.env.ABOTKIT_MAEVE_KEYCLOAK_CLIENT
};

if (keycloak.enabled) {
  logger.info('USE KEYCLOAK WITH CONFIGURATION:');
  logger.info(keycloak);
} else {
  logger.info('KEYCLOAK DISABLED');
}

const MAEVE_ADMIN_ROLE = 'maeve-admin';

const hasAuthorizationHeader = req => {
  if (keycloak.enabled) {
    return typeof req.headers['authorization'] !== 'undefined' && req.headers['authorization'].split(' ')[0] === 'Bearer';
  } else {
    return false;
  }
}

const decodeToken = req => {
  const token = req.headers['authorization'].split(' ')[1];
  return JSON.parse( Buffer.from( token.split('.')[1], 'base64' ).toString() );   
}

const validateTokenIfExists = async (req, res, next) => {
  if (hasAuthorizationHeader(req)) {
    try {
      const { realm, url } = keycloak;
      const user = null;

      if (process.env.ABOTKIT_MAEVE_USE_SSL) {
        const agent = new https.Agent({  
          rejectUnauthorized: false
        });
        user = await axios.get(`${url}/auth/realms/${realm}/protocol/openid-connect/userinfo`, {
          headers: { 'Authorization': req.headers['authorization'], httpsAgent: agent }
        });
      } else {
        user = await axios.get(`${url}/auth/realms/${realm}/protocol/openid-connect/userinfo`, {
          headers: { 'Authorization': req.headers['authorization'] }
        });
      }

      const token = decodeToken(req);
      req.user = {
        ...user.data,
        roles: token.resource_access[keycloak.client_id].roles
      }
    } catch (error) {
      logger.error(error);
    } finally {
      next();
    }
  } else {
    next();
  }
}

const hasUserRole = (user, role) => {
  if (keycloak.enabled) {
    return typeof user !== 'undefined' && user.roles.includes(role);
  } else {
    return true;
  }
} 

app.use(validateTokenIfExists);

const getBotByName = async name => {
  const sql = "SELECT * FROM bots WHERE name=?";
  let response = null;
  try {
    response = await executeSelectQuery(sql, [name]);
  } catch (error) {
    return {
      bot: undefined,
      error: error,
      status: 500
    }
  }

  const bot = response[0];
  if (typeof bot === "undefined") {
    return {
      bot: undefined,
      error: "Bot not found.",
      status: 404
    }
  } else {
    return {
      bot: bot,
      error: null,
      status: 200
    }
  }
}

app.get('/', (req, res) => {
  res.status(200).send('"It’s A Difficult Thing, Realizing Your Entire Life Is Some Hideous Fiction." - Maeve Millay');
});

app.get('/alive', (req, res) => {
  res.status(200).end();
});

app.get('/bots', async (req, res) => {
  const sql = 'SELECT * FROM bots';
  try {
    const bots = await executeSelectQuery(sql);
    res.json(bots);
  } catch (error) {
    res.status(500).json({ error: error });
  }
});

app.post('/bot', async (req, res) => {
  if (!hasUserRole(req.user, MAEVE_ADMIN_ROLE)) {
    return res.status(401).end();
  }

  const { name, host, port } = req.body;

  if (typeof name === 'undefined' || typeof host === 'undefined' || typeof port === 'undefined' || typeof req.body.type === 'undefined') {
    return res.status(400).json({ error: 'you need to provide bot name, host, port and type'});
  }

  const sql = 'INSERT INTO bots (name, host, port, type) VALUES (?, ?, ?, ?)';
  const type = req.body.type.toLowerCase() === 'charlotte' ? 'charlotte' : 'robert';

  try {
    await executeQuery(sql, [name, host, port, type]);
  } catch (error) {
    res.status(500).json({ error: error });
  }

  res.status(200).end();
});

app.put('/bot', async (req, res) => {
  if (!hasUserRole(req.user, MAEVE_ADMIN_ROLE)) {
    return res.status(401).end();
  }

  let sql = 'UPDATE bots SET ';
  const params = []
  const { name, host, port } = req.body;

  if (typeof name === 'undefined') {
    return res.status(400).json({ error: 'you need to provide a bot name'});
  }

  if (typeof host !== 'undefined') {
    sql += 'host = ?';
    params.push(host);
  }
  
  if (typeof port !== 'undefined') {
    sql += typeof host !== 'undefined' ? ', port = ?' : 'port = ?';
    params.push(port);
  }

  if (params.length === 0) {
    return res.status(200).end();
  }

  sql += ' WHERE name = ?';
  params.push(name);
  
  try {
    await executeQuery(sql, params);
  } catch (error) {
    res.status(500).json({ error: error });
  }

  res.status(200).end();
});

app.delete('/bot', async (req, res) => {
  if (!hasUserRole(req.user, MAEVE_ADMIN_ROLE)) {
    return res.status(401).end();
  }

  if (typeof req.body.name === 'undefined') {
    return res.status(400).json({ error: 'you need to provide a bot name'});
  }

  try {
    await executeQuery('DELETE FROM bots WHERE name=?', [req.body.name]);
  } catch (error) {
    res.status(500).json({ error: error });
  }

  res.status(200).end();  
});

app.get("/bot/:name/status", async (req, res) => {
  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.get(`${bot.host}:${bot.port}/`);
    res.status(200).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/bot/:name/settings", async (req, res) => {
  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  } 

  let response;
  try {
    response = await axios.get(`${bot.host}:${bot.port}/language`);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!hasUserRole(req.user, `${req.params.name}-write`)) {
    res.json({ host: '', port: '', type: '', language: response.data });
  } else {
    res.json({ ...bot, language: response.data });
  }
});

app.get("/bot/:name/actions", async (req, res) => {
  if (!hasUserRole(req.user, `${req.params.name}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    const response = await axios.get(`${bot.host}:${bot.port}/actions`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/bot/:name/phrases", async (req, res) => {
  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    const response = await axios.get(`${bot.host}:${bot.port}/phrases`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/phrase", async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.delete(`${bot.host}:${bot.port}/phrases`, {
      data: {
        phrases: [{ intent: req.body.intent, text: req.body.phrase }],
      },
    });
    res.status(200).end();
  } catch (error) {
    res.status(500).json(error);
  }
});

app.post("/phrases", async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.post(`${bot.host}:${bot.port}/phrases`, {
      phrases: req.body.phrases.map((phrase) => ({
        text: phrase.text,
        intent: phrase.intent,
      })),
    });
  } catch (error) {
    return res.status(500).json(error);
  }

  res.status(200).end();
});

app.get("/bot/:name/intents", async (req, res) => {
  if (!hasUserRole(req.user, `${req.params.name}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    const response = await axios.get(`${bot.host}:${bot.port}/example`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/language', async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.post(`${bot.host}:${bot.port}/language`, {
      country_code: req.body.country_code
    });
  } catch (error) {
    return res.status(500).json(error);
  }

  res.status(200).end();  
});

app.post("/handle", async (req, res) => {
  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  } 

  let response;
  try {
    response = await axios.post(`${bot.host}:${bot.port}/handle`, {
      identifier: req.body.identifier, 
      query: req.body.query
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(response.data);
});

app.post("/explain", async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  } 

  let response;
  try {
    response = await axios.post(`${bot.host}:${bot.port}/explain`, {
      query: req.body.query
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(response.data);
});

app.get("/intent/:intent/bot/:name/examples", async (req, res) => {
  if (!hasUserRole(req.user, `${req.params.name}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    const response = await axios.get(`${bot.host}:${bot.port}/intent/examples/?intent=${encodeURIComponent(req.params.intent)}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/example', async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.post(`${bot.host}:${bot.port}/example`, {
      example: req.body.example,
      intent: req.body.intent
    });
  } catch (error) {
    return res.status(500).json(error);
  }

  res.status(200).end();
});

app.delete('/example', async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.delete(`${bot.host}:${bot.port}/example`, {
      data: { example: req.body.example, intent: req.body.intent }
    });
  } catch (error) {
    return res.status(500).json(error);
  }

  res.status(200).end();
});

app.post("/intent", async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.post(`${bot.host}:${bot.port}/actions`, {
      name: req.body.action,
      intent: req.body.intent,
      settings: {},
    });
  } catch (error) {
    console.warn(
      `Couldn't update core bot. Failed to push action to ${bot.host}:${bot.port}/actions ` +
      error
    );
  }

  if (typeof req.body.examples !== "undefined") {
    for (const example of req.body.examples) {
      try {
        await axios.post(`${bot.host}:${bot.port}/example`, {
          example: example,
          intent: req.body.intent,
        });
      } catch (error) {
        console.warn(
          `Couldn't update core bot. Failed to push examples to ${bot.host}:${bot.port}/example ` +
          error
        );
      }
    }
  }
  res.status(200).end();
});

const port = process.env.ABOTKIT_MAEVE_PORT || 3000;

if (typeof process.env.ABOTKIT_MAEVE_USE_SSL !== 'undefined' && process.env.ABOTKIT_MAEVE_USE_SSL.toLowerCase() === 'true') {
  const pem = require('pem');

  if (!fs.existsSync('./ssl/cert.pem') || !fs.existsSync('./ssl/cert.key')) {
    https.globalAgent.options.rejectUnauthorized = false;
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    pem.createCertificate({ selfSigned: true, days: 365, altNames: ['abotkit.io, www.abotkit.io']}, (error, keys) => {
      if (error) {
        logger.warn('self-signed cert generation failed. Start listening unencrypted instead')
        logger.warn(error)
        app.listen(port, async () => {
          await initDatabase();
          logger.info(`"It's Time You And I Had A Chat" - I'm listening unencrypted on port ${port}!`);
        });
      } else {
        https.createServer({ key: keys.serviceKey, cert: keys.certificate }, app).listen(port, async () => {
          await initDatabase();
          logger.info(`"It's Time You And I Had A Chat" - I'm listening ssl encrypted on port ${port}!`)
        });
      }
    });
  } else {
    const httpsOptions = {
      key: fs.readFileSync('./ssl/cert.key'),
      cert: fs.readFileSync('./ssl/cert.pem')
    }
    https.createServer(httpsOptions, app).listen(port, async () => {
      await initDatabase();
      logger.info(`"It's Time You And I Had A Chat" - I'm listening ssl encrypted on port ${port}!`)
    });
  }
} else {
  app.listen(port, async () => {
    await initDatabase();
    logger.info(`"It's Time You And I Had A Chat" - I'm listening unencrypted on port ${port}!`);
  });
}