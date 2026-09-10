const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');

const expenseSchema = new mongoose.Schema({
  category:    {
    type: String,
    enum: ['compra_actividad', 'materiales', 'decoracion', 'regalos', 'comida', 'otro'],
    required: true,
  },
  amount:      { type: Number, required: true, min: [1, 'El monto debe ser mayor a 0.'], max: [MAX_AMOUNT, `El monto no puede superar ${MAX_AMOUNT}.`] },
  date:        { type: Date, required: true, default: Date.now },
  description: { type: String, required: true },
  paymentMethod: { type: String, enum: ['efectivo', 'transferencia', 'debito', 'credito', 'otro'], default: 'efectivo' },
  fund:        { type: String, enum: ['general', 'caja_chica'], default: 'general' },
  activity:    { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
  // Huella del envío: el índice único convierte la detección de duplicados en atómica.
  dedupeKey:   { type: String, index: { unique: true, sparse: true } },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
