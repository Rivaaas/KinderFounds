const Payment  = require('../models/Payment');
const Expense  = require('../models/Expense');
const Student  = require('../models/Student');
const Activity = require('../models/Activity');
const Fine     = require('../models/Fine');
const { getPettyCashLedger } = require('../utils/balances');

exports.getGeneral = async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from || to) {
    dateFilter.date = {};
    if (from) dateFilter.date.$gte = new Date(from);
    if (to)   dateFilter.date.$lte = new Date(to);
  }

  const [payments, expenses] = await Promise.all([
    Payment.find({ ...dateFilter, status: 'paid' }).populate('student', 'name').populate('activity', 'name'),
    Expense.find(dateFilter).populate('activity', 'name'),
  ]);

  const totalIncome  = payments.reduce((s, p) => s + p.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  res.json({ payments, expenses, totalIncome, totalExpense, balance: totalIncome - totalExpense });
};

exports.getByStudent = async (req, res) => {
  const { studentId } = req.params;
  const student = await Student.findById(studentId);
  if (!student) return res.status(404).json({ message: 'Estudiante no encontrado.' });

  const [payments, fines] = await Promise.all([
    Payment.find({ student: studentId }).sort({ date: -1 }),
    Fine.find({ student: studentId, status: { $ne: 'cancelled' } }).sort({ date: -1 }),
  ]);
  const totalPaid    = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
  const finesPaid    = fines.filter((f) => f.status === 'paid').reduce((s, f) => s + f.amount, 0);
  const finesPending = fines.filter((f) => f.status === 'pending').reduce((s, f) => s + f.amount, 0);

  res.json({ student, payments, fines, totalPaid, totalPending, finesPaid, finesPending });
};

exports.getByMonth = async (req, res) => {
  const { month } = req.params;
  // Solo el nombre: pedir campos que el modelo no tiene invita a agregarlos sin
  // pensar quién los verá, y este reporte lo consultan también perfiles de solo
  // lectura que pueden estar en manos de terceros.
  const payments = await Payment.find({ month }).populate('student', 'name');

  const paid    = payments.filter((p) => p.status === 'paid');
  const pending = payments.filter((p) => p.status === 'pending');

  res.json({
    month,
    payments,
    totalExpected: payments.reduce((s, p) => s + p.amount, 0),
    totalPaid:     paid.reduce((s, p) => s + p.amount, 0),
    totalPending:  pending.reduce((s, p) => s + p.amount, 0),
    paid,
    pending,
  });
};

exports.getByActivity = async (req, res) => {
  const { activityId } = req.params;
  const activity = await Activity.findById(activityId);
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });

  const [income, expenses] = await Promise.all([
    Payment.find({ activity: activityId, status: 'paid' }).populate('student', 'name'),
    Expense.find({ activity: activityId }),
  ]);

  res.json({
    activity,
    income,
    expenses,
    totalIncome:  income.reduce((s, p) => s + p.amount, 0),
    totalExpense: expenses.reduce((s, e) => s + e.amount, 0),
    balance:      income.reduce((s, p) => s + p.amount, 0) - expenses.reduce((s, e) => s + e.amount, 0),
  });
};

exports.getPettyCash = async (req, res) => {
  const ledger = await getPettyCashLedger(req.query);
  res.json({
    movements: ledger.entries,
    totalIncome: ledger.totalIncome,
    totalExpense: ledger.totalExpense,
    initialBalance: ledger.initialBalance,
    currentBalance: ledger.currentBalance,
    movementCount: ledger.movementCount,
    balance: ledger.balance,
  });
};
