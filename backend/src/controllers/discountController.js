const Discount = require('../models/Discount');

exports.getAll = async (req, res) => {
  const filter = {};
  if (req.query.source) filter.source = req.query.source;

  const discounts = await Discount.find(filter).sort({ createdAt: -1 });

  const totalFromFees      = discounts.filter(d => d.source === 'cuotas_mensuales').reduce((s, d) => s + d.amount, 0);
  const totalFromPettyCash = discounts.filter(d => d.source === 'caja_chica').reduce((s, d) => s + d.amount, 0);

  res.json({ discounts, totalFromFees, totalFromPettyCash, total: totalFromFees + totalFromPettyCash });
};

exports.create = async (req, res) => {
  const { description, amount, source, category, date } = req.body;

  if (!description || amount === undefined || !source)
    return res.status(400).json({ message: 'Descripción, monto y origen son requeridos.' });
  if (amount <= 0)
    return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });

  const discount = await Discount.create({ description, amount, source, category, date });
  res.status(201).json(discount);
};

exports.update = async (req, res) => {
  if (req.body.amount !== undefined && req.body.amount <= 0)
    return res.status(400).json({ message: 'El monto debe ser mayor a 0.' });

  const discount = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!discount) return res.status(404).json({ message: 'Descuento no encontrado.' });
  res.json(discount);
};

exports.remove = async (req, res) => {
  const discount = await Discount.findByIdAndDelete(req.params.id);
  if (!discount) return res.status(404).json({ message: 'Descuento no encontrado.' });
  res.json({ message: 'Descuento eliminado.' });
};
