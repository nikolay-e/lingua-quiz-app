const { pool, closePool, checkConnection } = require('./connection');
const userDb = require('./user');
const wordSetsDb = require('./wordSets');

module.exports = {
  pool,
  closePool,
  checkConnection,
  ...userDb,
  ...wordSetsDb,
};
