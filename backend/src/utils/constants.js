// Límites compartidos por modelos y controladores.
//
// MAX_AMOUNT acota cualquier monto a cien millones de pesos: una tesorería de curso
// nunca llega ahí, y sin tope un dedazo (un cero de más, un pegado accidental)
// contamina todos los totales sin que nadie lo note.
const MAX_AMOUNT = 100000000;

// Ventana para detectar envíos duplicados (doble click, reintento de red).
const DUPLICATE_WINDOW_MS = 10000;

// Zona horaria del curso. El servidor corre en UTC, así que sin esto "el mes
// actual" cambia a las 21:00 hora de Chile y el dashboard pasa a contar un mes
// que todavía no empieza.
const TIMEZONE = process.env.TIMEZONE || 'America/Santiago';

// Mes actual (AAAA-MM) en la zona horaria del curso, no en UTC.
const currentMonthLocal = (fecha = new Date()) => {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year: 'numeric', month: '2-digit',
  }).format(fecha);
  return partes.slice(0, 7);
};

module.exports = { MAX_AMOUNT, DUPLICATE_WINDOW_MS, TIMEZONE, currentMonthLocal };
