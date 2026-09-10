const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/expenseController'));
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect);
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/', requireAdmin, c.create);
router.put('/:id', requireAdmin, c.update);
router.delete('/:id', requireAdmin, c.remove);

module.exports = router;
