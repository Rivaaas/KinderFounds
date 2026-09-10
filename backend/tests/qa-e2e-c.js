// Contrato frontend -> backend: reproduce exactamente los cuerpos que envía cada
// pantalla de la SPA (incluidos los montos como texto, que es como salen de los
// <input type="number">), para detectar regresiones que rompan la interfaz.
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record } = H;
const A = require('./qa-e2e');
const { ctx } = A;

async function suiteContrato() {
  suite('13. CONTRATO FRONTEND -> BACKEND (payloads reales de la SPA)');

  const alumno = ctx.alumnos[2]._id;

  // --- Alumnos: { name, status } ---
  let r = await POST('/students', { name: 'Emilia Contreras Vera', status: 'active' });
  eq('Students.jsx — crear alumno con el payload del formulario', r.status, 201);
  const nuevoId = r.data && r.data._id;
  r = await PUT('/students/' + nuevoId, { name: 'Emilia Contreras V.', status: 'active' });
  eq('Students.jsx — editar alumno con el payload del formulario', r.status, 200);

  // --- Pagos: montos como texto, fecha AAAA-MM-DD, campos vacíos como '' ---
  const formPago = {
    type: 'aporte_voluntario', amount: '12000', date: '2026-08-14',
    student: alumno, description: 'Aporte del formulario', status: 'paid', month: '2026-08',
  };
  r = await POST('/payments', formPago);
  eq('Payments.jsx — crear pago (monto como texto) devuelve 201', r.status, 201);
  const pagoId = r.data && r.data._id;
  check('Payments.jsx — el monto se guarda como número, no como texto',
    r.data && r.data.amount === 12000, 'quedó ' + JSON.stringify(r.data && r.data.amount));
  check('Payments.jsx — la respuesta trae el alumno poblado para la tabla',
    r.data && r.data.student && r.data.student.name, JSON.stringify(r.data && r.data.student));

  // openEdit reenvía el documento completo, incluidos _id, createdAt y __v
  const completo = { ...r.data, student: alumno, date: '2026-08-15', amount: '13000' };
  r = await PUT('/payments/' + pagoId, completo);
  eq('Payments.jsx — editar reenviando el documento completo devuelve 200', r.status, 200);
  eq('Payments.jsx — el monto editado se guarda correctamente', r.data.amount, 13000);
  check('Payments.jsx — reenviar _id y createdAt no corrompe el documento',
    String(r.data._id) === String(pagoId), 'el _id cambió');

  // quickPay: { status, date }
  const cuotaPend = (await GET('/payments?type=cuota_mensual&status=pending')).data[0];
  if (cuotaPend) {
    r = await PUT('/payments/' + cuotaPend._id, { status: 'paid', date: '2026-12-20' });
    eq('Payments.jsx — botón "✓ Pagar" (quickPay) funciona', r.status, 200);
    await PUT('/payments/' + cuotaPend._id, { status: 'pending' });
  }
  await DEL('/payments/' + pagoId);

  // Generar cuotas: { month, amount: texto, description }
  r = await POST('/payments/generate-monthly', { month: '2027-03', amount: '5000', description: '' });
  check('Payments.jsx — generar cuotas con monto como texto', r.status === 201 && r.data.created > 0,
    'status ' + r.status + ' ' + JSON.stringify(r.data));
  check('Payments.jsx — la respuesta trae "message" para el toast', !!(r.data && r.data.message), JSON.stringify(r.data));
  for (const p of (await GET('/payments?type=cuota_mensual&month=2027-03')).data) await DEL('/payments/' + p._id);

  // --- Gastos ---
  const formGasto = {
    category: 'compra_actividad', amount: '33500', date: '2026-10-02',
    description: 'Insumos del formulario', paymentMethod: 'efectivo', fund: 'general',
  };
  r = await POST('/expenses', formGasto);
  eq('Expenses.jsx — crear gasto con el payload del formulario', r.status, 201);
  const gastoId = r.data && r.data._id;
  eq('Expenses.jsx — el monto se guarda como número', r.data.amount, 33500);
  r = await PUT('/expenses/' + gastoId, { ...r.data, amount: '34000' });
  eq('Expenses.jsx — editar reenviando el documento completo', r.status, 200);
  await DEL('/expenses/' + gastoId);

  // --- Caja chica ---
  r = await POST('/petty-cash', { type: 'income', amount: '4200', student: alumno });
  eq('PettyCash.jsx — registrar ingreso con el payload del formulario', r.status, 201);
  const movId = r.data && r.data._id;
  check('PettyCash.jsx — la respuesta trae el alumno poblado',
    r.data && r.data.student && r.data.student.name, JSON.stringify(r.data && r.data.student));
  r = await PUT('/petty-cash/' + movId, { type: 'income', amount: '4300', student: alumno });
  eq('PettyCash.jsx — editar movimiento', r.status, 200);
  r = await GET('/petty-cash');
  check('PettyCash.jsx — la respuesta trae movements, balance y totales',
    Array.isArray(r.data.movements) && typeof r.data.balance === 'number' &&
    typeof r.data.totalIncome === 'number' && typeof r.data.totalExpense === 'number',
    JSON.stringify(Object.keys(r.data)));
  check('PettyCash.jsx — cada movimiento indica origin y editable',
    r.data.movements.every(m => m.origin !== undefined && m.editable !== undefined),
    'faltan campos origin/editable que la tabla usa para mostrar acciones');
  await DEL('/petty-cash/' + movId);

  // --- Descuentos: el formulario NO envía fecha ---
  r = await POST('/discounts', { description: 'Descuento del formulario', amount: '7700', source: 'cuotas_mensuales', category: 'otro' });
  eq('Discounts.jsx — crear descuento sin fecha (la pone el servidor)', r.status, 201);
  const descId = r.data && r.data._id;
  check('Discounts.jsx — el servidor asigna la fecha por defecto', !!(r.data && r.data.date), JSON.stringify(r.data));
  r = await GET('/discounts');
  check('Discounts.jsx — la respuesta trae discounts y los tres totales',
    Array.isArray(r.data.discounts) && typeof r.data.total === 'number' &&
    typeof r.data.totalFromFees === 'number' && typeof r.data.totalFromPettyCash === 'number',
    JSON.stringify(Object.keys(r.data)));
  await DEL('/discounts/' + descId);

  // --- Actividades: incluye lista de alumnos ---
  const formAct = {
    name: 'Paseo de fin de año', type: 'paseo', date: '2026-11-28',
    description: 'Paseo al parque', observations: '', status: 'planned',
    students: ctx.alumnos.slice(0, 5).map(a => a._id),
  };
  r = await POST('/activities', formAct);
  eq('Activities.jsx — crear actividad con lista de alumnos', r.status, 201);
  const actId = r.data && r.data._id;
  r = await PUT('/activities/' + actId, { ...formAct, name: 'Paseo de fin de año 2026' });
  eq('Activities.jsx — editar actividad', r.status, 200);
  r = await GET('/activities');
  check('Activities.jsx — el listado trae los alumnos poblados',
    Array.isArray(r.data) && r.data.every(a => Array.isArray(a.students)), 'students no viene como arreglo');
  r = await DEL('/activities/' + actId);
  eq('Activities.jsx — eliminar actividad sin movimientos', r.status, 200);

  // --- Usuarios ---
  r = await POST('/users', { username: 'ayudante', password: 'Ayudante2026', name: 'Ayudante de Curso', role: 'viewer' });
  eq('Users.jsx — crear usuario con el payload del formulario', r.status, 201);
  const userId = r.data && r.data.id;
  r = await PUT('/users/' + userId, { name: 'Ayudante Curso', role: 'viewer' });
  eq('Users.jsx — editar usuario (solo name y role)', r.status, 200);
  r = await PUT('/users/' + userId + '/password', { password: 'NuevaClave2026' });
  eq('Users.jsx — resetear contraseña', r.status, 200);
  r = await PUT('/users/' + userId, { active: false });
  eq('Users.jsx — desactivar usuario', r.status, 200);
  const bloq = await POST('/auth/login', { username: 'ayudante', password: 'NuevaClave2026' }, { token: null });
  eq('Un usuario desactivado no puede iniciar sesión', bloq.status, 403);
  r = await DEL('/users/' + userId);
  eq('Users.jsx — eliminar usuario', r.status, 200);

  // --- Dashboard y estadísticas: forma esperada por las tarjetas y gráficos ---
  r = await GET('/dashboard/summary');
  const d = r.data;
  check('Dashboard.jsx — el resumen trae students/income/expenses/discounts/balance',
    d && d.students && d.income && d.expenses && d.discounts && d.balance,
    JSON.stringify(Object.keys(d || {})));
  check('Dashboard.jsx — todos los totales son numéricos (no null ni NaN)',
    [d.income.total, d.expenses.total, d.balance.general, d.balance.pettyCash]
      .every(v => typeof v === 'number' && Number.isFinite(v)),
    JSON.stringify(d.income) + ' ' + JSON.stringify(d.balance));

  r = await GET('/dashboard/chart/monthly?year=2026');
  check('Statistics.jsx — el gráfico devuelve 12 meses con income/expense/discount',
    Array.isArray(r.data) && r.data.length === 12 &&
    r.data.every(m => typeof m.income === 'number' && typeof m.expense === 'number' && typeof m.discount === 'number'),
    'llegaron ' + (r.data && r.data.length) + ' meses');

  r = await GET('/reports/general?from=2026-01-01&to=2026-12-31');
  check('Reports.jsx — el reporte general trae payments, expenses y totales',
    Array.isArray(r.data.payments) && Array.isArray(r.data.expenses) &&
    typeof r.data.totalIncome === 'number' && typeof r.data.balance === 'number',
    JSON.stringify(Object.keys(r.data)));
  check('Reports.jsx — los pagos del reporte traen el alumno poblado para el CSV',
    r.data.payments.filter(p => p.student).every(p => p.student.name !== undefined),
    'algún pago trae el alumno sin poblar');

  await DEL('/students/' + nuevoId);
}

