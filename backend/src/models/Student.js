const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
