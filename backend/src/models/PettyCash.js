const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');

const pettyCashSchema = new mongoose.Schema({
  type:    { type: String, enum: ['income', 'expense'], required: true },
  amount:  { type: Number, required: true, min: [1, 'El monto debe ser mayor a 0.'], max: [MAX_AMOUNT, `El monto no puede superar ${MAX_AMOUNT}.`] },
  date:    { type: Date, default: Date.now },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  // Huella del envío: el índice único convierte la detección de duplicados en atómica.
  dedupeKey:   { type: String, index: { unique: true, sparse: true } },
}, { timestamps: true });

module.exports = mongoose.model('PettyCash', pettyCashSchema);
