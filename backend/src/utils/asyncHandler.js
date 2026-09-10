// Express 4 no captura las promesas rechazadas de un handler async: el error queda
// como unhandled rejection y en Node >= 15 tumba el proceso completo. Envolver cada
// controlador redirige el error al errorHandler, que responde con el código correcto.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Envuelve de una vez todas las funciones exportadas por un controlador.
const wrapAll = (controller) =>
  Object.fromEntries(
    Object.entries(controller).map(([name, value]) => [
      name,
      typeof value === 'function' ? asyncHandler(value) : value,
    ])
  );

module.exports = { asyncHandler, wrapAll };
