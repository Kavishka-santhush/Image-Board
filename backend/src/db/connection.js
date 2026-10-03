/**
 * Single shared Knex instance ("connection pool") for the whole app.
 *
 * WHY a singleton: opening a new DB connection per request is slow and
 * WILL exhaust RDS's connection limit (free-tier db.t3.micro allows only
 * ~family-of-connections). One pool, created once, reused everywhere —
 * this is a pattern you'll see in every production Node app.
 */
const knex = require('knex');
const config = require('../../knexfile');

const environment = process.env.NODE_ENV || 'development';

module.exports = knex(config[environment]);
