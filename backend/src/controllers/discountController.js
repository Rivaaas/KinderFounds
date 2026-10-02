const Discount = require('../models/Discount');
const { parseAmount, parseDate, parseText, createDeduplicated } = require('../utils/validation');
const { FUNDS, parseFund, fundQuery, normalizeFund } = require('../utils/funds');

exports.getAll = async (req, res) => {
  const filter = {};
  if (typeof req.query.source === 'string' && req.query.source) {
    const q = fundQuery(req.query.source);
    if (!q) return res.status(400).json({ message: 'El fondo indicado no existe.' });
    filter.source = q;
  }

  const discounts = await Discount.find(filter).sort({ createdAt: -1 });

  // Total por fondo. Los registros antiguos ('cuotas_mensuales') cuentan como cuotas.
  const byFund = Object.fromEntries(FUNDS.map((f) => [f, 0]));
  for (const d of discounts) byFund[normalizeFund(d.source) || 'cuotas'] += d.amount;
  const total = discounts.reduce((s, d) => s + d.amount, 0);

  res.json({
    discounts,
    byFund,
    total,
    // Claves históricas que todavía leen pantallas y pruebas.
    totalFromFees:       byFund.cuotas,
    totalFromActivities: byFund.actividades,
    totalFromPettyCash:  byFund.caja_chica,
  });
};

exports.create = async (req, res) => {
  const { description, amount, source, category, date } = req.body;

  const desc = parseText(description, 'descripción', { required: true });
  if (desc.error) return res.status(400).json({ message: desc.error });

  const monto = parseAmount(amount);
  if (monto.error) return res.status(400).json({ message: monto.error });

  // El fondo del que se descuenta lo elige quien registra el descuento.
  const fondo = parseFund(source, { required: true, campo: 'origen del descuento' });
  if (fondo.error) return res.status(400).json({ message: fondo.error });

  const fecha = parseDate(date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const resultado = await createDeduplicated(
    Discount,
    { description: desc.value, amount: monto.value, source: fondo.value, category, date: fecha.value },
    {
      criterio: { description: desc.value, amount: monto.value, source: fondo.value },
      huella: [desc.value, monto.value, fondo.value],
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
  if (req.body.source !== undefined) {
    const fondo = parseFund(req.body.source, { required: true, campo: 'origen del descuento' });
    if (fondo.error) return res.status(400).json({ message: fondo.error });
    cambios.source = fondo.value;
  }
  if (req.body.category !== undefined) cambios.category = req.body.category;

  const discount = await Discount.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true });
  if (!discount) return res.status(404).json({ message: 'Descuento no encontrado.' });
  res.json(discount);
};

exports.remove = async (req, res) => {
  const discount = await Discount.findByIdAndDelete(req.params.id);
  if (!discount) return res.status(404).json({ message: 'Descuento no encontrado.' });
  res.json({ message: 'Descuento eliminado.' });
};
