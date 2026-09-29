const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/activityController'));
const { protect, requireAdmin } = require('../middleware/auth');

router.use(protect);
router.get('/', c.getAll);
router.get('/:id', c.getOne);
router.post('/', requireAdmin, c.create);
router.put('/:id', requireAdmin, c.update);
router.delete('/:id', requireAdmin, c.remove);
// Cuotas por alumno de una actividad: marcar pagado/pendiente o quitar el registro.
router.put('/:id/students/:studentId/payment', requireAdmin, c.setStudentPayment);
router.delete('/:id/students/:studentId/payment', requireAdmin, c.removeStudentPayment);

module.exports = router;
