const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');
const { FUND_VALUES } = require('../utils/funds');

const discountSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  amount:      { type: Number, required: true, min: [1, 'El monto debe ser mayor a 0.'], max: [MAX_AMOUNT, `El monto no puede superar ${MAX_AMOUNT}.`] },
  // Fondo del que se descuenta (ver utils/funds.js). 'cuotas_mensuales' solo
  // sobrevive en registros antiguos y se interpreta como 'cuotas'.
  source:      { type: String, enum: FUND_VALUES, required: true },
  category:    {
    type: String,
    enum: ['compra', 'convivencia', 'materiales', 'decoracion', 'otro'],
    default: 'otro',
  },
  date:        { type: Date, default: Date.now },
  // Huella del envío: el índice único convierte la detección de duplicados en atómica.
  dedupeKey:   { type: String, index: { unique: true, sparse: true } },
}, { timestamps: true });

module.exports = mongoose.model('Discount', discountSchema);
