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

logger.level(env.ABOTKIT_MAEVE_LOG_LEVEL || 'info');

const keycloak = {
  enabled: typeof env.ABOTKIT_MAEVE_USE_KEYCLOAK !== 'undefined' && env.ABOTKIT_MAEVE_USE_KEYCLOAK.toLowerCase() === 'true',
  realm: env.ABOTKIT_MAEVE_KEYCLOAK_REALM,
  url: `${env.ABOTKIT_MAEVE_KEYCLOAK_HOST}:${env.ABOTKIT_MAEVE_KEYCLOAK_PORT}`,
  client_id: env.ABOTKIT_MAEVE_KEYCLOAK_CLIENT
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
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
}

const validateTokenIfExists = async (req, res, next) => {
  if (hasAuthorizationHeader(req)) {
    try {
      const { realm, url } = keycloak;
      let user = null;

      if (env.ABOTKIT_MAEVE_USE_SSL) {
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
      if (error.response) {
        logger.warn(error.response.data);
        logger.warn(error.response.status);
        logger.warn(error.response.headers);
      } else if (error.request) {
        logger.warn(error.request);
      } else {
        logger.error(error.message);
      }
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
    logger.error(error);
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

    const explanation = await axios.post(`${bot.host}:${bot.port}/explain`, {
      identifier: req.body.identifier,
      query: req.body.query
    });

    const sql = 'INSERT INTO history (query, intent, bot, confidence) VALUES (?, ?, ?, ?)';
    await executeQuery(sql, [req.body.query, explanation.data.intent, req.body.bot, explanation.data.score]);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(response.data);
});

app.get('/bot/:name/history/', async (req, res) => {
  if (!hasUserRole(req.user, `${req.params.name}-write`)) {
    return res.status(401).end();
  }

  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    const history = await executeSelectQuery('SELECT * FROM history WHERE bot=? ORDER BY created', [req.params.name]);
    res.json(history);
  } catch (error) {
    logger.error(error);
    res.status(500).json(error);
  }
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

app.post('/integration', async (req, res) => {
  if (!hasUserRole(req.user, MAEVE_ADMIN_ROLE)) {
    return res.status(401).end();
  }

  const sql = 'SELECT * FROM integrations WHERE name=?';
  const integration = await executeSelectQuery(sql, [req.body.name]);
  if (integration.length > 0) {
    if (integration[0].url !== req.body.url) {
      await executeQuery('UPDATE integrations SET url = ? WHERE id=?', [req.body.url, integration[0].id]);
      return res.status(204).json(`Upgraded url of ${req.body.name} to ${req.body.url}`)
    } else {
      return res.status(303).json(`${req.body.name} already reqgistered`);
    }
  }

  try {
      const sql = 'INSERT INTO integrations (name, url, bot) VALUES (?, ?, ?)';
      await executeQuery(sql, [req.body.name, req.body.url, req.body.bot]);
      res.status(200).end();
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: error });
  }
});

app.put('/integration', async (req, res) => {
  if (!hasUserRole(req.user, MAEVE_ADMIN_ROLE)) {
    return res.status(401).end();
  }

  const sql = 'SELECT * FROM integrations WHERE name=?';
  const integration = await executeSelectQuery(sql, [req.body.name]);
  
  if (integration.length > 0) {
    let updatedIntegration = { ...integration[0] };
    if (typeof req.body.name !== 'undefined') {
      updatedIntegration.name = req.body.name;
    }
    if (typeof req.body.url !== 'undefined') {
      updatedIntegration.url = req.body.url;
    }
    if (typeof req.body.bot !== 'undefined') {
      updatedIntegration.bot = req.body.bot;
    }
      
    await executeQuery('UPDATE integrations SET name = ?, url = ?, bot = ? WHERE id=?',
      [updatedIntegration.name, updatedIntegration.url, updatedIntegration.bot, updatedIntegration.id]);

    res.status(200).end();
  } else {
    logger.warn(error);
    res.status(404).json({ error: 'Could not update integration that does not exist.' });
  }
});

app.delete('/integration', async (req, res) => {
  if (!hasUserRole(req.user, MAEVE_ADMIN_ROLE)) {
    return res.status(401).end();
  }

  try {
    const sql = 'DELETE FROM integrations WHERE name=?';
    await executeQuery(sql, [req.body.name]);

    res.status(200).end();
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: error });
  }
});

