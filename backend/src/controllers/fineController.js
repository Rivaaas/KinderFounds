const Fine    = require('../models/Fine');
const Student = require('../models/Student');
const { FINE_REASONS } = Fine;
const { parseAmount, parseDate, parseText, referenceExists, isValidId, createDeduplicated } = require('../utils/validation');
const { FUNDS, parseFund } = require('../utils/funds');

const FINE_REASON_LABELS = {
  inasistencia_actividad: 'Inasistencia a actividad',
  turno_tarea:            'No cumplir turno/tarea',
  dano_material:          'Daño de material',
  otro:                   'Otro',
};

const sum = (rows) => rows.reduce((s, r) => s + r.amount, 0);

const parseReason = (value) => {
  if (!value || typeof value !== 'string') return { error: 'El motivo de la multa es requerido.' };
  if (!FINE_REASONS.includes(value)) return { error: `El motivo debe ser uno de: ${FINE_REASONS.join(', ')}.` };
  return { value };
};

// Totales que acompañan a cualquier listado: pendiente, pagado y, de lo pagado,
// cuánto entró a cada fondo.
const resumir = (fines) => {
  const vigentes = fines.filter((f) => f.status !== 'cancelled');
  const pagadas  = vigentes.filter((f) => f.status === 'paid');
  const byFund = Object.fromEntries(FUNDS.map((k) => [k, 0]));
  for (const f of pagadas) if (f.paidFund) byFund[f.paidFund] += f.amount;
  return {
    pending:      sum(vigentes.filter((f) => f.status === 'pending')),
    paid:         sum(pagadas),
    cancelled:    sum(fines.filter((f) => f.status === 'cancelled')),
    pendingCount: vigentes.filter((f) => f.status === 'pending').length,
    paidCount:    pagadas.length,
    byFund,
  };
};

// GET /api/fines?student=&status=&reason=
exports.getAll = async (req, res) => {
  const filter = {};
  if (typeof req.query.student === 'string' && req.query.student) {
    if (!isValidId(req.query.student)) return res.status(400).json({ message: 'El alumno indicado no es válido.' });
    filter.student = req.query.student;
  }
  if (typeof req.query.status === 'string' && req.query.status) {
    if (!['pending', 'paid', 'cancelled'].includes(req.query.status)) return res.status(400).json({ message: 'El estado indicado no existe.' });
    filter.status = req.query.status;
  }
  if (typeof req.query.reason === 'string' && req.query.reason) {
    const motivo = parseReason(req.query.reason);
    if (motivo.error) return res.status(400).json({ message: motivo.error });
    filter.reason = motivo.value;
  }

  const fines = await Fine.find(filter).populate('student', 'name status').sort({ date: -1, createdAt: -1 });
  res.json({ fines, totals: resumir(fines), reasons: FINE_REASON_LABELS });
};

