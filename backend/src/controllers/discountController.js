const Discount = require('../models/Discount');
const { parseAmount, parseDate, parseText, createDeduplicated } = require('../utils/validation');

exports.getAll = async (req, res) => {
  const filter = {};
  if (typeof req.query.source === 'string' && req.query.source) filter.source = req.query.source;

  const discounts = await Discount.find(filter).sort({ createdAt: -1 });

  const totalFromFees      = discounts.filter(d => d.source === 'cuotas_mensuales').reduce((s, d) => s + d.amount, 0);
  const totalFromPettyCash = discounts.filter(d => d.source === 'caja_chica').reduce((s, d) => s + d.amount, 0);

  res.json({ discounts, totalFromFees, totalFromPettyCash, total: totalFromFees + totalFromPettyCash });
};

exports.create = async (req, res) => {
  const { description, amount, source, category, date } = req.body;

  const desc = parseText(description, 'descripción', { required: true });
  if (desc.error) return res.status(400).json({ message: desc.error });

  const monto = parseAmount(amount);
  if (monto.error) return res.status(400).json({ message: monto.error });

  if (!source || typeof source !== 'string')
    return res.status(400).json({ message: 'El origen del descuento es requerido.' });

  const fecha = parseDate(date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const resultado = await createDeduplicated(
    Discount,
    { description: desc.value, amount: monto.value, source, category, date: fecha.value },
    {
      criterio: { description: desc.value, amount: monto.value, source },
      huella: [desc.value, monto.value, source],
      mensaje: 'Este descuento ya se registró hace unos segundos. Revisa el listado antes de reintentar.',
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
  if (req.body.description !== undefined) {
    const desc = parseText(req.body.description, 'descripción', { required: true });
    if (desc.error) return res.status(400).json({ message: desc.error });
    cambios.description = desc.value;
  }
  if (req.body.date !== undefined) {
    const fecha = parseDate(req.body.date);
    if (fecha.error) return res.status(400).json({ message: fecha.error });
    cambios.date = fecha.value;
  }
  for (const campo of ['source', 'category']) {
    if (req.body[campo] !== undefined) cambios[campo] = req.body[campo];
  }

  const discount = await Discount.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
  if (!discount) return res.status(404).json({ message: 'Descuento no encontrado.' });
  res.json(discount);
};

exports.remove = async (req, res) => {
  const discount = await Discount.findByIdAndDelete(req.params.id);
  if (!discount) return res.status(404).json({ message: 'Descuento no encontrado.' });
  res.json({ message: 'Descuento eliminado.' });
};
