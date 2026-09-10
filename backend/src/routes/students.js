const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const { getAll, getOne, create, update, remove } = wrapAll(require('../controllers/studentController'));
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', requireAdmin, create);
router.put('/:id', requireAdmin, update);
router.delete('/:id', requireAdmin, remove);

module.exports = router;
