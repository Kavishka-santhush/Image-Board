/**
 * asyncHandler — a 5-line wrapper with a big lesson.
 *
 * WHY this exists: Express 4 does NOT catch rejected promises from
 * async route handlers. If `await db('posts')` throws (RDS network blip),
 * the error vanishes into the void and the request HANGS forever until
 * the browser times out. Every tutorial skips this; every production
 * Node app has this helper or a framework that provides it.
 *
 * (Express 5 finally catches async errors natively — when you upgrade,
 * this file is the first thing you delete. Until then: wrap everything.)
 */
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
