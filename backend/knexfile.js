/**
 * Knex config — Knex is our migration runner AND query builder.
 *
 * WHY this matters for CI/CD: GitHub Actions will run
 * `knex migrate:latest` against RDS after every deploy. That's how
 * schema changes reach production automatically — no manual psql.
 *
 * The `environment`-keyed format (development/production) is Knex's
 * standard convention. On EC2 we run with NODE_ENV=production.
 */
const env = require('./src/config/env');

const baseConfig = () => ({
  client: 'pg',
  connection: {
    connectionString: env.databaseUrl,
    // RDS enforces TLS from outside the VPC — never disable this.
    ssl: { rejectUnauthorized: false },
  },
  pool: env.dbPool,
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations', // Knex records applied migrations here
  },
  seeds: {
    directory: './seeds',
  },
});

module.exports = {
  development: baseConfig(),
  test: baseConfig(),
  production: baseConfig(),
};
