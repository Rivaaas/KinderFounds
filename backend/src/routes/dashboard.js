const router = require('express').Router();
const { getSummary, getMonthlyChart } = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/summary', getSummary);
router.get('/chart/monthly', getMonthlyChart);

module.exports = router;
