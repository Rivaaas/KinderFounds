const Activity = require('../models/Activity');
const Payment  = require('../models/Payment');
const Expense  = require('../models/Expense');
const Student  = require('../models/Student');
const ActivityEarning = require('../models/ActivityEarning');
const { parseDate, parseText, parseAmount, isValidId, createDeduplicated } = require('../utils/validation');
const { FUNDS, parseFund } = require('../utils/funds');

// Totales de ganancias de una actividad: total y cuánto entró a cada fondo.
const resumirGanancias = (earnings) => {
  const byFund = Object.fromEntries(FUNDS.map((k) => [k, 0]));
  for (const e of earnings) byFund[e.fund] += e.amount;
  return { total: earnings.reduce((s, e) => s + e.amount, 0), count: earnings.length, byFund };
};
exports._resumirGanancias = resumirGanancias;

// Cuota por alumno: opcional, admite 0 (actividad sin cobro).
const parseCuota = (value) => {
  if (value === undefined || value === null || value === '') return { value: undefined };
  if (value === 0 || value === '0') return { value: 0 };
  const m = parseAmount(value, 'cuota por alumno');
  return m.error ? { error: m.error } : { value: m.value };
};

const ESTADOS_PAGO = ['paid', 'pending', 'cancelled'];

// Lista de participantes con el estado de su cuota. Un alumno con pago registrado
// pero que ya no figura en la lista de participantes se incluye igual: su dinero
// existe y debe verse. Los anulados no cuentan como pagados ni como pendientes.
const construirNomina = (activity, pagosActividad) => {
  const porAlumno = new Map(pagosActividad.map((p) => [String(p.student?._id || p.student), p]));
  const participantes = new Map((activity.students || []).map((s) => [String(s._id), s]));
  for (const p of pagosActividad) {
    const id = String(p.student?._id || p.student);
    if (!participantes.has(id) && p.student?.name) participantes.set(id, p.student);
  }

  const roster = [...participantes.values()]
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'))
    .map((s) => {
      const p = porAlumno.get(String(s._id));
      return {
        student: { _id: s._id, name: s.name },
        status: p ? p.status : 'pending',
        amount: p ? p.amount : activity.amountPerStudent || 0,
        date: p ? p.date : null,
        paymentId: p ? p._id : null,
      };
    });

  const paidCount    = roster.filter((r) => r.status === 'paid').length;
  const pendingCount = roster.filter((r) => r.status === 'pending').length;
  const collected    = roster.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount, 0);
  const expected     = collected + roster.filter((r) => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  return { roster, totals: { paidCount, pendingCount, collected, expected, pending: expected - collected } };
};
exports._construirNomina = construirNomina;

exports.getAll = async (req, res) => {
  const activities = await Activity.find().populate('students', 'name').sort({ date: -1 }).lean();
  // Resumen de recaudación por tarjeta, en una sola consulta para todas.
  const pagos = await Payment.find({ type: 'actividad', activity: { $in: activities.map((a) => a._id) } })
    .select('activity student status amount').lean();
  const ganancias = await ActivityEarning.find({ activity: { $in: activities.map((a) => a._id) } })
    .select('activity amount fund').lean();
  const porActividad = new Map();
  for (const p of pagos) {
    const k = String(p.activity);
    if (!porActividad.has(k)) porActividad.set(k, []);
    porActividad.get(k).push(p);
  }
  const gananciasPor = new Map();
  for (const g of ganancias) {
    const k = String(g.activity);
    if (!gananciasPor.has(k)) gananciasPor.set(k, []);
    gananciasPor.get(k).push(g);
  }
  res.json(activities.map((a) => {
    const { totals } = construirNomina(a, porActividad.get(String(a._id)) || []);
    return { ...a, totals, earnings: resumirGanancias(gananciasPor.get(String(a._id)) || []) };
  }));
};

exports.getOne = async (req, res) => {
  const activity = await Activity.findById(req.params.id).populate('students', 'name');
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });

  const [income, expenses, pagosActividad, earnings] = await Promise.all([
    Payment.find({ activity: activity._id, status: 'paid' }),
    Expense.find({ activity: activity._id }),
    Payment.find({ activity: activity._id, type: 'actividad' }).populate('student', 'name'),
    ActivityEarning.find({ activity: activity._id }).sort({ date: -1, createdAt: -1 }),
  ]);

  const ganancias = resumirGanancias(earnings);
  // Ingreso total de la actividad = cuotas de alumnos pagadas + ganancias propias.
  const totalIncome  = income.reduce((s, p) => s + p.amount, 0) + ganancias.total;
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const { roster, totals } = construirNomina(activity, pagosActividad);

  res.json({
    activity, income, expenses, totalIncome, totalExpense, balance: totalIncome - totalExpense, roster, totals,
    earnings, earningEntries: earnings,
  });
};

