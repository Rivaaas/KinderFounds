// Limitador de peticiones por IP, en memoria.
//
// Pensado para los endpoints públicos: sin autenticación, cualquiera puede
// consultarlos en bucle. Al ser un contador en memoria funciona con una sola
// instancia (el despliegue actual); si el backend escala, hay que moverlo a un
// almacén compartido o el límite se multiplica por instancia.
const createRateLimit = ({ max, windowMs, message }) => {
  const visitas = new Map();

  const limpiar = () => {
    const ahora = Date.now();
    for (const [clave, d] of visitas) if (ahora - d.desde > windowMs) visitas.delete(clave);
  };
  const temporizador = setInterval(limpiar, windowMs);
  temporizador.unref?.();

  return (req, res, next) => {
    const clave = req.ip || req.connection?.remoteAddress || 'desconocido';
    const ahora = Date.now();
    const d = visitas.get(clave) || { contador: 0, desde: ahora };

    if (ahora - d.desde > windowMs) { d.contador = 0; d.desde = ahora; }
    d.contador += 1;
    visitas.set(clave, d);

    if (d.contador > max) {
      const segundos = Math.ceil((d.desde + windowMs - ahora) / 1000);
      res.set('Retry-After', String(segundos));
      return res.status(429).json({ message: message || 'Demasiadas consultas. Espera un momento.' });
    }
    next();
  };
};

module.exports = { createRateLimit };
