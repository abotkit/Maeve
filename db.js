const sqlite3 = require("sqlite3").verbose();
const config = require("./config.json");
const bunyan = require('bunyan');
const logger = bunyan.createLogger({name: 'maeve'});

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
};

module.exports = {
  initDatabase: initDatabase,
  executeQuery: executeQuery,
  executeSelectQuery: executeSelectQuery,
};
