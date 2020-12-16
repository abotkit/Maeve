const sqlite3 = require("sqlite3").verbose();
const config = require("./config.json");
const bunyan = require('bunyan');
const logger = bunyan.createLogger({name: 'maeve'});
const fs = require('fs');

const db = new sqlite3.Database(config.DATABASE_PATH, async (error) => {
  if (error) {
    logger.error(error.message);
    throw error;
  } else {
    logger.info("Successfully connect to db.sqlite");
  }
});

const executeSelectQuery = (query, params) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
};

const executeQuery = (query, params) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

const initDatabase = async () => {
  await executeQuery(`CREATE TABLE IF NOT EXISTS bots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type TEXT NOT NULL)`);


  await executeQuery(`CREATE TABLE IF NOT EXISTS integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    url TEXT,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

  await executeQuery(`CREATE TABLE IF NOT EXISTS meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL)`);

  await executeQuery(`CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT NOT NULL,
    intent TEXT NOT NULL,
    bot TEXT NOT NULL,
    confidence TEXT NOT NULL,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

  const meta = await executeSelectQuery("SELECT value FROM meta WHERE name=?", ['INITIALIZED']);
  
  if (meta.length < 1) {
    if (typeof config['DEFAULT_BOTS'] !== 'undefined') {
      const bots = config['DEFAULT_BOTS'];
      logger.info(`Inserting ${bots.length} default bot(s) into the database.`);
      for (const bot of bots) {
        await executeQuery("INSERT INTO bots (name, host, port, type) VALUES (?, ?, ?, ?)", 
        [bot.name, bot.host, bot.port, bot.type.toLowerCase() === 'charlotte' ? 'charlotte' : 'robert']);
      }
    }
    await executeQuery("INSERT INTO meta (name, value) VALUES (?, ?)", ['INITIALIZED', 'true']);
  }
};

module.exports = {
  initDatabase: initDatabase,
  executeQuery: executeQuery,
  executeSelectQuery: executeSelectQuery,
};
