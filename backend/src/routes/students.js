const router = require('express').Router();
const { getAll, getOne, create, update, remove } = require('../controllers/studentController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/', getAll);
router.get('/:id', getOne);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
