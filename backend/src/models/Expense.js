const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  category:    {
    type: String,
    enum: ['compra_actividad', 'materiales', 'decoracion', 'regalos', 'comida', 'otro'],
    required: true,
  },
  amount:      { type: Number, required: true, min: 0 },
  date:        { type: Date, required: true, default: Date.now },
  description: { type: String, required: true },
  paymentMethod: { type: String, enum: ['efectivo', 'transferencia', 'debito', 'credito', 'otro'], default: 'efectivo' },
  fund:        { type: String, enum: ['general', 'caja_chica'], default: 'general' },
  activity:    { type: mongoose.Schema.Types.ObjectId, ref: 'Activity' },
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);
