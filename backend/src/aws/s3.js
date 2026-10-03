/**
 * S3 client — one instance, shared (same singleton logic as the DB pool).
 *
 * CREDENTIALS — the part everyone gets wrong on first AWS deploy:
 * We pass NO access keys here. The AWS SDK resolves them in this exact
 * order ("the default credential chain"):
 *   1. env vars   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  (your laptop)
 *   2. shared config  ~/.aws/credentials                     (your laptop)
 *   3. EC2 instance profile / task role                      (production)
 *
 * On EC2 this means ZERO AWS secrets in .env — you attach an IAM role to
 * the instance and the SDK magically gets short-lived credentials from
 * the instance metadata service. That's the AWS-native way, and it's a
 * Step 9 setup task (we'll create the role together).
 */
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');

const s3 = new S3Client({ region: env.awsRegion });

/**
 * Mint a presigned PUT URL for exactly one object.
 * The signature encodes bucket+key+content-type+expiry — the browser
 * can't change any of it, S3 will reject a mismatched PUT.
 */
async function getUploadUrl({ key, contentType }) {
  const command = new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: key,
    ContentType: contentType, // signed INTO the URL — client must send it back
  });
  return getSignedUrl(s3, command, { expiresIn: env.presignTtlSec });
}

/** True if the object actually exists in the bucket (proof of upload). */
async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.s3Bucket, Key: key }));
    return true;
  } catch (err) {
    // SDK v3 signals 404 as NotFound / NotFoundError / http 403-404
    const code = err.name || '';
    if (
      code.includes('NotFound') ||
      err.$metadata?.httpStatusCode === 404 ||
      err.$metadata?.httpStatusCode === 403
    ) {
      return false;
    }
    throw err; // real problem (no creds, network) — let it bubble to the error handler
  }
}

/** Public URL for an object (bucket must allow s3:GetObject — see docs). */
function publicUrlFor(key) {
  return `https://${env.s3Bucket}.s3.${env.awsRegion}.amazonaws.com/${key}`;
}

module.exports = { s3, getUploadUrl, objectExists, publicUrlFor };
