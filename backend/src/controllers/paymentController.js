const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Activity = require('../models/Activity');
const { parseAmount, parseDate, parseText, referenceExists, createDeduplicated } = require('../utils/validation');

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

exports.getAll = async (req, res) => {
  const filter = {};
  // Solo se aceptan filtros de texto plano: un objeto aquí se convertiría en un
  // operador de Mongo y expondría registros fuera del filtro pedido.
  for (const campo of ['type', 'status', 'month', 'student']) {
    const v = req.query[campo];
    if (v !== undefined && typeof v === 'string' && v !== '') filter[campo] = v;
  }
  if (filter.student && !require('mongoose').Types.ObjectId.isValid(filter.student))
    return res.status(400).json({ message: 'El alumno indicado en el filtro no es válido.' });

  const payments = await Payment.find(filter)
    .populate('student', 'name')
    .populate('activity', 'name')
    .sort({ date: -1 });
  res.json(payments);
};

exports.getOne = async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('student', 'name')
    .populate('activity', 'name');
  if (!payment) return res.status(404).json({ message: 'Pago no encontrado.' });
  res.json(payment);
};

exports.create = async (req, res) => {
  const { type, amount, date, student, description, status, month, activity, customType } = req.body;

  if (!type || typeof type !== 'string')
    return res.status(400).json({ message: 'El tipo de pago es requerido.' });

  const monto = parseAmount(amount);
  if (monto.error) return res.status(400).json({ message: monto.error });

  const fecha = parseDate(date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const desc = parseText(description, 'descripción');
  if (desc.error) return res.status(400).json({ message: desc.error });

  // Las referencias se comprueban antes de guardar para no dejar pagos apuntando
  // a alumnos o actividades inexistentes, que rompen el historial y los reportes.
  const alumno = await referenceExists(Student, student, 'alumno');
  if (alumno.error) return res.status(400).json({ message: alumno.error });

  const act = await referenceExists(Activity, activity, 'actividad');
  if (act.error) return res.status(400).json({ message: act.error });

  if (type === 'cuota_mensual') {
    if (!month || typeof month !== 'string' || !MES_REGEX.test(month))
      return res.status(400).json({ message: 'Una cuota mensual necesita un mes válido con formato AAAA-MM.' });
    if (!alumno.value)
      return res.status(400).json({ message: 'Una cuota mensual debe estar asociada a un alumno.' });

    const yaExiste = await Payment.findOne({ type: 'cuota_mensual', month, student: alumno.value });
    if (yaExiste)
      return res.status(409).json({ message: 'Ese alumno ya tiene una cuota registrada para ese mes.' });
  }

  // Protección contra doble click y reintentos de red: el mismo movimiento
  // enviado dos veces en segundos casi nunca es intencional, y en dinero un
  // duplicado silencioso descuadra la caja sin dejar rastro evidente.
  const resultado = await createDeduplicated(
    Payment,
    {
      type, amount: monto.value, date: fecha.value, student: alumno.value,
      description: desc.value, status, month, activity: act.value, customType,
    },
    {
      criterio: { type, amount: monto.value, student: alumno.value || null, month: month || null },
      huella: [type, monto.value, alumno.value, month, act.value],
      mensaje: 'Este pago ya se registró hace unos segundos. Revisa el listado antes de reintentar.',
    }
  );
  if (resultado.duplicate) return res.status(409).json({ message: resultado.message });

  const populated = await resultado.doc.populate('student', 'name');
  res.status(201).json(populated);
};

exports.update = async (req, res) => {
  const cambios = {};

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
  if (req.body.student !== undefined) {
    const alumno = await referenceExists(Student, req.body.student, 'alumno');
    if (alumno.error) return res.status(400).json({ message: alumno.error });
    cambios.student = alumno.value || null;
  }
  if (req.body.activity !== undefined) {
    const act = await referenceExists(Activity, req.body.activity, 'actividad');
    if (act.error) return res.status(400).json({ message: act.error });
    cambios.activity = act.value || null;
  }
  // Solo se acepta modificar campos conocidos: evita que un body manipulado
  // escriba propiedades arbitrarias en el documento.
  for (const campo of ['type', 'status', 'description', 'month', 'customType']) {
    if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
  }

  const payment = await Payment.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true })
    .populate('student', 'name');
  if (!payment) return res.status(404).json({ message: 'Pago no encontrado.' });
  res.json(payment);
};