// POST /api/fines  { student, reason, description?, amount, date? }
exports.create = async (req, res) => {
  const { student, reason, description, amount, date } = req.body;

  const alumno = await referenceExists(Student, student, 'alumno');
  if (alumno.error) return res.status(400).json({ message: alumno.error });
  if (!alumno.value) return res.status(400).json({ message: 'El alumno es requerido.' });

  const motivo = parseReason(reason);
  if (motivo.error) return res.status(400).json({ message: motivo.error });

  // Con motivo "otro" la descripción es lo único que explica la multa.
  const desc = parseText(description, 'descripción', { required: motivo.value === 'otro' });
  if (desc.error) return res.status(400).json({ message: desc.error });

  const monto = parseAmount(amount);
  if (monto.error) return res.status(400).json({ message: monto.error });

  const fecha = parseDate(date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const resultado = await createDeduplicated(
    Fine,
    { student: alumno.value, reason: motivo.value, description: desc.value || '', amount: monto.value, date: fecha.value },
    {
      criterio: { student: alumno.value, reason: motivo.value, amount: monto.value },
      huella: [alumno.value, motivo.value, monto.value, desc.value],
      mensaje: 'Esta multa ya se registró hace unos segundos. Revisa el listado antes de reintentar.',
    }
  );
  if (resultado.duplicate) return res.status(409).json({ message: resultado.message });

  const fine = await Fine.findById(resultado.doc._id).populate('student', 'name status');
  res.status(201).json(fine);
};

// PUT /api/fines/:id  — edita motivo, descripción, monto, fecha o alumno.
// El estado y el fondo se cambian con /pay y /unpay para que el dinero nunca
// cambie de fondo "sin querer" al editar otra cosa.
exports.update = async (req, res) => {
  const cambios = {};

  if (req.body.student !== undefined) {
    const alumno = await referenceExists(Student, req.body.student, 'alumno');
    if (alumno.error) return res.status(400).json({ message: alumno.error });
    if (!alumno.value) return res.status(400).json({ message: 'El alumno es requerido.' });
    cambios.student = alumno.value;
  }
  if (req.body.reason !== undefined) {
    const motivo = parseReason(req.body.reason);
    if (motivo.error) return res.status(400).json({ message: motivo.error });
    cambios.reason = motivo.value;
  }
  if (req.body.description !== undefined) {
    const desc = parseText(req.body.description, 'descripción');
    if (desc.error) return res.status(400).json({ message: desc.error });
    cambios.description = desc.value || '';
  }
  if (req.body.amount !== undefined) {
    const monto = parseAmount(req.body.amount);
    if (monto.error) return res.status(400).json({ message: monto.error });
    cambios.amount = monto.value;
  }
  if (req.body.date !== undefined) {
    const fecha = parseDate(req.body.date);
    if (fecha.error) return res.status(400).json({ message: fecha.error });
    cambios.date = fecha.value;
  }
  // Anular / reactivar es una edición de estado sin dinero de por medio.
  if (req.body.status !== undefined) {
    if (!['pending', 'cancelled'].includes(req.body.status))
      return res.status(400).json({ message: 'Para marcar una multa como pagada usa la acción "Marcar pagada".' });
    cambios.status = req.body.status;
  }

  // Al anular o reactivar se borra cualquier rastro de pago.
  const update = cambios.status ? { $set: cambios, $unset: { paidFund: 1, paidAt: 1 } } : { $set: cambios };
  const fine = await Fine.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).populate('student', 'name status');
  if (!fine) return res.status(404).json({ message: 'Multa no encontrada.' });
  res.json(fine);
};

// PUT /api/fines/:id/pay  { fund, date? }
// Marca la multa pagada y dice a qué fondo entra el dinero. Se puede volver a
// llamar sobre una multa pagada para corregir el fondo o la fecha.
exports.pay = async (req, res) => {
  const fondo = parseFund(req.body.fund, { required: true, campo: 'fondo que recibe el pago' });
  if (fondo.error) return res.status(400).json({ message: fondo.error });

  const fecha = parseDate(req.body.date, 'fecha de pago');
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const fine = await Fine.findById(req.params.id);
  if (!fine) return res.status(404).json({ message: 'Multa no encontrada.' });
  if (fine.status === 'cancelled') return res.status(400).json({ message: 'Una multa anulada no se puede marcar como pagada.' });

  fine.status = 'paid';
  fine.paidFund = fondo.value;
  fine.paidAt = fecha.value || fine.paidAt || new Date();
  await fine.save();

  res.json(await Fine.findById(fine._id).populate('student', 'name status'));
};

// PUT /api/fines/:id/unpay — deshace el pago: vuelve a pendiente y el dinero
// sale del fondo al que había entrado.
exports.unpay = async (req, res) => {
  const fine = await Fine.findById(req.params.id);
  if (!fine) return res.status(404).json({ message: 'Multa no encontrada.' });
  if (fine.status !== 'paid') return res.status(400).json({ message: 'Esta multa no está marcada como pagada.' });

  fine.status = 'pending';
  fine.paidFund = undefined;
  fine.paidAt = undefined;
  await fine.save();

  res.json(await Fine.findById(fine._id).populate('student', 'name status'));
};

exports.remove = async (req, res) => {
  const fine = await Fine.findByIdAndDelete(req.params.id);
  if (!fine) return res.status(404).json({ message: 'Multa no encontrada.' });
  res.json({ message: 'Multa eliminada.' });
};

exports.FINE_REASON_LABELS = FINE_REASON_LABELS;
exports._resumir = resumir;
