const Expense = require('../models/Expense');
const Activity = require('../models/Activity');
const { parseAmount, parseDate, parseText, referenceExists, createDeduplicated } = require('../utils/validation');

exports.getAll = async (req, res) => {
  const filter = {};
  for (const campo of ['category', 'fund']) {
    const v = req.query[campo];
    if (typeof v === 'string' && v) filter[campo] = v;
  }

  const { from, to } = req.query;
  if (from || to) {
    const desde = parseDate(from, 'fecha desde');
    const hasta = parseDate(to, 'fecha hasta');
    if (desde.error) return res.status(400).json({ message: desde.error });
    if (hasta.error) return res.status(400).json({ message: hasta.error });

    filter.date = {};
    if (desde.value) filter.date.$gte = desde.value;
    // El "hasta" incluye el día completo: sin esto, un gasto de las 15:00 del
    // último día del rango quedaba fuera del reporte.
    if (hasta.value) filter.date.$lte = new Date(hasta.value.getTime() + 86399999);
  }

  const expenses = await Expense.find(filter).populate('activity', 'name').sort({ date: -1 });
  res.json(expenses);
};

exports.getOne = async (req, res) => {
  const expense = await Expense.findById(req.params.id).populate('activity', 'name');
  if (!expense) return res.status(404).json({ message: 'Gasto no encontrado.' });
  res.json(expense);
};

exports.create = async (req, res) => {
  const { category, amount, date, description, paymentMethod, fund, activity } = req.body;

  if (!category || typeof category !== 'string')
    return res.status(400).json({ message: 'La categoría es requerida.' });

  const monto = parseAmount(amount);
  if (monto.error) return res.status(400).json({ message: monto.error });

  const desc = parseText(description, 'descripción', { required: true });
  if (desc.error) return res.status(400).json({ message: desc.error });

  const fecha = parseDate(date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const act = await referenceExists(Activity, activity, 'actividad');
  if (act.error) return res.status(400).json({ message: act.error });

  const resultado = await createDeduplicated(
    Expense,
    {
      category, amount: monto.value, date: fecha.value, description: desc.value,
      paymentMethod, fund, activity: act.value,
    },
    {
      criterio: { category, amount: monto.value, description: desc.value },
      huella: [category, monto.value, desc.value, fund, act.value],
      mensaje: 'Este gasto ya se registró hace unos segundos. Revisa el listado antes de reintentar.',
    }
  );
  if (resultado.duplicate) return res.status(409).json({ message: resultado.message });

  res.status(201).json(resultado.doc);
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
  if (req.body.description !== undefined) {
    const desc = parseText(req.body.description, 'descripción', { required: true });
    if (desc.error) return res.status(400).json({ message: desc.error });
    cambios.description = desc.value;
  }
  if (req.body.activity !== undefined) {
    const act = await referenceExists(Activity, req.body.activity, 'actividad');
    if (act.error) return res.status(400).json({ message: act.error });
    cambios.activity = act.value || null;
  }
  for (const campo of ['category', 'paymentMethod', 'fund']) {
    if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
  }

  const expense = await Expense.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
  if (!expense) return res.status(404).json({ message: 'Gasto no encontrado.' });
  res.json(expense);
};

exports.remove = async (req, res) => {
  const expense = await Expense.findByIdAndDelete(req.params.id);
  if (!expense) return res.status(404).json({ message: 'Gasto no encontrado.' });
  res.json({ message: 'Gasto eliminado.' });
};
