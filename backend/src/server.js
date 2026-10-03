/**
 * Entry point — the ONLY file pm2/node runs on EC2.
 *
 * Startup order matters for debugging deploys:
 * 1. validate env (config/env.js exits loudly if secrets missing)
 * 2. verify DB connectivity with a tiny query — if RDS is unreachable
 *    (security group misconfigured!), we see it IMMEDIATELY in the
 *    pm2 logs instead of on the first user request.
 */
const app = require('./app');
const env = require('./config/env');
const db = require('./db/connection');

async function start() {
  try {
    await db.raw('select 1');
    console.log('✅ Connected to PostgreSQL (RDS)');
  } catch (err) {
    console.error('❌ Cannot reach database:', err.message);
    console.error('   Check DATABASE_URL and the RDS security group inbound rule (5432).');
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`🚀 API listening on http://localhost:${env.port}`);
  });
}

// Graceful shutdown: on EC2, `pm2 restart` sends SIGINT/SIGTERM.
// Closing the server + pool prevents orphaned DB connections.
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    console.log(`${signal} received — shutting down gracefully...`);
    db.destroy().then(() => process.exit(0));
  });
});

start();
