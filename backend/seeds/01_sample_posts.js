/**
 * Seeder: sample posts so the app has data on first run.
 *
 * MIGRATIONS vs SEEDS — a distinction worth internalising:
 * - Migrations = schema (tables, columns, indexes). Run on EVERY deploy.
 * - Seeds = data. Run MANUALLY in dev/testing only. Our CI/CD pipeline
 *   will run `migrate:latest` but NEVER `seed:run` in production — you
 *   don't want a deploy wiping real user posts!
 *
 * WHY truncate before insert: makes the seed idempotent — run it ten
 * times, same result. Great for dev. RESTART IDENTITY resets the
 * serial sequence too, so ids stay predictable while learning.
 * (Note: `del()` would empty the table but NOT reset the sequence —
 *  TRUNCATE is the right DDL tool here.)
 *
 * The image_key values point at objects that don't exist in S3 yet —
 * fine for now; the frontend (Step 5) will show a placeholder until the
 * real upload flow (Step 6-7) creates actual objects.
 */

exports.seed = async function seed(knex) {
  // Idempotent reset: clear rows AND restart the id counter at 1
  await knex.raw('TRUNCATE TABLE posts RESTART IDENTITY');

  await knex('posts').insert([
    {
      title: 'First post — welcome to Image Board',
      description:
        'This row came from a seeder, not the app. Later posts will come through the Express API into RDS.',
      image_key: 'seed/placeholder-01.jpg',
      thumbnail_key: null, // not processed by Lambda yet
    },
    {
      title: 'Knex migrations are awesome',
      description:
        'Schema changes as code, versioned in git — the same review-and-deploy flow as application code.',
      image_key: 'seed/placeholder-02.jpg',
      thumbnail_key: 'seed/placeholder-02_thumb.jpg', // pretending Lambda did this one
    },
    {
      title: 'CI/CD learning target',
      description:
        'Push to GitHub → Actions builds, deploys to EC2, migrates RDS, updates Lambda. One pipeline, four AWS services.',
      image_key: 'seed/placeholder-03.jpg',
      thumbnail_key: null,
    },
  ]);
};