// Comprueba que todos los alumnos indicados existan antes de asociarlos.
const validarAlumnos = async (students) => {
  if (students === undefined) return { value: undefined };
  if (!Array.isArray(students)) return { error: 'La lista de alumnos no es válida.' };
  if (students.length === 0) return { value: [] };
  if (!students.every(isValidId)) return { error: 'Hay alumnos con identificador inválido en la lista.' };

  const encontrados = await Student.countDocuments({ _id: { $in: students } });
  if (encontrados !== new Set(students.map(String)).size)
    return { error: 'Algún alumno de la lista no existe.' };

  return { value: students };
};

exports.create = async (req, res) => {
  const { name, type, date, description, observations, students, status } = req.body;

  const nombre = parseText(name, 'nombre', { required: true, max: 120 });
  if (nombre.error) return res.status(400).json({ message: nombre.error });

  const fecha = parseDate(date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });
  if (!fecha.value) return res.status(400).json({ message: 'La fecha de la actividad es requerida.' });

  const alumnos = await validarAlumnos(students);
  if (alumnos.error) return res.status(400).json({ message: alumnos.error });

  const cuota = parseCuota(req.body.amountPerStudent);
  if (cuota.error) return res.status(400).json({ message: cuota.error });

  const activity = await Activity.create({
    name: nombre.value, type, date: fecha.value, description, observations,
    students: alumnos.value, status,
    amountPerStudent: cuota.value,
    publicVisible: req.body.publicVisible === undefined ? undefined : Boolean(req.body.publicVisible),
  });
  res.status(201).json(activity);
};

exports.update = async (req, res) => {
  const cambios = {};

  if (req.body.name !== undefined) {
    const nombre = parseText(req.body.name, 'nombre', { required: true, max: 120 });
    if (nombre.error) return res.status(400).json({ message: nombre.error });
    cambios.name = nombre.value;
  }
  if (req.body.date !== undefined) {
    const fecha = parseDate(req.body.date);
    if (fecha.error) return res.status(400).json({ message: fecha.error });
    cambios.date = fecha.value;
  }
  if (req.body.students !== undefined) {
    const alumnos = await validarAlumnos(req.body.students);
    if (alumnos.error) return res.status(400).json({ message: alumnos.error });
    cambios.students = alumnos.value;
  }
  if (req.body.amountPerStudent !== undefined) {
    const cuota = parseCuota(req.body.amountPerStudent);
    if (cuota.error) return res.status(400).json({ message: cuota.error });
    cambios.amountPerStudent = cuota.value;
  }
  if (req.body.publicVisible !== undefined) cambios.publicVisible = Boolean(req.body.publicVisible);
  for (const campo of ['type', 'description', 'observations', 'status']) {
    if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
  }

  const activity = await Activity.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });
  res.json(activity);
};

// Eliminar una actividad con movimientos dejaba pagos y gastos apuntando a algo
// inexistente: el dinero seguía en los totales pero su origen desaparecía del
// reporte por actividad. Se exige desasociar los movimientos primero.
exports.remove = async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });

  const [pagos, gastos, ganancias] = await Promise.all([
    Payment.countDocuments({ activity: activity._id }),
    Expense.countDocuments({ activity: activity._id }),
    ActivityEarning.countDocuments({ activity: activity._id }),
  ]);

  if (pagos > 0 || gastos > 0 || ganancias > 0)
    return res.status(409).json({
      message: `"${activity.name}" tiene ${pagos} pagos, ${gastos} gastos y ${ganancias} ganancias asociadas. ` +
               'Reasígnalos o elimínalos antes de borrar la actividad.',
    });

  await activity.deleteOne();
  res.json({ message: 'Actividad eliminada.' });
};

