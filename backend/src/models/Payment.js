const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');

const PAYMENT_TYPES = [
  'cuota_mensual',
  'caja_chica',
  'actividad_18_septiembre',
  'navidad',
  'paseo',
  'rifa',
  'aporte_voluntario',
  // Cuota de una actividad concreta (stand, paseo, regalo...): siempre lleva
  // `activity` y `student`. Se registra desde la pantalla Actividades y Cuotas.
  'actividad',
  'otro',
];

const paymentSchema = new mongoose.Schema({
  type:        { type: String, enum: PAYMENT_TYPES, required: true },
  amount:      { type: Number, required: true, min: [1, 'El monto debe ser mayor a 0.'], max: [MAX_AMOUNT, `El monto no puede superar ${MAX_AMOUNT}.`] },
  date:        { type: Date, required: true, default: Date.now },
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  description: { type: String, default: '' },
  status:      { type: String, enum: ['paid', 'pending', 'cancelled'], default: 'pending' },
  month:       { type: String }, // formato 'YYYY-MM' para cuotas mensuales
  activity:    { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
  customType:  { type: String }, // cuando type === 'otro'
  // Huella del envío: el índice único convierte la detección de duplicados en atómica.
  dedupeKey:   { type: String, index: { unique: true, sparse: true } },
}, { timestamps: true });

// Una cuota mensual es única por alumno y mes. El índice parcial deja fuera los
// demás tipos de pago, donde sí pueden existir varios registros equivalentes.
paymentSchema.index(
  { student: 1, month: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'cuota_mensual', student: { $exists: true }, month: { $exists: true } } }
);

// La cuota de una actividad es única por alumno y actividad: el índice hace
// atómico el "marcar pagado" aunque lleguen dos clics a la vez.
paymentSchema.index(
  { student: 1, activity: 1, type: 1 },
  { unique: true, partialFilterExpression: { type: 'actividad', student: { $exists: true }, activity: { $exists: true } } }
);

module.exports = mongoose.model('Payment', paymentSchema);
