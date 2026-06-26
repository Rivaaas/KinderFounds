const PettyCash = require('../models/PettyCash');

exports.getAll = async (req, res) => {
  const movements = await PettyCash.find()
    .populate('student', 'name')
    .sort({ createdAt: -1 });

  const balance = movements.reduce(
    (s, m) => (m.type === 'income' ? s + m.amount : s - m.amount),
    0
  );

  res.json({ movements, balance });
};

exports.create = async (req, res) => {
  const { type, amount, student } = req.body;

  if (!type || amount === undefined)
    return res.status(400).json({ message: 'Tipo y monto son requeridos.' });
  if (amount <= 0)
    return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });
  if (type === 'income' && !student)
    return res.status(400).json({ message: 'Selecciona el alumno que realizó el pago.' });

  const movement = await PettyCash.create({ type, amount, student: student || undefined });
  const populated = await movement.populate('student', 'name');
  res.status(201).json(populated);
};

exports.update = async (req, res) => {
  if (req.body.amount !== undefined && req.body.amount <= 0)
    return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });

  const movement = await PettyCash.findByIdAndUpdate(req.params.id, req.body, { new: true })
    .populate('student', 'name');
  if (!movement) return res.status(404).json({ message: 'Movimiento no encontrado.' });
  res.json(movement);
};

exports.remove = async (req, res) => {
  const movement = await PettyCash.findByIdAndDelete(req.params.id);
  if (!movement) return res.status(404).json({ message: 'Movimiento no encontrado.' });
  res.json({ message: 'Movimiento eliminado.' });
};