app.get('/integrations', async (req, res) => {
  const bot = req.query.bot || '';
  let integrations = [];

  if (bot !== '') {
    try {
      integrations = await executeSelectQuery('SELECT name, url FROM integrations WHERE bot=? OR bot IS NULL', [bot]);
    } catch (error) {
      logger.error(error);
    }
  } else {
    try {
      integrations = await executeSelectQuery('SELECT name, url FROM integrations WHERE bot IS NULL');
    } catch (error) {
      logger.error(error);
    }   
  } 

  const response = [];

  for (const integration of integrations) {
    try {
      const CancelToken = axios.CancelToken;
      const source = CancelToken.source();
      const connectionTimeout = setTimeout(() => {
        source.cancel();
      }, 2000);

      const settings = (await axios.get(`${integration.url}/settings`, {
        cancelToken: source.token
      })).data;
      clearTimeout(connectionTimeout);
      integration.settings = settings;
      integration.url = undefined;
      response.push(integration);
    } catch (error) {
      logger.warn(integration);
      logger.warn(error);
      integration.settings = null;
    }
  }

  res.status(200).json(response);
});

app.get('/integration/:name/resource', async (req, res) => {
  const bot = req.query.bot || '';
  
  let result;
  try {
    result = await executeSelectQuery('SELECT url FROM integrations WHERE name=?', [req.params.name]);
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: error });
  }

  if (result.length === 0) {
    return res.status(404).json({ error: 'Could not found any matching integration' })
  }
  const integration = result[0];

  try {
    const response = await axios.get(`${integration.url}/resource`, { params: { bot: bot } });
    
    res.setHeader('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (error) {
    logger.error(error);
    return res.status(500).json(error);
  }
});

app.post('/integration/settings', async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  let result;
  try {
    result = await executeSelectQuery('SELECT url FROM integrations WHERE name=?', [req.body.name]);
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: error });
  }

  if (result.length === 0) {
    return res.status(404).json({ error: 'Could not found any matching integration' })
  }
  const integration = result[0];

  try {
    await axios.post(`${integration.url}/settings`, { data: req.body.data, bot: req.body.bot });
    res.status(200).end();
  } catch (error) {
    logger.error(error);
    return res.status(500).json(error);
  }
});

app.post('/integration/execute', async (req, res) => {
  if (!hasUserRole(req.user, `${req.body.bot}-write`)) {
    return res.status(401).end();
  }

  let result;
  try {
    result = await executeSelectQuery('SELECT url FROM integrations WHERE name=?', [req.body.name]);
  } catch (error) {
    logger.error(error);
    return res.status(500).json({ error: error });
  }

  if (result.length === 0) {
    return res.status(404).json({ error: 'Could not found any matching integration' })
  }
  const integration = result[0];

  try {
    const response = await axios.post(`${integration.url}/execute`, { data: req.body.data, bot: req.body.bot });
    res.json(response.data);
  } catch (error) {
    logger.error(error);
    return res.status(500).json(error);
  }
});

const port = env.ABOTKIT_MAEVE_PORT || 3000;

if (typeof env.ABOTKIT_MAEVE_USE_SSL !== 'undefined' && env.ABOTKIT_MAEVE_USE_SSL.toLowerCase() === 'true') {
  const pem = require('pem');

  if (!fs.existsSync('./ssl/cert.pem') || !fs.existsSync('./ssl/cert.key')) {
    https.globalAgent.options.rejectUnauthorized = false;
    env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
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
