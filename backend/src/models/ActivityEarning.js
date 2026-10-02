const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');
const { FUNDS } = require('../utils/funds');

// Ganancia de una actividad: dinero que la actividad produjo por sí misma
// (venta de completos, rifa, kermesse...), distinto de las cuotas por alumno.
//
// Cada ganancia dice a qué fondo entra (`fund`), elegido por quien la registra.
// Una actividad puede tener varias (una por día de venta, por ejemplo). Es su
// propio registro: no se duplica como Payment ni como movimiento de caja chica.
const activityEarningSchema = new mongoose.Schema({
  activity:    { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true },
  amount:      { type: Number, required: true, min: [1, 'El monto debe ser mayor a 0.'], max: [MAX_AMOUNT, `El monto no puede superar ${MAX_AMOUNT}.`] },
  fund:        { type: String, enum: FUNDS, required: true },
  date:        { type: Date, required: true, default: Date.now },
  description: { type: String, default: '', trim: true },
  // Huella del envío: el índice único convierte la detección de duplicados en atómica.
  dedupeKey:   { type: String, index: { unique: true, sparse: true } },
}, { timestamps: true });

activityEarningSchema.index({ activity: 1, date: -1 });

module.exports = mongoose.model('ActivityEarning', activityEarningSchema);
