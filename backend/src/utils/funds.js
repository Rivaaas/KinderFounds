// Fondos del curso.
//
// Todo el dinero de la tesorería pertenece a uno de tres fondos y cada gasto o
// descuento sale de uno de ellos, elegido por quien lo registra:
//   cuotas       → cuotas mensuales de los apoderados
//   actividades  → cuotas de actividades, rifas, aportes voluntarios y afines
//   caja_chica   → caja chica (saldo inicial + pagos y movimientos de caja chica)
//
// Antes existía un único "fondo general" que mezclaba cuotas y actividades. Los
// registros antiguos siguen guardados con esos valores (`general` en gastos,
// `cuotas_mensuales` en descuentos) y se interpretan como fondo de cuotas, por
// decisión de la tesorería (2026-10-02). Se mantienen en los enum de los modelos
// solo para no invalidar documentos existentes: toda escritura nueva se
// normaliza al valor canónico.
const FUNDS = ['cuotas', 'actividades', 'caja_chica'];

const LEGACY_FUNDS = {
  general:          'cuotas',
  cuotas_mensuales: 'cuotas',
};

const FUND_VALUES = [...FUNDS, ...Object.keys(LEGACY_FUNDS)];

const FUND_LABELS = {
  cuotas:      'Cuotas Mensuales',
  actividades: 'Actividades',
  caja_chica:  'Caja Chica',
};

// Valor canónico de un fondo (los heredados se traducen); undefined si no es un fondo.
const normalizeFund = (value) => {
  if (typeof value !== 'string') return undefined;
  const v = LEGACY_FUNDS[value] || value;
  return FUNDS.includes(v) ? v : undefined;
};

// Valida el fondo recibido en un formulario. Devuelve { value } o { error }.
const parseFund = (value, { required = false, campo = 'fondo' } = {}) => {
  if (value === undefined || value === null || value === '') {
    return required ? { error: `El ${campo} es requerido.` } : { value: undefined };
  }
  const fondo = normalizeFund(value);
  if (!fondo) return { error: `El ${campo} debe ser uno de: ${FUNDS.join(', ')}.` };
  return { value: fondo };
};

// Condición de consulta que incluye los valores heredados equivalentes, para que
// filtrar por "cuotas" también traiga los registros antiguos guardados como
// "general" o "cuotas_mensuales".
const fundQuery = (value) => {
  const fondo = normalizeFund(value);
  if (!fondo) return undefined;
  const equivalentes = [fondo, ...Object.keys(LEGACY_FUNDS).filter((k) => LEGACY_FUNDS[k] === fondo)];
  return equivalentes.length === 1 ? fondo : { $in: equivalentes };
};

module.exports = { FUNDS, FUND_VALUES, FUND_LABELS, LEGACY_FUNDS, normalizeFund, parseFund, fundQuery };
