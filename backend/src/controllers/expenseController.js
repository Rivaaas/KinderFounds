const Expense = require('../models/Expense');

exports.getAll = async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.fund)     filter.fund = req.query.fund;
  if (req.query.from || req.query.to) {
    filter.date = {};
    if (req.query.from) filter.date.$gte = new Date(req.query.from);
    if (req.query.to)   filter.date.$lte = new Date(req.query.to);
  }

  const expenses = await Expense.find(filter)
    .populate('activity', 'name')
    .sort({ date: -1 });
  res.json(expenses);
};

exports.getOne = async (req, res) => {
  const expense = await Expense.findById(req.params.id).populate('activity', 'name');
  if (!expense) return res.status(404).json({ message: 'Gasto no encontrado.' });
  res.json(expense);
};

exports.create = async (req, res) => {
  const { category, amount, date, description, paymentMethod, fund, activity } = req.body;
  if (!category || amount === undefined || !description)
    return res.status(400).json({ message: 'Categoría, monto y descripción son requeridos.' });
  if (amount < 0)
    return res.status(400).json({ message: 'El monto no puede ser negativo.' });

  const expense = await Expense.create({ category, amount, date, description, paymentMethod, fund, activity });
  res.status(201).json(expense);
};

exports.update = async (req, res) => {
  if (req.body.amount !== undefined && req.body.amount < 0)
    return res.status(400).json({ message: 'El monto no puede ser negativo.' });

  const expense = await Expense.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!expense) return res.status(404).json({ message: 'Gasto no encontrado.' });
  res.json(expense);
};

exports.remove = async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) return res.status(404).json({ message: 'Gasto no encontrado.' });
  res.json({ message: 'Gasto eliminado.' });
};
