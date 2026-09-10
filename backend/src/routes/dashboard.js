const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const { getSummary, getMonthlyChart } = wrapAll(require('../controllers/dashboardController'));
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/summary', getSummary);
router.get('/chart/monthly', getMonthlyChart);

module.exports = router;
