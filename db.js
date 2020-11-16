const sqlite3 = require("sqlite3").verbose();
const config = require("./config.json");

const db = new sqlite3.Database(config.DATABASE_PATH, async (error) => {
  if (error) {
    console.error(error.message);
    throw error;
  } else {
    console.log("Successfully connect to db.sqlite");
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
    uuid TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    bot INTEGER NOT NULL,
    config TEXT,
    created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
};

module.exports = {
  initDatabase: initDatabase,
  executeQuery: executeQuery,
  executeSelectQuery: executeSelectQuery,
};
