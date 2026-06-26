const Payment = require('../models/Payment');
const Student = require('../models/Student');

exports.getAll = async (req, res) => {
  const filter = {};
  if (req.query.type)    filter.type = req.query.type;
  if (req.query.status)  filter.status = req.query.status;
  if (req.query.month)   filter.month = req.query.month;
  if (req.query.student) filter.student = req.query.student;

  const payments = await Payment.find(filter)
    .populate('student', 'name')
    .populate('activity', 'name')
    .sort({ date: -1 });
  res.json(payments);
};

exports.getOne = async (req, res) => {
  const payment = await Payment.findById(req.params.id)
    .populate('student', 'name guardianName')
    .populate('activity', 'name');
  if (!payment) return res.status(404).json({ message: 'Pago no encontrado.' });
  res.json(payment);
};

exports.create = async (req, res) => {
  const { type, amount, date, student, description, status, month, activity, customType } = req.body;
  if (!type || amount === undefined)
    return res.status(400).json({ message: 'Tipo y monto son requeridos.' });
  if (amount < 0)
    return res.status(400).json({ message: 'El monto no puede ser negativo.' });

  const payment = await Payment.create({ type, amount, date, student, description, status, month, activity, customType });
  const populated = await payment.populate('student', 'name');
  res.status(201).json(populated);
};

exports.update = async (req, res) => {
  if (req.body.amount !== undefined && req.body.amount < 0)
    return res.status(400).json({ message: 'El monto no puede ser negativo.' });

  const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    .populate('student', 'name');
  if (!payment) return res.status(404).json({ message: 'Pago no encontrado.' });
  res.json(payment);
};

exports.remove = async (req, res) => {
  const payment = await Payment.findByIdAndDelete(req.params.id);
  if (!payment) return res.status(404).json({ message: 'Pago no encontrado.' });
  res.json({ message: 'Pago eliminado.' });
};

// Genera cuotas mensuales para todos los estudiantes activos de un mes dado
exports.generateMonthlyFees = async (req, res) => {
  const { month, amount, description } = req.body;
  if (!month || !amount)
    return res.status(400).json({ message: 'Mes y monto son requeridos.' });
  if (amount <= 0)
    return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });

  const students = await Student.find({ status: 'active' });
  if (students.length === 0)
    return res.status(400).json({ message: 'No hay estudiantes activos.' });

  // Evitar duplicados: eliminar cuotas pendientes del mismo mes si se pide regenerar
  await Payment.deleteMany({ type: 'cuota_mensual', month, status: 'pending' });

  const payments = students.map((s) => ({
    type: 'cuota_mensual',
    amount,
    date: new Date(),
    student: s._id,
    description: description || `Cuota mensual ${month}`,
    status: 'pending',
    month,
  }));

  await Payment.insertMany(payments);
  res.status(201).json({ message: `${payments.length} cuotas creadas para ${month}.` });
};

exports.getMonthSummary = async (req, res) => {
  const { month } = req.params;
  const payments = await Payment.find({ type: 'cuota_mensual', month })
    .populate('student', 'name guardianName guardianPhone');

  const totalExpected = payments.reduce((s, p) => s + p.amount, 0);
  const paid    = payments.filter((p) => p.status === 'paid');
  const pending = payments.filter((p) => p.status === 'pending');
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
