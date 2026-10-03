/**
 * API route registry.
 *
 * /api/health exists mainly for the CI/CD pipeline: after GitHub
 * Actions deploys to EC2, the workflow curls this endpoint to verify
 * the new version actually came up ("smoke test" / deploy gate).
 */
const { Router } = require('express');
const db = require('../db/connection');

const router = Router();

router.get('/health', async (req, res) => {
  try {
    await db.raw('select 1');
    res.json({ status: 'ok', db: 'up', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'down', error: err.message });
  }
});

// Step 4: full posts CRUD — see routes/posts.js for the contract
router.use('/posts', require('./posts'));

// Step 6: S3 presigned uploads — POST /api/uploads/presign
router.use('/uploads', require('./uploads'));

module.exports = router;
