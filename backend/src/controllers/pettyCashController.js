const PettyCash = require('../models/PettyCash');
const Student = require('../models/Student');
const Settings = require('../models/Settings');
const { getPettyCashLedger } = require('../utils/balances');
const { MAX_AMOUNT } = require('../utils/constants');
const { parseAmount, parseDate, referenceExists, createDeduplicated } = require('../utils/validation');

exports.getAll = async (req, res) => {
  const { from, to } = req.query;
  const desde = parseDate(from, 'fecha desde');
  const hasta = parseDate(to, 'fecha hasta');
  if (desde.error) return res.status(400).json({ message: desde.error });
  if (hasta.error) return res.status(400).json({ message: hasta.error });

  const ledger = await getPettyCashLedger(req.query);
  res.json({
    movements: ledger.entries,
    totalIncome: ledger.totalIncome,
    totalExpense: ledger.totalExpense,
    initialBalance: ledger.initialBalance,
    currentBalance: ledger.currentBalance,
    movementCount: ledger.movementCount,
    // Se conserva por compatibilidad: neto del conjunto mostrado, sin saldo inicial.
    balance: ledger.balance,
  });
};

// El saldo inicial es el único número que se guarda; el saldo disponible siempre
// se recalcula a partir de él más los movimientos, para que no puedan divergir.
exports.getInitialBalance = async (req, res) => {
  const config = await Settings.obtener();
  res.json({ initialBalance: config.pettyCashInitialBalance || 0 });
};

exports.setInitialBalance = async (req, res) => {
  const { amount } = req.body;
  const n = typeof amount === 'number' ? amount : Number(amount);

  if (amount === undefined || amount === null || amount === '' || Number.isNaN(n) || !Number.isFinite(n))
    return res.status(400).json({ message: 'El saldo inicial debe ser un número válido.' });
  if (n < 0)
    return res.status(400).json({ message: 'El saldo inicial no puede ser negativo.' });
  if (n > MAX_AMOUNT)
    return res.status(400).json({ message: `El saldo inicial no puede superar $${MAX_AMOUNT.toLocaleString('es-CL')}.` });

  const config = await Settings.obtener();
  config.pettyCashInitialBalance = Math.round(n);
  await config.save();

  const ledger = await getPettyCashLedger();
  res.json({
    message: 'Saldo inicial actualizado.',
    initialBalance: ledger.initialBalance,
    currentBalance: ledger.currentBalance,
  });
};

exports.create = async (req, res) => {
  const { type, amount, student, date } = req.body;

  if (type !== 'income' && type !== 'expense')
    return res.status(400).json({ message: 'El tipo debe ser ingreso o egreso.' });

  const monto = parseAmount(amount);
  if (monto.error) return res.status(400).json({ message: monto.error });

  const fecha = parseDate(date);
  if (fecha.error) return res.status(400).json({ message: fecha.error });

  const alumno = await referenceExists(Student, student, 'alumno');
  if (alumno.error) return res.status(400).json({ message: alumno.error });

  if (type === 'income' && !alumno.value)
    return res.status(400).json({ message: 'Selecciona el alumno que realizó el pago.' });

  const resultado = await createDeduplicated(
    PettyCash,
    { type, amount: monto.value, student: alumno.value, date: fecha.value },
    {
      criterio: { type, amount: monto.value, student: alumno.value || null },
      huella: [type, monto.value, alumno.value],
      mensaje: 'Este movimiento ya se registró hace unos segundos. Revisa el listado antes de reintentar.',
    }
  );
  if (resultado.duplicate) return res.status(409).json({ message: resultado.message });

  const populated = await resultado.doc.populate('student', 'name');
  res.status(201).json(populated);
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
  if (req.body.student !== undefined) {
    const alumno = await referenceExists(Student, req.body.student, 'alumno');
    if (alumno.error) return res.status(400).json({ message: alumno.error });
    cambios.student = alumno.value || null;
  }
  if (req.body.type !== undefined) {
    if (req.body.type !== 'income' && req.body.type !== 'expense')
      return res.status(400).json({ message: 'El tipo debe ser ingreso o egreso.' });
    cambios.type = req.body.type;
  }

  const movement = await PettyCash.findByIdAndUpdate(req.params.id, cambios, { new: true, runValidators: true })
    .populate('student', 'name');
  if (!movement) return res.status(404).json({ message: 'Movimiento no encontrado.' });

  if (movement.type === 'income' && !movement.student)
    return res.status(400).json({ message: 'Un ingreso de caja chica debe tener un alumno asociado.' });

  res.json(movement);
};

exports.remove = async (req, res) => {
  const movement = await PettyCash.findByIdAndDelete(req.params.id);
  if (!movement) return res.status(404).json({ message: 'Movimiento no encontrado.' });
  res.json({ message: 'Movimiento eliminado.' });
};
