export const formatCLP = (amount) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount ?? 0);

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatMonth = (yyyyMM) => {
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' });
};

// Fecha local en formato AAAA-MM-DD.
//
// toISOString() devuelve la fecha en UTC: en Chile (UTC-3/-4), después de las 21:00
// ya es el día siguiente allá. Un pago registrado el lunes por la noche quedaba
// fechado el martes, y el último día del mes la app proponía el mes equivocado
// al generar cuotas. Se calcula con los getters locales.
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const currentMonth = () => todayISO().slice(0, 7);

export const PAYMENT_TYPE_LABELS = {
  cuota_mensual: 'Cuota Mensual',
  caja_chica: 'Caja Chica',
  actividad_18_septiembre: '18 de Septiembre',
  navidad: 'Navidad',
  paseo: 'Paseo',
  rifa: 'Rifa',
  aporte_voluntario: 'Aporte Voluntario',
  actividad: 'Cuota de Actividad',
  otro: 'Otro',
};

export const EXPENSE_CATEGORY_LABELS = {
  compra_actividad: 'Compra Actividad',
  materiales: 'Materiales',
  decoracion: 'Decoración',
  regalos: 'Regalos',
  comida: 'Comida',
  otro: 'Otro',
};

export const ACTIVITY_TYPE_LABELS = {
  '18_septiembre': '18 de Septiembre',
  navidad: 'Navidad',
  dia_nino: 'Día del Niño',
  paseo: 'Paseo',
  cumpleanos: 'Cumpleaños',
  rifa: 'Rifa',
  venta: 'Venta / Recaudación',
  otro: 'Otro',
};

export const STATUS_LABELS = { paid: 'Pagado', pending: 'Pendiente', cancelled: 'Anulado' };
// Etiquetas de fondo; los valores heredados ('general', 'cuotas_mensuales') eran el fondo de cuotas.
export const FUND_LABELS   = { cuotas: 'Cuotas Mensuales', actividades: 'Actividades', caja_chica: 'Caja Chica', general: 'Cuotas Mensuales', cuotas_mensuales: 'Cuotas Mensuales' };

export const FINE_REASON_LABELS = {
  inasistencia_actividad: 'Inasistencia a actividad',
  turno_tarea:            'No cumplir turno/tarea',
  dano_material:          'Daño de material',
  otro:                   'Otro',
};
