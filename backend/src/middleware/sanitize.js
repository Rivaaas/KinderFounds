// Elimina claves que Mongo interpretaría como operadores.
//
// Express convierte `?status[$ne]=paid` en un objeto, y ese objeto llegaba tal cual
// al filtro de la consulta: bastaba manipular la URL para leer registros fuera del
// filtro pedido. Lo mismo con un body `{"username": {"$ne": null}}` en el login.
const esPeligrosa = (clave) => clave.startsWith('$') || clave.includes('.');

const limpiar = (valor, profundidad = 0) => {
  if (profundidad > 10 || valor === null || typeof valor !== 'object') return valor;

  if (Array.isArray(valor)) return valor.map((v) => limpiar(v, profundidad + 1));

  const salida = {};
  for (const [clave, v] of Object.entries(valor)) {
    if (esPeligrosa(clave)) continue;
    salida[clave] = limpiar(v, profundidad + 1);
  }
  return salida;
};

const sanitize = (req, res, next) => {
  if (req.body && typeof req.body === 'object') req.body = limpiar(req.body);
  if (req.query && typeof req.query === 'object') {
    const limpio = limpiar(req.query);
    // En Express 4 req.query es reasignable; se sustituye clave por clave por
    // compatibilidad con versiones donde la propiedad es de solo lectura.
    for (const k of Object.keys(req.query)) if (!(k in limpio)) delete req.query[k];
    Object.assign(req.query, limpio);
  }
  next();
};

module.exports = sanitize;
