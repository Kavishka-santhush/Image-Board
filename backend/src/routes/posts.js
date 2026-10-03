/**
 * Posts routes — declarative wiring only, zero logic.
 *
 * Reading order top-to-bottom is the API contract:
 *   GET    /api/posts            list (paginated)
 *   POST   /api/posts            create   (validated)
 *   GET    /api/posts/:id        read one
 *   PATCH  /api/posts/:id        partial update (validated, partial rules)
 *   DELETE /api/posts/:id        remove
 *
 * Middleware order matters: validation runs BEFORE the controller,
 * so controllers can assume req.body already passes the rules —
 * that's the whole point of pushing checks into the route layer.
 */
const { Router } = require('express');
const controller = require('../controllers/postsController');
const { postBodyRules, postPatchRules } = require('../validation/posts');

const router = Router();

router.get('/', controller.list);
router.post('/', postBodyRules, controller.create);
router.get('/:id', controller.show);
router.patch('/:id', postPatchRules, controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
