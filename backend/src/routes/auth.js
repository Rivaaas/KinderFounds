const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const { login, me, changePassword } = wrapAll(require('../controllers/authController'));
const { protect } = require('../middleware/auth');
const loginLimiter = require('../middleware/loginLimiter');

router.post('/login', loginLimiter, login);
router.get('/me', protect, me);
router.put('/change-password', protect, changePassword);

module.exports = router;
