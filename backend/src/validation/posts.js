/**
 * Hand-rolled validation — no library, on purpose.
 *
 * WHY: for 4 fields, a validation package is another dependency to audit
 * and learn. Writing the checks yourself teaches you exactly what any
 * library is doing under the hood. The shapes here match the posts table
 * from the migration — keep both in sync if you change either.
 */

const TITLE_MAX = 140; // matches table.string('title', 140)

/**
 * @returns {string[]} list of human-readable problems (empty = valid)
 */
function validatePost(body, { partial = false } = {}) {
  const errors = [];
  const has = (field) => Object.prototype.hasOwnProperty.call(body, field);

  // --- title ---
  if (!partial || has('title')) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('title is required and must be a non-empty string');
    } else if (body.title.length > TITLE_MAX) {
      errors.push(`title must be at most ${TITLE_MAX} characters`);
    }
  }

  // --- description (optional, defaults to '' in the DB) ---
  if (has('description') && typeof body.description !== 'string') {
    errors.push('description must be a string');
  }

  // --- image_key ---
  // For now any non-empty string passes. Step 6 closes this hole: the
  // presign endpoint will RECORD the key it issued, and create will
  // verify the key was actually issued to this server. Trust boundary:
  // never let a client claim it uploaded something it never uploaded.
  if (!partial || has('image_key')) {
    if (typeof body.image_key !== 'string' || body.image_key.trim().length === 0) {
      errors.push('image_key is required');
    }
  }

  return errors;
}

/** Express middleware: run validatePost, 400 with ALL problems at once. */
function postBodyRules(req, res, next) {
  const errors = validatePost(req.body || {}, { partial: false });
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

/** Same rules but every field is optional (PATCH semantics). */
function postPatchRules(req, res, next) {
  const errors = validatePost(req.body || {}, { partial: true });
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  next();
}

module.exports = { validatePost, postBodyRules, postPatchRules, TITLE_MAX };
