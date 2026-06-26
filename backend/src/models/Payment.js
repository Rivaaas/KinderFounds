const mongoose = require('mongoose');

const PAYMENT_TYPES = [
  'cuota_mensual',
  'caja_chica',
  'actividad_18_septiembre',
  'navidad',
  'paseo',
  'rifa',
  'aporte_voluntario',
  'otro',
];

const paymentSchema = new mongoose.Schema({
  type:        { type: String, enum: PAYMENT_TYPES, required: true },
  amount:      { type: Number, required: true, min: 0 },
  date:        { type: Date, required: true, default: Date.now },
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  description: { type: String, default: '' },
  status:      { type: String, enum: ['paid', 'pending', 'cancelled'], default: 'pending' },
  month:       { type: String }, // formato 'YYYY-MM' para cuotas mensuales
  activity:    { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
  customType:  { type: String }, // cuando type === 'otro'
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
