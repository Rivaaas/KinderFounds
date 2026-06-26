const router = require('express').Router();
const c = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', c.getAll);
router.get('/month-summary/:month', c.getMonthSummary);
router.get('/:id', c.getOne);
router.post('/', c.create);
router.post('/generate-monthly', c.generateMonthlyFees);
router.put('/:id', c.update);
router.delete('/:id', c.remove);

module.exports = router;
