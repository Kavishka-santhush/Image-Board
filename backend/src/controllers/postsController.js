/**
 * Posts controller — every handler here maps 1:1 to an HTTP endpoint.
 *
 * LAYERING (why a "controller" file at all): routes know about URL
 * shapes, controllers know about requests/responses, and the queries
 * themselves sit right here on the Knex pool. For an app this size,
 * a separate "service" layer would just be ceremony — architecture
 * should scale with the problem, not impress people.
 *
 * KNEX NOTE: `db('posts')` builds SQL; it never concatenates strings,
 * so every query below is parameterised (= safe from SQL injection)
 * by default. Compare with writing raw "SELECT ... WHERE id = " + id
 * and you'll appreciate the query builder.
 */
const db = require('../db/connection');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');
const { objectExists, publicUrlFor } = require('../aws/s3');

/** Step 7: decorate a post with ready-to-use display URLs.
 * WHY the server builds URLs (not the frontend):
 * - frontend would otherwise need bucket name + region config too — more
 *   coupling, more places to update when infra changes
 * - we only mint URLs for keys with prefixes WE manage in this bucket
 *   (uploads/, thumbnails/); seed/'manual' keys get null → UI shows the
 *   placeholder. The API tells the client what's displayable — a light
 *   flavour of HATEOAS (server hands out links, client doesn't guess). */
function withUrls(post) {
  const toUrl = (key) =>
    key && (key.startsWith('uploads/') || key.startsWith('thumbnails/'))
      ? publicUrlFor(key)
      : null;
  return {
    ...post,
    image_url: toUrl(post.image_key),
    thumbnail_url: toUrl(post.thumbnail_key),
  };
}

/** Parse :id once, fail fast with the RIGHT status code.
 *  400 = "your request is malformed"   vs   404 = "valid id, no such row"
 * — clients and future-you-in-the-logs will thank you for the difference. */
function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/posts?limit=20&offset=0
const list = asyncHandler(async (req, res) => {
  // Clamp user-controlled pagination — an unclamped ?limit=999999 on
  // a 1GB-RAM micro instance is a self-inflicted denial of service.
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const posts = await db('posts')
    .select('*')
    .orderBy('created_at', 'desc') // uses posts_created_at_idx from the migration
    .limit(limit)
    .offset(offset);

  // Counting total separately powers "load more" UIs later; on a small
  // table this is cheap. Big tables would need a different strategy.
  const [{ count: total }] = await db('posts').count({ count: '*' });

  res.json({ posts: posts.map(withUrls), meta: { limit, offset, total: Number(total) } });
});

// GET /api/posts/:id
const show = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer' });

  const post = await db('posts').where({ id }).first();
  if (!post) return res.status(404).json({ error: `post ${id} not found` });

  res.json({ post: withUrls(post) });
});

// POST /api/posts   { title, description?, image_key }
//
// When REQUIRE_ISSUED_KEY=true (from Step 7 on), the key must pass
// three checks — the Step 6 security model:
//   1. ISSUED  — a row exists in `uploads` (our presign memory)
//   2. UPLOADED — HeadObject proves the bytes are actually in S3
//   3. UNUSED  — used_at IS NULL (anti-replay: one key, one post)
//
// Why a TRANSACTION with .forUpdate(): without the row lock, two
// concurrent requests with the SAME key could both read used_at=NULL
// and both create posts — a TOCTOU race ("time of check vs time of
// use"). FOR UPDATE makes the second transaction WAIT for the first,
// then see used_at set. This is the same locking idea that keeps bank
// balances correct — now on your resume. 💰
const create = asyncHandler(async (req, res) => {
  const { title, description = '', image_key: imageKey } = req.body;

  if (!env.requireIssuedKey) {
    // Flag off: accept any key (Step 5's provisional 'manual/...' flow
    // still works until the browser uploads for real in Step 7).
    const [post] = await db('posts')
      .insert({ title: title.trim(), description, image_key: imageKey })
      .returning('*');
    return res.status(201).json({ post: withUrls(post) });
  }

  const post = await db.transaction(async (trx) => {
    const upload = await trx('uploads').where({ key: imageKey }).forUpdate().first();
    if (!upload || upload.used_at !== null) {
      throw new HttpError(400, 'image_key was not issued by this server (or already used)');
    }
    if (new Date(upload.expires_at) < new Date()) {
      throw new HttpError(400, 'presigned URL expired without an upload — request a new one');
    }
    // Proof of bytes: the object must ACTUALLY exist in the bucket.
    if (!(await objectExists(imageKey))) {
      throw new HttpError(400, 'file not found in S3 — upload it using the presigned URL first');
    }

    await trx('uploads').where({ id: upload.id }).update({ used_at: new Date() });

    const [row] = await trx('posts')
      .insert({ title: title.trim(), description, image_key: imageKey })
      .returning('*');
    return row;
  });

  res.status(201).json({ post: withUrls(post) }); // 201 Created, not 200 — REST basics
});

// PATCH /api/posts/:id   { title?, description?, image_key? }
const update = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer' });

  // Whitelist: copy ONLY known-safe fields from req.body. Without this,
  // a client could send {"thumbnail_key": "anything"} and mass-assign
  // columns we never meant to expose. Classic API vulnerability.
  const patch = {};
  for (const field of ['title', 'description', 'image_key']) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'no updatable fields provided' });
  }

  // Honouring the migration comment: the APP maintains updated_at.
  patch.updated_at = new Date();

  const [post] = await db('posts').where({ id }).update(patch).returning('*');
  if (!post) return res.status(404).json({ error: `post ${id} not found` });

  res.json({ post });
});

// DELETE /api/posts/:id
const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'id must be a positive integer' });

  const deletedCount = await db('posts').where({ id }).del();
  if (deletedCount === 0) return res.status(404).json({ error: `post ${id} not found` });

  // 204 No Content = "deleted, nothing to say" — the conventional code.
  res.status(204).end();
});

module.exports = { list, show, create, update, remove };
