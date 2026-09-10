const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  name:     { type: String, required: true },
  // El valor por defecto es el de menor privilegio: si algún día se crea un
  // usuario sin especificar rol, que quede como solo lectura y no como
  // administrador. Todas las vías actuales fijan el rol explícitamente.
  role:     { type: String, enum: ['admin', 'viewer'], default: 'viewer' },
  active:   { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
