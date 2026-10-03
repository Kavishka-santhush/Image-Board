/**
 * Uploads controller — POST /api/uploads/presign
 *
 * THE PRESIGNED-URL PATTERN (core S3 lesson), in one paragraph:
 * The browser asks OUR server for permission (our AWS credentials do
 * the signing), then uploads straight to S3 with that permission slip.
 * EC2 never sees the file bytes; S3 never sees our long-term keys in
 * the browser. Signature covers bucket + key + content-type + expiry,
 * so the client can't repurpose the URL for anything else.
 *
 * WHY validate server-side even though S3 enforces the signature:
 * the signature prevents tampering, but only WE know the business rules
 * (jpeg/png/webp only, ≤ N MB). Enforcement point = this handler.
 */
const crypto = require('crypto');
const db = require('../db/connection');
const env = require('../config/env');
const { getUploadUrl } = require('../aws/s3');
const asyncHandler = require('../utils/asyncHandler');

// allowlist: content-type → extension (keys stay human-readable)
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const presign = asyncHandler(async (req, res) => {
  const { content_type: contentType, size_bytes: sizeBytes } = req.body || {};

  const problems = [];

  if (!ALLOWED_TYPES[contentType]) {
    problems.push(
      `content_type must be one of: ${Object.keys(ALLOWED_TYPES).join(', ')}`
    );
  }

  const maxBytes = env.uploadMaxMb * 1024 * 1024;
  // parseInt so a string "123" can't sneak past typeof checks
  if (!Number.isInteger(Number(sizeBytes)) || Number(sizeBytes) <= 0) {
    problems.push('size_bytes must be a positive integer');
  } else if (Number(sizeBytes) > maxBytes) {
    problems.push(`file too large: max ${env.uploadMaxMb} MB`);
  }

  // HONEST LIMITATION worth knowing (great interview question):
  // a presigned PUT can't enforce content-length the way a presigned
  // POST form can — the client could lie about size_bytes and upload
  // bigger. Real guards: S3 event → Lambda (Step 8) re-checks size and
  // type of what ACTUALLY landed. Declared size = early politeness,
  // HeadObject in the Lambda = the truth.
  if (problems.length > 0) {
    return res.status(400).json({ error: 'Upload request rejected', details: problems });
  }

  // Key layout: uploads/<epoch>-<24-hex-chars>.<ext>
  // - epoch prefix → bucket listings sort chronologically (debugging joy)
  // - random hex → unguessable, collision-free, no user PII in keys
  // - we GENERATE the key; the client's filename never reaches S3
  //   (filenames are an XSS/normalisation vector — ignore them entirely)
  const ext = ALLOWED_TYPES[contentType];
  const key = `uploads/${Date.now()}-${crypto.randomBytes(12).toString('hex')}${ext}`;

  const uploadUrl = await getUploadUrl({ key, contentType });
  const expiresAt = new Date(Date.now() + env.presignTtlSec * 1000);

  // Record the issuance — this is what lets POST /posts verify the key
  // in Step 6's security model (see uploads migration).
  await db('uploads').insert({
    key,
    content_type: contentType,
    size_bytes: Number(sizeBytes),
    expires_at: expiresAt,
  });

  res.json({
    upload_url: uploadUrl,
    key,
    expires_at: expiresAt.toISOString(),
    // tell the browser the exact header S3 will demand back:
    required_headers: { 'Content-Type': contentType },
  });
});

module.exports = { presign, ALLOWED_TYPES };
