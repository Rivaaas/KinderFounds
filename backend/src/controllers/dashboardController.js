const Payment   = require('../models/Payment');
const Expense   = require('../models/Expense');
const Student   = require('../models/Student');
const Discount  = require('../models/Discount');
const { sum, getPettyCashLedger } = require('../utils/balances');
const { currentMonthLocal } = require('../utils/constants');
const { FUND_LABELS, normalizeFund } = require('../utils/funds');

// Fondo al que pertenece un pago según su tipo. Las cuotas mensuales van al
// fondo de cuotas; los pagos de caja chica, a caja chica; todo lo demás
// (cuotas de actividad, rifas, aportes voluntarios...) al fondo de actividades.
const fondoDePago = (p) => {
  if (p.type === 'cuota_mensual') return 'cuotas';
  if (p.type === 'caja_chica')    return 'caja_chica';
  return 'actividades';
};

// Fondo de un gasto o descuento, traduciendo los valores heredados.
const fondoDe = (valor) => normalizeFund(valor) || 'cuotas';

exports.getSummary = async (req, res) => {
  const [students, payments, expenses, pettyCash, discounts] = await Promise.all([
    Student.find(),
    Payment.find({ status: 'paid' }),
    Expense.find(),
    getPettyCashLedger(),
    Discount.find(),
  ]);

  const activeStudents = students.filter(s => s.status === 'active').length;

  // --- Ingresos por fondo -------------------------------------------------
  const monthlyIncome    = sum(payments.filter(p => fondoDePago(p) === 'cuotas'));
  const activitiesIncome = sum(payments.filter(p => fondoDePago(p) === 'actividades'));

  // --- Gastos por fondo: cada gasto descuenta del fondo elegido al registrarlo.
  const expensesCuotas      = sum(expenses.filter(e => fondoDe(e.fund) === 'cuotas'));
  const expensesActividades = sum(expenses.filter(e => fondoDe(e.fund) === 'actividades'));

  // --- Descuentos por fondo -----------------------------------------------
  const discountsCuotas      = sum(discounts.filter(d => fondoDe(d.source) === 'cuotas'));
  const discountsActividades = sum(discounts.filter(d => fondoDe(d.source) === 'actividades'));
  const discountsPettyCash   = sum(discounts.filter(d => fondoDe(d.source) === 'caja_chica'));

  // --- Caja chica: el saldo viene del libro (fuente única), aquí solo se
  // desglosa en ingresos / egresos / descuentos para mostrarlo al lado de los
  // otros fondos. Los egresos son los movimientos de la pantalla Caja Chica
  // más los gastos cargados a ese fondo; los descuentos van aparte.
  const pettyCashIncome   = sum(pettyCash.entries.filter(e => e.type === 'income'));
  // Gastos registrados en la pantalla Gastos con fondo caja chica...
  const pettyCashExpenses = sum(expenses.filter(e => fondoDe(e.fund) === 'caja_chica'));
  // ...más los egresos anotados directamente en Caja Chica.
  const pettyCashMovementsOut = sum(pettyCash.entries.filter(e => e.type === 'expense' && e.origin === 'movement'));

  const balanceCuotas      = monthlyIncome    - expensesCuotas      - discountsCuotas;
  const balanceActividades = activitiesIncome - expensesActividades - discountsActividades;
  const balancePettyCash   = pettyCash.currentBalance;

  // Cada fondo se explica con sus propias partes; el total es la suma de los
  // saldos, no una fórmula aparte, para que nunca quede descuadrado.
  const funds = [
    {
      key: 'cuotas', label: FUND_LABELS.cuotas,
      income: monthlyIncome, expenses: expensesCuotas, discounts: discountsCuotas, balance: balanceCuotas,
    },
    {
      key: 'actividades', label: FUND_LABELS.actividades,
      income: activitiesIncome, expenses: expensesActividades, discounts: discountsActividades, balance: balanceActividades,
    },
    {
      key: 'caja_chica', label: FUND_LABELS.caja_chica,
      initialBalance: pettyCash.initialBalance,
      income: pettyCashIncome,
      // Para caja chica, "gastos" son gastos + egresos directos: así el saldo de
      // la tarjeta se explica con sus propias filas.
      expenses: pettyCashExpenses + pettyCashMovementsOut,
      movementsOut: pettyCashMovementsOut,
      discounts: discountsPettyCash, balance: balancePettyCash,
    },
  ];

  const totalDiscounts = discountsCuotas + discountsActividades + discountsPettyCash;
  const totalBalance   = balanceCuotas + balanceActividades + balancePettyCash;

  // El mes se calcula en la zona horaria del curso: con toISOString() el servidor
  // (que corre en UTC) pasaba al mes siguiente a las 21:00 de Chile, y el último
  // día de cada mes el dashboard mostraba 0 alumnos al día.
  const mesActual = currentMonthLocal();
  const monthlyPayments  = await Payment.find({ type: 'cuota_mensual', month: mesActual });
  const upToDateStudents = monthlyPayments.filter(p => p.status === 'paid').length;
  const debtStudents     = monthlyPayments.filter(p => p.status === 'pending').length;

  res.json({
    students: { total: students.length, active: activeStudents, inactive: students.length - activeStudents, upToDate: upToDateStudents, debt: debtStudents },
    funds,
    income: {
      monthly: monthlyIncome,
      activities: activitiesIncome,
      pettyCash: pettyCashIncome,
      total: monthlyIncome + activitiesIncome,
    },
    // Solo registros de la pantalla Gastos (los egresos directos de caja chica
    // se ven en `funds` y en la pantalla Caja Chica).
    expenses: {
      cuotas: expensesCuotas,
      actividades: expensesActividades,
      pettyCash: pettyCashExpenses,
      // `general` conserva su significado histórico: gastos fuera de caja chica.
      general: expensesCuotas + expensesActividades,
      total: expensesCuotas + expensesActividades + pettyCashExpenses,
    },
    discounts: {
      cuotas: discountsCuotas,
      actividades: discountsActividades,
      pettyCash: discountsPettyCash,
      fromFees: discountsCuotas,
      fromActivities: discountsActividades,
      fromPettyCash: discountsPettyCash,
      total: totalDiscounts,
    },
    balance: {
      cuotas: balanceCuotas,
      actividades: balanceActividades,
      // `general` = cuotas + actividades (lo que antes era el "fondo general").
      general: balanceCuotas + balanceActividades,
      pettyCash: balancePettyCash,
      total: totalBalance,
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
    const pagos  = payments.filter(p => enMes(p.date, i));
    const gastos = expenses.filter(e => enMes(e.date, i));
    return {
      month: label,
      income:   sum(pagos),
      expense:  sum(gastos),
      discount: sum(discounts.filter(d => enMes(d.date, i))),
      // Desglose por fondo para el gráfico del dashboard.
      incomeCuotas:      sum(pagos.filter(p => fondoDePago(p) === 'cuotas')),
      incomeActividades: sum(pagos.filter(p => fondoDePago(p) === 'actividades')),
      incomeCajaChica:   sum(pagos.filter(p => fondoDePago(p) === 'caja_chica')),
      expenseCuotas:      sum(gastos.filter(e => fondoDe(e.fund) === 'cuotas')),
      expenseActividades: sum(gastos.filter(e => fondoDe(e.fund) === 'actividades')),
      expenseCajaChica:   sum(gastos.filter(e => fondoDe(e.fund) === 'caja_chica')),
    };
  });

  res.json(months);
};
