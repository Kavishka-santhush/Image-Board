/**
 * Migration: create the `posts` table.
 *
 * HOW KNEX MIGRATIONS WORK (important concept for CI/CD):
 * - Each file in migrations/ is applied ONCE, in filename order.
 * - Knex keeps a `knex_migrations` table in RDS recording which files
 *   already ran. So `knex migrate:latest` is SAFE to run on every
 *   deploy — it only applies NEW files. That's why GitHub Actions can
 *   call it blindly after each push.
 * - `up` = apply change, `down` = undo it (`knex migrate:rollback`).
 *   Writing both from day one builds the habit for production rollbacks.
 *
 * SCHEMA DESIGN — the S3 + Lambda learning part:
 * - We store `image_key` (the S3 object key, e.g. "uploads/abc.jpg"),
 *   NOT the full https:// URL. Keys are stable; bucket/region can change.
 *   The app builds the public URL from bucket + key when needed.
 * - `thumbnail_key` starts NULL. When our Lambda finishes processing an
 *   uploaded image it writes this column. NULL = "thumbnail not ready
 *   yet" — so we DON'T need a separate boolean flag. Derived state:
 *   one source of truth, no possibility of flag/image disagreement.
 */

exports.up = function up(knex) {
  return knex.schema.createTable('posts', (table) => {
    table.increments('id').primary(); // serial integer — simple & index-friendly

    table.string('title', 140).notNullable();
    table.text('description').notNullable().defaultTo('');

    // S3 object keys (paths inside the bucket), NOT full URLs
    table.string('image_key', 1024).notNullable();
    table.string('thumbnail_key', 1024).nullable(); // Lambda fills this in

    // updated_at is maintained by the app (Step 4), not the DB —
    // portable and explicit, works the same in every environment.
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    // Learning point: Postgres btree index on created_at makes
    // "ORDER BY created_at DESC LIMIT 20" (our listing query) fast.
    table.index('created_at', 'posts_created_at_idx');
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('posts');
};
