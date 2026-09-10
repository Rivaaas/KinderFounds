const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');

// Documento único de configuración del curso.
//
// Existe para el saldo inicial de caja chica: el dinero con que se parte y que no
// proviene de ningún movimiento registrado (un remanente del año anterior, por
// ejemplo). El saldo actual NO se guarda aquí: se calcula siempre a partir de
// este valor más los movimientos, para que no puedan desincronizarse.
const settingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'general' },
  pettyCashInitialBalance: {
    type: Number,
    default: 0,
    min: [0, 'El saldo inicial no puede ser negativo.'],
    max: [MAX_AMOUNT, `El saldo inicial no puede superar ${MAX_AMOUNT}.`],
  },
}, { timestamps: true });

// Devuelve la configuración creándola con valores por defecto la primera vez.
settingsSchema.statics.obtener = function () {
  return this.findOneAndUpdate(
    { key: 'general' },
    { $setOnInsert: { key: 'general' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);
