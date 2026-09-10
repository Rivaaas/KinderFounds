const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/publicController'));
const { createRateLimit } = require('../middleware/rateLimit');

// Consulta pública de estado de cuenta: no requiere autenticación, por eso se
// limita el ritmo de peticiones y los controladores devuelven solo el nombre del
// alumno y sus montos, nunca identificadores internos ni datos de terceros.
const limite = createRateLimit({
  max: 120,
  windowMs: 60 * 1000,
  message: 'Demasiadas consultas seguidas. Espera un momento y vuelve a intentar.',
});

router.use(limite);
router.get('/students', c.searchStudents);
router.get('/students/:id/statement', c.getStatement);

module.exports = router;
