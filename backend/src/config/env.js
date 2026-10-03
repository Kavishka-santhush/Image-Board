/**
 * Loads and validates environment variables in ONE place.
 *
 * WHY: if a variable is missing, we want a loud error at STARTUP,
 * not a confusing 500 halfway through a request. On EC2/GitHub Actions
 * this pattern saves hours of debugging forgotten secrets.
 */
require('dotenv').config();

const required = ['DATABASE_URL', 'AWS_REGION', 'S3_BUCKET'];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing env vars: ${missing.join(', ')}`);
  console.error('   Copy backend/.env.example to backend/.env and fill it in.');
  process.exit(1);
}

module.exports = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  dbPool: {
    min: Number(process.env.DB_POOL_MIN || 1),
    max: Number(process.env.DB_POOL_MAX || 5),
  },
  awsRegion: process.env.AWS_REGION,
  s3Bucket: process.env.S3_BUCKET,
  uploadMaxMb: Number(process.env.UPLOAD_MAX_MB || 5),
  presignTtlSec: Number(process.env.PRESIGN_TTL_SEC || 300),
  // Feature flag — Step 6 issues presigned URLs but the Step 5 frontend
  // still posts provisional 'manual/...' keys. Flipping this to true
  // (done in Step 7, once the browser uploads for real) makes
  // POST /posts reject any key we never issued. Shipping a stricter
  // validation BEFORE its clients support it = flag-gated rollout,
  // the same trick every CI/CD maturity ladder uses.
  requireIssuedKey: process.env.REQUIRE_ISSUED_KEY === 'true',
};