exports.remove = async (req, res) => {
  const payment = await Payment.findByIdAndDelete(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Pago no encontrado.' });
  res.json({ message: 'Pago eliminado.' });
};

// Genera las cuotas del mes solo para los alumnos activos que aún no la tienen.
//
// La versión anterior borraba las cuotas pendientes y volvía a crearlas para
// TODOS los alumnos activos: quien ya había pagado quedaba con su cuota pagada
// más una nueva pendiente, es decir, cobrado dos veces por el mismo mes.
exports.generateMonthlyFees = async (req, res) => {
  const { month, amount, description } = req.body;

  if (!month || typeof month !== 'string' || !MES_REGEX.test(month))
    return res.status(400).json({ message: 'Indica un mes válido con formato AAAA-MM.' });

  const monto = parseAmount(amount);
  if (monto.error) return res.status(400).json({ message: monto.error });

  const desc = parseText(description, 'descripción');
  if (desc.error) return res.status(400).json({ message: desc.error });

  const students = await Student.find({ status: 'active' });
  if (students.length === 0)
    return res.status(400).json({ message: 'No hay estudiantes activos.' });

  const existentes = await Payment.find({ type: 'cuota_mensual', month }).select('student');
  const yaTienen = new Set(existentes.map((p) => String(p.student)));

  const nuevas = students
    .filter((s) => !yaTienen.has(String(s._id)))
    .map((s) => ({
      type: 'cuota_mensual',
      amount: monto.value,
      date: new Date(),
      student: s._id,
      description: desc.value || `Cuota mensual ${month}`,
      status: 'pending',
      month,
    }));

  if (nuevas.length === 0) {
    return res.status(200).json({
      message: `Todos los alumnos activos ya tienen su cuota de ${month}. No se creó ninguna nueva.`,
      created: 0, skipped: students.length,
    });
  }

  // ordered:false + índice único: si dos peticiones simultáneas intentan crear la
  // misma cuota, la segunda choca contra el índice en vez de duplicar el cobro.
  try {
    await Payment.insertMany(nuevas, { ordered: false });
  } catch (err) {
    if (err.code !== 11000 && !err.writeErrors) throw err;
  }

  const total = await Payment.countDocuments({ type: 'cuota_mensual', month });
  res.status(201).json({
    message: `${nuevas.length} cuotas creadas para ${month}.` +
      (yaTienen.size ? ` ${yaTienen.size} alumnos ya la tenían y se respetaron.` : ''),
    created: nuevas.length,
    skipped: yaTienen.size,
    total,
  });
};

exports.getMonthSummary = async (req, res) => {
  const { month } = req.params;
  if (!MES_REGEX.test(month))
    return res.status(400).json({ message: 'El mes debe tener formato AAAA-MM.' });

  const payments = await Payment.find({ type: 'cuota_mensual', month }).populate('student', 'name');

  const totalExpected = payments.reduce((s, p) => s + p.amount, 0);
  const paid      = payments.filter((p) => p.status === 'paid');
  const pending   = payments.filter((p) => p.status === 'pending');
  const cancelled = payments.filter((p) => p.status === 'cancelled');

  res.json({
    month,
    totalExpected,
    totalPaid:    paid.reduce((s, p) => s + p.amount, 0),
    totalPending: pending.reduce((s, p) => s + p.amount, 0),
    paid,
    pending,
    cancelled,
  });
};
