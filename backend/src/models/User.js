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
  // Momento del último cambio de contraseña, informativo.
  passwordChangedAt: { type: Date },
  // Versión de las sesiones. Cada cambio de contraseña la incrementa y el token
  // lleva la versión con la que se emitió: si no coinciden, la sesión ya no vale.
  // Sin esto, cambiar o resetear la clave NO expulsaba a quien ya tuviera un
  // token, que seguía sirviendo hasta expirar (7 días). Se usa un contador y no
  // la fecha porque 'iat' del JWT va en segundos y una comparación por tiempo
  // deja pasar tokens emitidos en el mismo segundo del cambio.
  tokenVersion: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
