const Payment   = require('../models/Payment');
const Expense   = require('../models/Expense');
const Student   = require('../models/Student');
const Discount  = require('../models/Discount');
const { sum, getPettyCashLedger } = require('../utils/balances');
const { currentMonthLocal } = require('../utils/constants');

exports.getSummary = async (req, res) => {
  const [students, payments, expenses, pettyCash, discounts] = await Promise.all([
    Student.find(),
    Payment.find({ status: 'paid' }),
    Expense.find(),
    getPettyCashLedger(),
    Discount.find(),
  ]);

  const activeStudents = students.filter(s => s.status === 'active').length;

  const monthlyIncome    = payments.filter(p => p.type === 'cuota_mensual').reduce((s, p) => s + p.amount, 0);
  const activitiesIncome = payments.filter(p => p.type !== 'cuota_mensual' && p.type !== 'caja_chica').reduce((s, p) => s + p.amount, 0);

  // Cada gasto descuenta del fondo que eligió el usuario al registrarlo.
  const generalExpenses   = sum(expenses.filter(e => e.fund === 'general'));
  const pettyCashExpenses = sum(expenses.filter(e => e.fund === 'caja_chica'));

  // Descuentos descontados de cuotas mensuales y de caja chica
  const discountsFromFees      = sum(discounts.filter(d => d.source === 'cuotas_mensuales'));
  const discountsFromPettyCash = sum(discounts.filter(d => d.source === 'caja_chica'));

  // Saldo del fondo general por separado: lo recaudado en cuotas y actividades
  // menos lo gastado desde ese fondo.
  const generalBalance = monthlyIncome + activitiesIncome - generalExpenses - discountsFromFees;

  // El mes se calcula en la zona horaria del curso: con toISOString() el servidor
  // (que corre en UTC) pasaba al mes siguiente a las 21:00 de Chile, y el último
  // día de cada mes el dashboard mostraba 0 alumnos al día.
  const mesActual = currentMonthLocal();
  const monthlyPayments  = await Payment.find({ type: 'cuota_mensual', month: mesActual });
  const upToDateStudents = monthlyPayments.filter(p => p.status === 'paid').length;
  const debtStudents     = monthlyPayments.filter(p => p.status === 'pending').length;

  res.json({
    students: { total: students.length, active: activeStudents, inactive: students.length - activeStudents, upToDate: upToDateStudents, debt: debtStudents },
    income:   { monthly: monthlyIncome, activities: activitiesIncome, total: monthlyIncome + activitiesIncome },
    expenses: { general: generalExpenses, pettyCash: pettyCashExpenses, total: generalExpenses + pettyCashExpenses },
    discounts: { fromFees: discountsFromFees, fromPettyCash: discountsFromPettyCash, total: discountsFromFees + discountsFromPettyCash },
    balance: {
      general: generalBalance,
      pettyCash: pettyCash.currentBalance,
      // Dinero total disponible del curso: la suma de los dos fondos. Se calcula
      // sumando los saldos, no repitiendo la fórmula, para que no pueda quedar
      // descuadrado respecto de las partes que se muestran al lado.
      total: generalBalance + pettyCash.currentBalance,
    },
  });
};

exports.getMonthlyChart = async (req, res) => {
  const year = Number.parseInt(req.query.year, 10) || new Date().getFullYear();
  if (year < 2000 || year > 2100)
    return res.status(400).json({ message: 'El año solicitado no es válido.' });

  // El rango llegaba hasta el 31/12 a las 00:00 UTC, así que todo lo registrado
  // ese último día quedaba fuera del gráfico. Se cierra al final del día.
  const desde = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const hasta = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  const rango = { date: { $gte: desde, $lte: hasta } };

  const [payments, expenses, discounts] = await Promise.all([
    Payment.find({ status: 'paid', ...rango }),
    Expense.find(rango),
    Discount.find(rango),
  ]);

  // La atribución del mes se hace en UTC porque así se guardan las fechas que
  // vienen del formulario (AAAA-MM-DD se interpreta como medianoche UTC). Con
  // getMonth(), que usa la hora local del servidor, todo pago del día 1 caía en
  // el mes anterior: en Chile, las cuotas de comienzo de mes se graficaban mal.
  const enMes = (fecha, i) => {
    const d = new Date(fecha);
    return d.getUTCFullYear() === year && d.getUTCMonth() === i;
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const label = new Date(Date.UTC(year, i, 1)).toLocaleString('es-CL', { month: 'short', timeZone: 'UTC' });
    return {
      month: label,
      income:   payments.filter(p => enMes(p.date, i)).reduce((s, p) => s + p.amount, 0),
      expense:  expenses.filter(e => enMes(e.date, i)).reduce((s, e) => s + e.amount, 0),
      discount: discounts.filter(d => enMes(d.date, i)).reduce((s, d) => s + d.amount, 0),
    };
  });

  res.json(months);
};
