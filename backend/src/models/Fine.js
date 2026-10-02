const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');
const { FUNDS } = require('../utils/funds');

// Multa a un alumno (a su familia): un cobro extra, distinto de las cuotas.
//
// Nace pendiente. Al marcarla pagada, el tesorero elige a qué fondo entra el
// dinero (`paidFund`); desde ese momento suma al saldo de ese fondo en el
// dashboard y, si es caja chica, aparece en su libro. Anulada no se cobra ni
// se cuenta. El dinero NO se duplica como Payment: la multa es su propio
// registro, con una sola fuente de verdad.
const FINE_REASONS = ['inasistencia_actividad', 'turno_tarea', 'dano_material', 'otro'];

const fineSchema = new mongoose.Schema({
  student:     { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  reason:      { type: String, enum: FINE_REASONS, required: true },
  description: { type: String, default: '', trim: true },
  amount:      { type: Number, required: true, min: [1, 'El monto debe ser mayor a 0.'], max: [MAX_AMOUNT, `El monto no puede superar ${MAX_AMOUNT}.`] },
  date:        { type: Date, required: true, default: Date.now },
  status:      { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  // Solo con status 'paid': fondo que recibe el dinero y fecha del pago.
  paidFund:    { type: String, enum: FUNDS },
  paidAt:      { type: Date },
  // Huella del envío: el índice único convierte la detección de duplicados en atómica.
  dedupeKey:   { type: String, index: { unique: true, sparse: true } },
}, { timestamps: true });

fineSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('Fine', fineSchema);
module.exports.FINE_REASONS = FINE_REASONS;
