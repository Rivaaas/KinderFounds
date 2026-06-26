const Activity = require('../models/Activity');
const Payment  = require('../models/Payment');
const Expense  = require('../models/Expense');

exports.getAll = async (req, res) => {
  const activities = await Activity.find()
    .populate('students', 'name')
    .sort({ date: -1 });
  res.json(activities);
};

exports.getOne = async (req, res) => {
  const activity = await Activity.findById(req.params.id).populate('students', 'name guardianName');
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });

  const [income, expenses] = await Promise.all([
    Payment.find({ activity: activity._id, status: 'paid' }),
    Expense.find({ activity: activity._id }),
  ]);

  const totalIncome  = income.reduce((s, p) => s + p.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);

  res.json({ activity, income, expenses, totalIncome, totalExpense, balance: totalIncome - totalExpense });
};

exports.create = async (req, res) => {
  const { name, type, date, description, observations, students, status } = req.body;
  if (!name || !date)
    return res.status(400).json({ message: 'Nombre y fecha son requeridos.' });

  const activity = await Activity.create({ name, type, date, description, observations, students, status });
  res.status(201).json(activity);
};

exports.update = async (req, res) => {
  const activity = await Activity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });
  res.json(activity);
};

exports.remove = async (req, res) => {
  const activity = await Activity.findByIdAndDelete(req.params.id);
  if (!activity) return res.status(404).json({ message: 'Actividad no encontrada.' });
  res.json({ message: 'Actividad eliminada.' });
};
