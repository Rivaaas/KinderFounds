const router = require('express').Router();
const { wrapAll } = require('../utils/asyncHandler');
const c = wrapAll(require('../controllers/publicController'));
const { createRateLimit } = require('../middleware/rateLimit');

// Consulta pública de estado de cuenta: no requiere autenticación, por eso se
// limita el ritmo de peticiones y los controladores devuelven solo el nombre del
// alumno y sus montos, nunca identificadores internos ni datos de terceros.
const limiteBusqueda = createRateLimit({
  max: 60,
  windowMs: 60 * 1000,
  message: 'Demasiadas búsquedas seguidas. Espera un momento y vuelve a intentar.',
});

// El estado de cuenta lleva un límite propio y más estricto: una familia
// consulta el suyo unas pocas veces, así que un ritmo alto solo tiene sentido
// para alguien recorriendo el curso entero.
const limiteEstado = createRateLimit({
  max: 20,
  windowMs: 60 * 1000,
  message: 'Demasiadas consultas seguidas. Espera un momento y vuelve a intentar.',
});

router.get('/students', limiteBusqueda, c.searchStudents);
// Actividades del curso con quiénes pagaron y quiénes no. Solo las marcadas como
// visibles; nombres y montos, sin identificadores.
router.get('/activities', limiteBusqueda, c.getActivities);
router.get('/students/:id/statement', limiteEstado, c.getStatement);

module.exports = router;
