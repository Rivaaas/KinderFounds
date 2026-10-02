// Fondos del curso. Es la misma lista que `backend/src/utils/funds.js`:
// todo el dinero pertenece a uno de los tres y cada gasto o descuento sale
// del fondo que elige quien lo registra.
export const FUNDS = [
  {
    key: 'cuotas',
    label: 'Cuotas Mensuales',
    short: 'Cuotas',
    emoji: '📋',
    hint: 'Lo que aportan los apoderados mes a mes',
    // Colores validados (separación CVD y contraste en claro y oscuro).
    color: '#7C3AED',
    text: 'text-violet-600 dark:text-violet-400',
    active: 'bg-violet-500/15 border-violet-500 text-violet-700 dark:text-violet-300',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  },
  {
    key: 'actividades',
    label: 'Actividades',
    short: 'Actividades',
    emoji: '⚡',
    hint: 'Cuotas de actividades, rifas y aportes',
    color: '#0891B2',
    text: 'text-cyan-700 dark:text-cyan-400',
    active: 'bg-cyan-500/15 border-cyan-600 text-cyan-700 dark:text-cyan-300',
    badge: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300',
  },
  {
    key: 'caja_chica',
    label: 'Caja Chica',
    short: 'Caja Chica',
    emoji: '🐷',
    hint: 'Saldo inicial más pagos y movimientos de caja chica',
    color: '#EC4899',
    text: 'text-pink-600 dark:text-pink-400',
    active: 'bg-pink-500/15 border-pink-500 text-pink-700 dark:text-pink-300',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
  },
];

// Registros antiguos: 'general' (gastos) y 'cuotas_mensuales' (descuentos)
// eran el fondo de cuotas.
const LEGACY = { general: 'cuotas', cuotas_mensuales: 'cuotas' };

export const normalizeFund = (value) => LEGACY[value] || value;

export const fundByKey = (value) => FUNDS.find((f) => f.key === normalizeFund(value)) || FUNDS[0];

export const fundLabel = (value) => fundByKey(value).label;
