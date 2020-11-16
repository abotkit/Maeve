const { executeQuery, executeSelectQuery } = require('./db.js');
const db = require('./db.js');
const uuid = require('uuid');

const revokeUrlWhitelisting = async (url) => {

}

const whitelistUrl = async (url) => {

}

const generateHtmlIntegrationLink = async (bot, uuid) => {
  return 'https://abotkit.io/integration/html?bot=' + bot + '&uuid=' + uuid;
}

const createIntegration = async (integration) => {
  const newIntegration = {
    bot: integration.bot,
    uuid: uuid.v4(),
    config: { ...integration.config },
    name: integration.name,
    type: integration.type
  };
  if (integration.type === 'html') {
    whitelistUrl(integration.config.url);
    newIntegration.config.link = await generateHtmlIntegrationLink(newIntegration.bot, newIntegration.uuid);
  }
  const insertQuery = 'INSERT INTO integrations (bot, type, name, uuid, config) VALUES (?, ?, ?, ?, ?)';
  await executeQuery(insertQuery, [newIntegration.bot, newIntegration.type, newIntegration.name, newIntegration.uuid, JSON.stringify(newIntegration.config)]);
  return newIntegration;
};

const deleteIntegration = async (id) => {
  const sql = 'DELETE FROM integrations WHERE bot=? AND uuid=?';
  await executeQuery(sql, [id.bot, id.uuid]);
}

const updateIntegration = async (integration) => {
  const selectQuery = 'SELECT * FROM integrations WHERE uuid=?';
  const currentIntegration = await executeSelectQuery(selectQuery, [integration.uuid]);
  if (currentIntegration.length > 0) {
    let updatedIntegration = { ...currentIntegration[0] };
    if (typeof integration.name !== 'undefined') {
      updatedIntegration.name = integration.name;
    }
    if (typeof integration.bot !== 'undefined') {
      updatedIntegration.bot = integration.bot;
    }
    if (typeof integration.config.url !== 'undefined' && integration.type === 'html') {
      let config = JSON.parse(updatedIntegration.config);
      config.url = integration.config.url;
      revokeUrlWhitelisting(updatedIntegration.config.url);
      whitelistUrl(config.url);
      config.link = await generateHtmlIntegrationLink(updatedIntegration.bot, updatedIntegration.uuid);
      updatedIntegration.config = config;
    }
    await executeQuery('UPDATE integrations SET name = ?, bot = ?, config = ? WHERE id=?',
      [updatedIntegration.name, updatedIntegration.bot, JSON.stringify(updatedIntegration.config), updatedIntegration.id]);

    updatedIntegration.id = undefined; // mask internal primary key
    return updatedIntegration;
  } else {
    return { error: 'Could not update integration that does not exist.' };
  }
}

const getIntegrations = async (filter) => {
  if (typeof filter.bot !== 'undefined' && typeof filter.type === 'undefined') {
    const result = await executeSelectQuery('SELECT bot, type, name, uuid, config FROM integrations WHERE bot=?', [filter.bot]);
    if (result.length > 0) {
      return result;
    } else {
      return {};
    }
  } else if (typeof filter.bot === 'undefined' && typeof filter.type !== 'undefined') {
    const result = await executeSelectQuery('SELECT bot, type, name, uuid, config FROM integrations WHERE type=?', [filter.type]);
    if (result.length > 0) {
      return result;
    } else {
      return {};
    }
  } else if (typeof filter.bot !== 'undefined' && typeof filter.type !== 'undefined') {
    const result = await executeSelectQuery('SELECT bot, type, name, uuid, config FROM integrations WHERE bot=? AND type=?', [filter.bot, filter.type]);
    if (result.length > 0) {
      return result;
    } else {
      return {};
    }
  } else {
    const result = await executeSelectQuery('SELECT bot, type, name, uuid, config FROM integrations', []);
    if (result.length > 0) {
      return result;
    } else {
      return {};
    }
  }
}

const getIntegration = async (id) => {
  const result = await executeSelectQuery('SELECT bot, type, name, uuid, config FROM integrations WHERE bot=? AND uuid=?', [id.bot, id.uuid]);
  if (result.length > 0) {
    return result;
  } else {
    return undefined;
  }
}

const generateIntegration = async (id) => {
  return '<div>abotkit integration for html sites</div>'
}

module.exports = {
  createIntegration: createIntegration,
  deleteIntegration: deleteIntegration,
  updateIntegration: updateIntegration,
  getIntegrations: getIntegrations,
  getIntegration: getIntegration,
  generateIntegration: generateIntegration,
};