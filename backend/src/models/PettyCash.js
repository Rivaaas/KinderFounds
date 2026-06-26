const mongoose = require('mongoose');

const pettyCashSchema = new mongoose.Schema({
  type:    { type: String, enum: ['income', 'expense'], required: true },
  amount:  { type: Number, required: true, min: 0 },
  date:    { type: Date, default: Date.now },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
}, { timestamps: true });

module.exports = mongoose.model('PettyCash', pettyCashSchema);