// PUT /activities/:id/students/:studentId/payment  { status, amount?, date? }
//
// Registra o actualiza la cuota de un alumno en la actividad. Es un "upsert": el
// índice único alumno+actividad garantiza un solo registro aunque lleguen dos
// clics simultáneos. El monto por defecto es la cuota de la actividad.
exports.setStudentPayment = async (req, res) => {
  const { id, studentId } = req.params;
  if (!isValidId(studentId)) return res.status(400).json({ message: 'El alumno indicado no es válido.' });

  const [activity, student] = await Promise.all([Activity.findById(id), Student.findById(studentId)]);
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });
  if (!student)  return res.status(404).json({ message: 'Alumno no encontrado.' });

  const status = req.body.status === undefined ? 'paid' : req.body.status;
  if (!ESTADOS_PAGO.includes(status))
    return res.status(400).json({ message: 'El estado debe ser paid, pending o cancelled.' });

  let amount = activity.amountPerStudent || 0;
  if (req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '') {
    const m = parseAmount(req.body.amount);
    if (m.error) return res.status(400).json({ message: m.error });
    amount = m.value;
  }
  // El modelo exige monto > 0: una actividad sin cuota no puede registrar pagos.
  if (amount <= 0)
    return res.status(400).json({ message: 'Define la cuota por alumno de la actividad (o indica un monto) antes de registrar pagos.' });

  const fecha = parseDate(req.body.date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const cambios = { amount, status, description: activity.name };
  if (fecha.value) cambios.date = fecha.value;
  else if (status === 'paid') cambios.date = new Date();

  const payment = await Payment.findOneAndUpdate(
    { type: 'actividad', activity: activity._id, student: student._id },
    { $set: cambios, $setOnInsert: { type: 'actividad', activity: activity._id, student: student._id } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  ).populate('student', 'name');

  // Quien paga pasa a ser participante aunque no estuviera en la lista.
  if (!activity.students.some((s) => String(s) === String(student._id))) {
    await Activity.updateOne({ _id: activity._id }, { $addToSet: { students: student._id } });
  }

  res.json(payment);
};

// DELETE /activities/:id/students/:studentId/payment
// Quita el registro de cuota del alumno (vuelve a "sin registro" = pendiente).
exports.removeStudentPayment = async (req, res) => {
  const { id, studentId } = req.params;
  if (!isValidId(studentId)) return res.status(400).json({ message: 'El alumno indicado no es válido.' });
  const borrado = await Payment.findOneAndDelete({ type: 'actividad', activity: id, student: studentId });
  if (!borrado) return res.status(404).json({ message: 'Ese alumno no tiene cuota registrada en esta actividad.' });
  res.json({ message: 'Registro eliminado.' });
};


// --- Ganancias de la actividad -------------------------------------------
//
// Dinero que la actividad produjo (lo que se ganó vendiendo completos, por
// ejemplo). Cada registro dice a qué fondo entra; el dashboard lo suma allí.

// POST /activities/:id/earnings  { amount, fund, date?, description? }
exports.addEarning = async (req, res) => {
  const activity = await Activity.findById(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });

  const monto = parseAmount(req.body.amount, 'monto ganado');
  if (monto.error) return res.status(400).json({ message: monto.error });

  const fondo = parseFund(req.body.fund, { required: true, campo: 'fondo al que se suma' });
  if (fondo.error) return res.status(400).json({ message: fondo.error });

  const fecha = parseDate(req.body.date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const desc = parseText(req.body.description, 'descripción', { max: 200 });
  if (desc.error) return res.status(400).json({ message: desc.error });

  const resultado = await createDeduplicated(
    ActivityEarning,
    { activity: activity._id, amount: monto.value, fund: fondo.value, date: fecha.value || activity.date, description: desc.value || '' },
    {
      criterio: { activity: activity._id, amount: monto.value, fund: fondo.value },
      huella: [activity._id, monto.value, fondo.value, desc.value],
      mensaje: 'Esta ganancia ya se registró hace unos segundos. Revisa el listado antes de reintentar.',
    }
  );
  if (resultado.duplicate) return res.status(409).json({ message: resultado.message });

  res.status(201).json(resultado.doc);
};

// PUT /activities/:id/earnings/:earningId  { amount?, fund?, date?, description? }
exports.updateEarning = async (req, res) => {
  const cambios = {};
  if (req.body.amount !== undefined) {
    const monto = parseAmount(req.body.amount, 'monto ganado');
    if (monto.error) return res.status(400).json({ message: monto.error });
    cambios.amount = monto.value;
  }
  if (req.body.fund !== undefined) {
    const fondo = parseFund(req.body.fund, { required: true, campo: 'fondo al que se suma' });
    if (fondo.error) return res.status(400).json({ message: fondo.error });
    cambios.fund = fondo.value;
  }
  if (req.body.date !== undefined) {
    const fecha = parseDate(req.body.date);
    if (fecha.error) return res.status(400).json({ message: fecha.error });
    cambios.date = fecha.value;
  }
  if (req.body.description !== undefined) {
    const desc = parseText(req.body.description, 'descripción', { max: 200 });
    if (desc.error) return res.status(400).json({ message: desc.error });
    cambios.description = desc.value || '';
  }

  const earning = await ActivityEarning.findOneAndUpdate(
    { _id: req.params.earningId, activity: req.params.id },
    cambios, { new: true, runValidators: true }
  );
  if (!earning) return res.status(404).json({ message: 'Ganancia no encontrada.' });
  res.json(earning);
};

// DELETE /activities/:id/earnings/:earningId
exports.removeEarning = async (req, res) => {
  const earning = await ActivityEarning.findOneAndDelete({ _id: req.params.earningId, activity: req.params.id });
  if (!earning) return res.status(404).json({ message: 'Ganancia no encontrada.' });
  res.json({ message: 'Ganancia eliminada.' });
};
