/**
 * image-board thumbnailer — AWS Lambda, triggered by S3 events.
 *
 * THE EVENT-DRIVEN PATTERN you're learning here:
 *   browser → S3 (PUT succeeds)
 *                └→ S3 sees new object under uploads/ → invokes THIS
 *                       1. download original     (S3 GetObject)
 *                       2. resize to thumbnail   (sharp, in /tmp)
 *                       3. upload thumbnail      (S3 PutObject)
 *                       4. UPDATE posts SET thumbnail_key…  (RDS!)
 * No polling, no backend involvement, no redeploy — the moment a post
 * is created, the listing will UPGRADE ITSELF to the thumbnail when
 * you refresh. That's async processing made visible.
 *
 * RUNTIME FACTS (Node.js 20.x):
 * - @aws-sdk/client-s3 is BUILT INTO the runtime → NOT in package.json.
 *   Bundling it anyway = slower cold starts + bigger upload. Runtime
 *  -provided SDK is free bytes.
 * - sharp and pg are NOT built in → they ship in the deployment zip,
 *   and they MUST be linux-x64 builds (see package.json comments).
 * - /tmp is the only writable dir (default 512MB) — enough for our
 *   ≤5MB images; real-world large media uses /tmp carefully or streams.
 */
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } =
  require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { Pool } = require('pg');

const s3 = new S3Client({}); // region from Lambda env/context, creds from ROLE

// ─────────────────────────────────────────────────────────────
// CREDENTIALS SIDE-BY-SIDE — the lesson this function teaches best:
//   S3 access: NO keys. Lambda's EXECUTION ROLE (an IAM role) is
//     assumed automatically; the SDK finds it via environment. This is
//     the same "instance profile" trick EC2 will get in Step 9.
//   RDS access: a password is a password — we inject DATABASE_URL as a
//     Lambda ENVIRONMENT VARIABLE. Fine for learning; production moves
//     it to Secrets Manager (or VPC security + IAM DB auth). Mentioned
//     in docs § 5 — you set it via CLI/Console, never commit it.
// ─────────────────────────────────────────────────────────────

let pool; // lazily created OUTSIDE the handler — reused across "warm"
// invocations of the same container. Creating a Pool PER INVOCATION is
// the #1 Lambda+RDS mistake: it melts RDS connection limits instantly.
function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // RDS cert chain isn't in Lambda's CA store by default
      max: 1, // one connection per container — micro RDS has ~10 slots TOTAL
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

const THUMB_PREFIX = 'thumbnails/';
const SOURCE_PREFIX = 'uploads/';
const MAX_SOURCE_BYTES = 20 * 1024 * 1024; // belt & braces; presign caps at 5MB
const THUMB_WIDTH = 400;

async function processKey(bucket, key) {
  // ── 1. Inspect what ACTUALLY landed ──────────────────────────────
  // The Step 6 lesson: presign validated a CLAIM; here we validate
  // reality (declared size/type vs actual object metadata).
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.ContentType && !head.ContentType.startsWith('image/')) {
    console.log(`skip non-image (${head.ContentType}) ${key}`);
    return 'skipped';
  }
  if (head.ContentLength > MAX_SOURCE_BYTES) {
    console.log(`skip oversized (${head.ContentLength}B) ${key}`);
    return 'skipped';
  }

  // ── 2. Download + resize in memory ──────────────────────────────
  // sharp is libvips bindings — fast, low-memory, streaming pipeline.
  // resize(400): width cap, aspect kept, height auto. fit default
  // 'cover' only applies when BOTH dims given — here pure downscale.
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await obj.Body.transformToByteArray(); // SDK v3 helper

  const thumb = await sharp(bytes)
    .rotate() // honour EXIF orientation — phone photos render upright
    .resize({ width: THUMB_WIDTH })
    .jpeg({ quality: 80 })
    .toBuffer();

  // ── 3. Upload thumbnail ─────────────────────────────────────────
  // Key mirrors the source name so humans (and cleanup jobs) can map
  // thumb→original at a glance: uploads/1234-abc.jpg →
  //                       thumbnails/1234-abc_thumb.jpg
  const thumbKey =
    THUMB_PREFIX + key.slice(SOURCE_PREFIX.length).replace(/\.(\w+)$/, '') + '_thumb.jpg';

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: thumbKey,
      Body: thumb,
      ContentType: 'image/jpeg',
      // NOTE: no ACL — bucket policy (docs § 4b) grants public read for
      // thumbnails/* ; ACLs are the legacy mechanism, policies the modern one.
    })
  );

  // ── 4. Tell RDS — THE round trip that makes the listing upgrade ──
  const result = await getPool().query(
    'UPDATE posts SET thumbnail_key = $1, updated_at = now() WHERE image_key = $2 RETURNING id',
    [thumbKey, key] // parameterised — same injection safety as Knex
  );
  if (result.rowCount === 0) {
    // Post deleted between upload and processing (user is fast!) —
    // orphan thumbnail in S3 is acceptable for learning; production
    // adds a cleanup job (S3 lifecycle rule, another free-tier lesson).
    console.log(`no post row for key ${key} — thumbnail still saved at ${thumbKey}`);
  } else {
    console.log(`post ${result.rows[0].id} thumbnailed → ${thumbKey}`);
  }
  return 'processed';
}

/**
 * S3 event payload shape: Records[] each with eventName and
 * s3.bucket.name + s3.object.key — the key arrives URL-ENCODED.
 *
 * WHY we still loop Records even though "S3 invokes once per object":
 * some paths (restorations, test events) batch; iterating is the
 * defensive habit. We ALSO filter to uploads/ — and crucially to
 * ObjectCreated:* events, because OUR OWN thumbnail PUT fires another
 * event; without the prefix filter we'd create an infinite S3→Lambda
 * loop. Infinite loops on serverless platforms cost REAL money in
 * milliseconds — this filter is load-bearing.
 */
exports.handler = async (event) => {
  const results = [];
  for (const record of event.Records || []) {
    const eventName = record.eventName || '';
    const bucket = record.s3?.bucket?.name;
    const rawKey = record.s3?.object?.key || '';
    const key = decodeURIComponent(rawKey); // 'my%20file.jpg' → 'my file.jpg'

    if (!eventName.startsWith('ObjectCreated:')) continue;
    if (!key.startsWith(SOURCE_PREFIX)) continue; // THE loop filter ↑
    if (!bucket) continue;

    try {
      results.push(await processKey(bucket, key));
    } catch (err) {
      // We THROW at the end rather than swallowing: failed invocations
      // land in Lambda's dead-letter-land (visible in CloudWatch +
      // Metrics) instead of pretending success. Silent failure is the
      // worst outcome in async systems.
      console.error(`failed for ${key}:`, err);
      results.push('failed');
    }
  }
  console.log('thumbnailer run:', JSON.stringify(results));
  const failed = results.filter((r) => r === 'failed').length;
  if (failed > 0) throw new Error(`${failed} record(s) failed — see logs`);
  return { results };
};
