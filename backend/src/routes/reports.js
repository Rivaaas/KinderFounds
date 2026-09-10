const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/reportsController'));
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/general', c.getGeneral);
router.get('/student/:studentId', c.getByStudent);
router.get('/month/:month', c.getByMonth);
router.get('/activity/:activityId', c.getByActivity);
router.get('/petty-cash', c.getPettyCash);

module.exports = router;
