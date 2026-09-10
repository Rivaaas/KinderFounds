const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  name:   { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });

// Respaldo a nivel de motor contra alumnos duplicados: el controlador ya avisa,
// pero bajo dos peticiones simultáneas solo el índice garantiza unicidad.
studentSchema.index({ name: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
