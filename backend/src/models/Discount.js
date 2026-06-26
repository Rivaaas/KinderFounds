const mongoose = require('mongoose');

const discountSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  amount:      { type: Number, required: true, min: 0 },
  source:      { type: String, enum: ['cuotas_mensuales', 'caja_chica'], required: true },
  category:    {
    type: String,
    enum: ['compra', 'convivencia', 'materiales', 'decoracion', 'otro'],
    default: 'otro',
  },
  date:        { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Discount', discountSchema);
