/**
 * Migration: `uploads` — the presign registry.
 *
 * WHY this table exists (the security lesson of Step 6):
 * A presigned URL lets anyone upload to ONE key — but what stops a
 * client calling POST /posts with image_key: "uploads/someone-elses.jpg"
 * or a key we never issued? NOTHING — unless the server remembers what
 * it signed. This table is that memory:
 *
 *   presign  → INSERT a row (the server vouches: "I issued this key")
 *   create   → key must exist here, unused, AND HeadObject must prove
 *              the bytes actually landed in S3 → then mark used_at
 *
 * Without this, a malicious client could create posts claiming any S3
 * key. With it, the flow is: issued ∧ uploaded ∧ unused → usable.
 */

exports.up = function up(knex) {
  return knex.schema.createTable('uploads', (table) => {
    table.increments('id').primary();

    // the exact S3 key we issued a presigned URL for
    table.string('key', 1024).notNullable().unique();

    // what the client CLAIMED it would upload (enforced in the signature:
    // a PUT with a different Content-Type is rejected by S3 itself)
    table.string('content_type', 100).notNullable();
    table.integer('size_bytes').notNullable();

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    // presigned URL expiry mirrored in the DB — an issued key is only
    // honourable for that long; after that nobody could have uploaded
    table.timestamp('expires_at').notNullable();
    // NULL = available; set = already consumed by a post (anti-replay)
    table.timestamp('used_at').nullable();
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('uploads');
};
