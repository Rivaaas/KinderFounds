const Activity = require('../models/Activity');
const Payment  = require('../models/Payment');
const Expense  = require('../models/Expense');
const Student  = require('../models/Student');
const { parseDate, parseText, isValidId } = require('../utils/validation');

exports.getAll = async (req, res) => {
  const activities = await Activity.find().populate('students', 'name').sort({ date: -1 });
  res.json(activities);
};

exports.getOne = async (req, res) => {
  const activity = await Activity.findById(req.params.id).populate('students', 'name');
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });

  const [income, expenses] = await Promise.all([
    Payment.find({ activity: activity._id, status: 'paid' }),
    Expense.find({ activity: activity._id }),
  ]);

  const totalIncome  = income.reduce((s, p) => s + p.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  res.json({ activity, income, expenses, totalIncome, totalExpense, balance: totalIncome - totalExpense });
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

  const activity = await Activity.create({
    name: nombre.value, type, date: fecha.value, description, observations,
    students: alumnos.value, status,
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

  const [pagos, gastos] = await Promise.all([
    Payment.countDocuments({ activity: activity._id }),
    Expense.countDocuments({ activity: activity._id }),
  ]);

  if (pagos > 0 || gastos > 0)
    return res.status(409).json({
      message: `"${activity.name}" tiene ${pagos} pagos y ${gastos} gastos asociados. ` +
               'Reasígnalos o elimínalos antes de borrar la actividad.',
    });

  await activity.deleteOne();
  res.json({ message: 'Actividad eliminada.' });
};
