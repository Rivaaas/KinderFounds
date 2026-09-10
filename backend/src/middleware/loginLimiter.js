// Freno de fuerza bruta para el login.
//
// Sin esto, un atacante puede probar contraseñas al ritmo que aguante el servidor.
// Es un contador en memoria: suficiente para un despliegue de una sola instancia
// como el actual. Si el backend escala a varias instancias hay que moverlo a un
// almacén compartido (Redis) o el límite se multiplica por instancia.
const MAX_INTENTOS = 8;
const VENTANA_MS   = 15 * 60 * 1000;
const BLOQUEO_MS   = 15 * 60 * 1000;

const intentos = new Map();

// Limpieza periódica para que el Map no crezca sin límite.
const limpiar = () => {
  const ahora = Date.now();
  for (const [clave, dato] of intentos) {
    if (ahora - dato.desde > VENTANA_MS && (!dato.bloqueadoHasta || ahora > dato.bloqueadoHasta)) {
      intentos.delete(clave);
    }
  }
};
const temporizador = setInterval(limpiar, VENTANA_MS);
temporizador.unref?.();

const loginLimiter = (req, res, next) => {
  const clave = req.ip || req.connection?.remoteAddress || 'desconocido';
  const ahora = Date.now();
  const dato  = intentos.get(clave) || { contador: 0, desde: ahora, bloqueadoHasta: 0 };

  if (dato.bloqueadoHasta > ahora) {
    const minutos = Math.ceil((dato.bloqueadoHasta - ahora) / 60000);
    return res.status(429).json({
      message: `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutos} minuto(s).`,
    });
  }

  if (ahora - dato.desde > VENTANA_MS) { dato.contador = 0; dato.desde = ahora; }

  // Solo los intentos fallidos cuentan: un login correcto limpia el contador.
  res.on('finish', () => {
    if (res.statusCode === 200) { intentos.delete(clave); return; }
    if (res.statusCode === 401 || res.statusCode === 403) {
      dato.contador += 1;
      if (dato.contador >= MAX_INTENTOS) dato.bloqueadoHasta = Date.now() + BLOQUEO_MS;
      intentos.set(clave, dato);
    }
  });

  intentos.set(clave, dato);
  next();
};

module.exports = loginLimiter;
