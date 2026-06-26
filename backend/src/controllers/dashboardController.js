const Payment   = require('../models/Payment');
const Expense   = require('../models/Expense');
const Student   = require('../models/Student');
const PettyCash = require('../models/PettyCash');
const Discount  = require('../models/Discount');

exports.getSummary = async (req, res) => {
  const [students, payments, expenses, pettyCash, discounts] = await Promise.all([
    Student.find(),
    Payment.find({ status: 'paid' }),
    Expense.find(),
    PettyCash.find(),
    Discount.find(),
  ]);

  const activeStudents = students.filter(s => s.status === 'active').length;

  const monthlyIncome    = payments.filter(p => p.type === 'cuota_mensual').reduce((s, p) => s + p.amount, 0);
  const activitiesIncome = payments.filter(p => p.type !== 'cuota_mensual' && p.type !== 'caja_chica').reduce((s, p) => s + p.amount, 0);

  const generalExpenses = expenses.filter(e => e.fund === 'general').reduce((s, e) => s + e.amount, 0);

  // Descuentos descontados de cuotas mensuales y de caja chica
  const discountsFromFees      = discounts.filter(d => d.source === 'cuotas_mensuales').reduce((s, d) => s + d.amount, 0);
  const discountsFromPettyCash = discounts.filter(d => d.source === 'caja_chica').reduce((s, d) => s + d.amount, 0);

  const generalBalance   = monthlyIncome + activitiesIncome - generalExpenses - discountsFromFees;

  const pettyCashIncome  = pettyCash.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const pettyCashExpense = pettyCash.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0);
  const pettyCashBalance = pettyCashIncome - pettyCashExpense - discountsFromPettyCash;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyPayments  = await Payment.find({ type: 'cuota_mensual', month: currentMonth });
  const upToDateStudents = monthlyPayments.filter(p => p.status === 'paid').length;
  const debtStudents     = monthlyPayments.filter(p => p.status === 'pending').length;

  res.json({
    students: { total: students.length, active: activeStudents, inactive: students.length - activeStudents, upToDate: upToDateStudents, debt: debtStudents },
    income:   { monthly: monthlyIncome, activities: activitiesIncome, total: monthlyIncome + activitiesIncome },
    expenses: { general: generalExpenses },
    discounts: { fromFees: discountsFromFees, fromPettyCash: discountsFromPettyCash, total: discountsFromFees + discountsFromPettyCash },
    balance:  { general: generalBalance, pettyCash: pettyCashBalance },
  });
};

exports.getMonthlyChart = async (req, res) => {
  const year = req.query.year || new Date().getFullYear();

  const [payments, expenses, discounts] = await Promise.all([
    Payment.find({ status: 'paid', date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) } }),
    Expense.find({ date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) } }),
    Discount.find({ date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31`) } }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m     = String(i + 1).padStart(2, '0');
    const label = new Date(`${year}-${m}-01`).toLocaleString('es-CL', { month: 'short' });
    const income   = payments.filter(p => new Date(p.date).getMonth() === i).reduce((s, p) => s + p.amount, 0);
    const expense  = expenses.filter(e => new Date(e.date).getMonth() === i).reduce((s, e) => s + e.amount, 0);
    const discount = discounts.filter(d => new Date(d.date).getMonth() === i).reduce((s, d) => s + d.amount, 0);
    return { month: label, income, expense, discount };
  });

  res.json(months);
};