async function suiteFechas() {
  suite('14. FECHAS Y ZONA HORARIA (gráfico de estadísticas)');

  const alumno = ctx.alumnos[3]._id;
  const año = 2027;

  // Un pago del día 1 se atribuía al mes anterior porque el mes se calculaba con
  // la hora local del servidor sobre una fecha guardada como medianoche UTC.
  const p1 = await POST('/payments', {
    type: 'aporte_voluntario', amount: 11000, status: 'paid',
    student: alumno, date: `${año}-07-01`, description: 'Aporte del día 1',
  });
  // El rango del gráfico cerraba el 31/12 a las 00:00 UTC y dejaba fuera ese día.
  const p2 = await POST('/payments', {
    type: 'aporte_voluntario', amount: 22000, status: 'paid',
    student: alumno, date: `${año}-12-31`, description: 'Aporte de fin de año',
  });
  record(p1.status === 201 && p2.status === 201, 'Se registran los dos pagos límite (1 de julio y 31 de diciembre)',
    JSON.stringify([p1.status, p2.status]));

  const chart = (await GET(`/dashboard/chart/monthly?year=${año}`)).data;
  eq('El gráfico devuelve los 12 meses', chart.length, 12);
  eq('Un pago del 1 de julio se grafica en JULIO (no en junio)', chart[6].income, 11000);
  eq('Junio no recibe el pago de julio', chart[5].income, 0);
  eq('Un pago del 31 de diciembre entra en el gráfico', chart[11].income, 22000);

  const totalGrafico = chart.reduce((s, m) => s + m.income, 0);
  eq('La suma del gráfico incluye ambos pagos límite', totalGrafico, 33000);

  let r = await GET('/dashboard/chart/monthly?year=texto');
  check('Año no numérico no rompe el gráfico', r.status === 200 || r.status === 400, 'status ' + r.status);
  r = await GET('/dashboard/chart/monthly?year=99999');
  eq('Año fuera de rango se rechaza', r.status, 400);

  if (p1.status === 201) await DEL('/payments/' + p1.data._id);
  if (p2.status === 201) await DEL('/payments/' + p2.data._id);
}

module.exports = { suiteContrato, suiteFechas };
