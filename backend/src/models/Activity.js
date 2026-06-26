const mongoose = require('mongoose');

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
}, { timestamps: true });

module.exports = mongoose.model('Activity', activitySchema);
