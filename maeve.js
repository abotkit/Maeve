const express = require("express");
const app = express();
const {
  initDatabase,
  executeQuery,
  executeSelectQuery,
} = require("./db.js");
const cors = require("cors");
const { response } = require("express");
const axios = require("axios").default;
app.use(express.json());
app.use(cors());

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
  const { name, host, port } = req.body;
  const sql = 'INSERT INTO bots (name, host, port, type) VALUES (?, ?, ?, ?)';
  const type = req.body.type.toLowerCase() === 'charlotte' ? 'charlotte' : 'robert';
  try {
    await executeQuery(sql, [name, host, port, type]);
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

  res.json({ ...bot, language: response.data });
});

app.get("/bot/:name/actions", async (req, res) => {
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
  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.delete(`${bot.host}:${bot.port}/phrases`, {
      data: {
        phrases: [{ intent: req.body.intent, text: req.body.text }],
      },
    });
    res.status(200).end();
  } catch (error) {
    res.status(500).json(error);
  }
});

app.post("/phrases", async (req, res) => {
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
  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    const response = await axios.get(`${bot.host}:${bot.port}/example`);
    res.json([...new Set(Object.values(response.data))]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/language', async (req, res) => {
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
  const { bot, error, status } = await getBotByName(req.params.name);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    const response = await axios.get(`${bot.host}:${bot.port}/example/${req.params.intent}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/example', async (req, res) => {
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
  const { bot, error, status } = await getBotByName(req.body.bot);
  if (error) {
    return res.status(status).json({ error: error });
  }

  try {
    await axios.delete(`${bot.host}:${bot.port}/example`, {
      data: { example: req.body.example }
    });
  } catch (error) {
    return res.status(500).json(error);
  }

  res.status(200).end();
});

app.post("/intent", async (req, res) => {
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

app.listen(port, async () => {
  await initDatabase();
  console.log(`"It's Time You And I Had A Chat" - I'm listening on port ${port}!`);
});