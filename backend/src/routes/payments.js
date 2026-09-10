const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/paymentController'));
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect);
router.get('/', c.getAll);
router.get('/month-summary/:month', c.getMonthSummary);
router.get('/:id', c.getOne);
router.post('/', requireAdmin, c.create);
router.post('/generate-monthly', requireAdmin, c.generateMonthlyFees);
router.put('/:id', requireAdmin, c.update);
router.delete('/:id', requireAdmin, c.remove);

module.exports = router;
