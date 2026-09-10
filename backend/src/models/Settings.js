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

const PREDETERMINADOS = { key: 'general', pettyCashInitialBalance: 0 };

// Lectura sin efectos secundarios: si el documento no existe devuelve los valores
// por defecto en memoria, sin crearlo.
//
// Es lo que usan el dashboard, los reportes y la caja chica, que son endpoints
// GET alcanzables por un perfil de solo lectura. Un GET que escribe en la base
// contradice la promesa del rol y rompería con un usuario de base de datos sin
// permisos de escritura.
settingsSchema.statics.leer = async function () {
  const doc = await this.findOne({ key: 'general' }).lean();
  return doc || { ...PREDETERMINADOS };
};

// Devuelve la configuración creándola la primera vez. Solo para el camino de
// escritura, que ya exige perfil de administrador.
settingsSchema.statics.obtener = function () {
  return this.findOneAndUpdate(
    { key: 'general' },
    { $setOnInsert: { key: 'general' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);
