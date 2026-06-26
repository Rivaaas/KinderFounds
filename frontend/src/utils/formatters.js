export const formatCLP = (amount) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(amount ?? 0);

export const formatDate = (date) =>
  new Date(date).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatMonth = (yyyyMM) => {
  if (!yyyyMM) return '';
  const [y, m] = yyyyMM.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleString('es-CL', { month: 'long', year: 'numeric' });
};

export const currentMonth = () => new Date().toISOString().slice(0, 7);

export const PAYMENT_TYPE_LABELS = {
  cuota_mensual: 'Cuota Mensual',
  caja_chica: 'Caja Chica',
  actividad_18_septiembre: '18 de Septiembre',
  navidad: 'Navidad',
  paseo: 'Paseo',
  rifa: 'Rifa',
  aporte_voluntario: 'Aporte Voluntario',
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
  otro: 'Otro',
};

export const STATUS_LABELS = { paid: 'Pagado', pending: 'Pendiente', cancelled: 'Anulado' };
export const FUND_LABELS   = { general: 'Fondo General', caja_chica: 'Caja Chica' };
