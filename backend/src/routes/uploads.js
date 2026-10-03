/**
 * Upload routes — currently one endpoint:
 *   POST /api/uploads/presign  { content_type, size_bytes }
 *        → { upload_url, key, expires_at, required_headers }
 */
const { Router } = require('express');
const { presign } = require('../controllers/uploadsController');

const router = Router();

router.post('/presign', presign);

module.exports = router;
