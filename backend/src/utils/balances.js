const Payment   = require('../models/Payment');
const Expense   = require('../models/Expense');
const PettyCash = require('../models/PettyCash');
const Discount  = require('../models/Discount');
const Settings  = require('../models/Settings');

const sum = (rows) => rows.reduce((s, r) => s + (r.amount || 0), 0);

// Fuente única del saldo de caja chica.
//
// El dinero de caja chica se mueve desde cuatro pantallas distintas y todas deben
// reflejarse en el mismo saldo:
//   + Caja Chica  → movimiento income
//   + Pagos       → pago con tipo 'caja_chica' (solo si está pagado)
//   - Caja Chica  → movimiento expense
//   - Gastos      → gasto con fondo 'caja_chica'
//   - Descuentos  → descuento con origen 'caja_chica'
//
// A eso se suma el saldo inicial configurado: dinero con el que se parte y que no
// corresponde a ningún movimiento. El saldo nunca se almacena, siempre se calcula:
//   saldo = saldo inicial + ingresos - egresos
//
// Devuelve las entradas normalizadas para que el saldo siempre se explique con la
// lista que ve el usuario. `origin` indica de qué pantalla viene cada entrada,
// `editable` marca las que se pueden modificar desde Caja Chica (el resto se edita
// en su pantalla de origen) y `balanceAfter` es el saldo resultante tras aplicarla.
const getPettyCashLedger = async (range) => {
  const config = await Settings.obtener();
  const initialBalance = config.pettyCashInitialBalance || 0;

  // Se leen SIEMPRE todos los movimientos, aunque se pida un rango: el saldo
  // resultante de una fila depende de todo lo anterior, no solo de lo visible.
  const [movements, payments, expenses, discounts] = await Promise.all([
    PettyCash.find().populate('student', 'name'),
    Payment.find({ type: 'caja_chica', status: 'paid' }).populate('student', 'name'),
    Expense.find({ fund: 'caja_chica' }),
    Discount.find({ source: 'caja_chica' }),
  ]);

  const todas = [
    ...movements.map((m) => ({
      _id: m._id,
      origin: 'movement',
      editable: true,
      type: m.type,
      amount: m.amount,
      date: m.date,
      student: m.student || null,
      description: m.type === 'income' ? 'Pago de alumno' : 'Egreso de caja chica',
    })),
    ...payments.map((p) => ({
      _id: p._id,
      origin: 'payment',
      editable: false,
      type: 'income',
      amount: p.amount,
      date: p.date,
      student: p.student || null,
      description: p.description || 'Pago registrado en Pagos',
    })),
    ...expenses.map((e) => ({
      _id: e._id,
      origin: 'expense',
      editable: false,
      type: 'expense',
      amount: e.amount,
      date: e.date,
      student: null,
      description: e.description,
    })),
    ...discounts.map((d) => ({
      _id: d._id,
      origin: 'discount',
      editable: false,
      type: 'expense',
      amount: d.amount,
      date: d.date,
      student: null,
      description: d.description,
    })),
  ];

  // Saldo corrido: se recorre de la más antigua a la más nueva.
  todas.sort((a, b) => new Date(a.date) - new Date(b.date) || String(a._id).localeCompare(String(b._id)));
  let acumulado = initialBalance;
  for (const e of todas) {
    acumulado += e.type === 'income' ? e.amount : -e.amount;
    e.balanceAfter = acumulado;
  }

  const currentBalance = acumulado;

  // El rango solo recorta lo que se muestra; los saldos resultantes ya vienen
  // calculados sobre el histórico completo.
  const { from, to } = range || {};
  const desde = from ? new Date(from) : null;
  const hasta = to   ? new Date(to)   : null;
  const visibles = (desde || hasta)
    ? todas.filter((e) => (!desde || new Date(e.date) >= desde) && (!hasta || new Date(e.date) <= hasta))
    : todas;

  const entries = visibles.slice().reverse(); // más recientes primero, como espera la tabla

  const totalIncome  = sum(entries.filter((e) => e.type === 'income'));
  const totalExpense = sum(entries.filter((e) => e.type === 'expense'));

  return {
    entries,
    totalIncome,
    totalExpense,
    initialBalance,
    // Saldo real disponible hoy: saldo inicial + todos los movimientos.
    currentBalance,
    movementCount: entries.length,
    // Se mantiene el significado histórico de `balance` (neto del conjunto
    // mostrado) para no alterar los reportes que ya lo usan.
    balance: totalIncome - totalExpense,
  };
};

module.exports = { sum, getPettyCashLedger };
