const mongoose = require('mongoose');
const { MAX_AMOUNT } = require('../utils/constants');

const activitySchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  type:        {
    type: String,
    enum: ['18_septiembre', 'navidad', 'dia_nino', 'paseo', 'cumpleanos', 'rifa', 'otro'],
    default: 'otro',
  },
  date:        { type: Date, required: true },
  description: { type: String, default: '' },
  observations:{ type: String, default: '' },
  students:    [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  status:      { type: String, enum: ['planned', 'active', 'completed'], default: 'planned' },
  // Cuota que debe aportar cada participante (0 = actividad sin cobro). Es el
  // monto que se registra al marcar "pagó"; cada pago puede ajustarse después.
  amountPerStudent: {
    type: Number, default: 0,
    min: [0, 'La cuota por alumno no puede ser negativa.'],
    max: [MAX_AMOUNT, `La cuota por alumno no puede superar ${MAX_AMOUNT}.`],
  },
  // Si la actividad aparece en la consulta pública (quiénes pagaron y quiénes no).
  // La tesorera puede ocultar una actividad sin borrarla.
  publicVisible: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
