const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/fineController'));
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect);
router.get('/',             c.getAll);
router.post('/',            requireAdmin, c.create);
router.put('/:id/pay',      requireAdmin, c.pay);
router.put('/:id/unpay',    requireAdmin, c.unpay);
router.put('/:id',          requireAdmin, c.update);
router.delete('/:id',       requireAdmin, c.remove);

module.exports = router;
