const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/userController'));
const { protect, requireAdmin } = require('../middleware/auth');

// La gestión de perfiles es exclusiva de admin, incluso para consultarla.
router.use(protect, requireAdmin);
router.get('/', c.getAll);
router.post('/', c.create);
router.put('/:id', c.update);
router.put('/:id/password', c.resetPassword);
router.delete('/:id', c.remove);

module.exports = router;
