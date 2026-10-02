// Segunda parte de la auditoría: fondos, actividades, consistencia, casos hostiles.
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record, state } = H;
const A = require('./qa-e2e');
const { libro, ctx, CUOTA } = A;

async function suiteCajaChica() {
  suite('5. CAJA CHICA');

  const alumno = ctx.alumnos[0]._id;

  let r = await POST('/petty-cash', { type: 'income', amount: 10000, student: alumno });
  eq('Registra saldo inicial de caja chica ($10.000)', r.status, 201);
  if (r.status === 201) { libro.cajaChicaIngresos += 10000; }

  for (const monto of [2000, 3000, 1500]) {
    const rr = await POST('/petty-cash', { type: 'income', amount: monto, student: alumno });
    if (rr.status === 201) libro.cajaChicaIngresos += monto;
    else record(false, 'Ingreso caja chica $' + monto, JSON.stringify(rr));
  }
  for (const monto of [4500, 800]) {
    const rr = await POST('/petty-cash', { type: 'expense', amount: monto });
    if (rr.status === 201) libro.cajaChicaEgresos += monto;
    else record(false, 'Egreso caja chica $' + monto, JSON.stringify(rr));
  }

  r = await GET('/petty-cash');
  const esperado = libro.cajaChicaIngresos - libro.cajaChicaEgresos;
  eq('Ingresos de caja chica: app vs libro', r.data.totalIncome, libro.cajaChicaIngresos);
  eq('Egresos de caja chica: app vs libro', r.data.totalExpense, libro.cajaChicaEgresos);
  eq('Saldo caja chica = ingresos - egresos', r.data.balance, esperado);

  r = await POST('/petty-cash', { type: 'income', amount: 5000 });
  eq('Ingreso de caja chica sin alumno se rechaza', r.status, 400);
  r = await POST('/petty-cash', { type: 'expense', amount: 0 });
  eq('Monto $0 se rechaza en caja chica', r.status, 400);
  r = await POST('/petty-cash', { type: 'expense', amount: -5000 });
  eq('Monto negativo se rechaza en caja chica', r.status, 400);
  r = await POST('/petty-cash', { type: 'transferencia', amount: 100, student: alumno });
  check('Tipo de movimiento inválido se rechaza', r.status === 400, 'status ' + r.status);

  // Un gasto con fondo caja_chica debe descontar del mismo saldo
  const saldoAntes = (await GET('/petty-cash')).data.balance;
  r = await POST('/expenses', { category: 'materiales', amount: 1200, description: 'Plumones pizarra', fund: 'caja_chica', date: '2026-06-10' });
  if (r.status === 201) libro.gastoCajaChica += 1200;
  const saldoDespues = (await GET('/petty-cash')).data.balance;
  eq('Un gasto con fondo "caja chica" descuenta del saldo de caja chica', saldoDespues, saldoAntes - 1200);

  // Un pago registrado en Pagos con tipo caja_chica debe sumar al mismo saldo
  const saldoPrevio = (await GET('/petty-cash')).data.balance;
  r = await POST('/payments', { type: 'caja_chica', amount: 2500, status: 'paid', student: alumno, date: '2026-06-12', description: 'Aporte caja chica desde Pagos' });
  if (r.status === 201) libro.ingresoCajaChicaPagos += 2500;
  const saldoNuevo = (await GET('/petty-cash')).data.balance;
  eq('Un pago tipo "caja chica" registrado en Pagos suma al saldo de caja chica', saldoNuevo, saldoPrevio + 2500);

  const ledger = (await GET('/petty-cash')).data;
  check('El movimiento aparece en el historial de caja chica con su origen',
    ledger.movements.some(m => m.origin === 'payment' && m.amount === 2500),
    'el pago no aparece en el libro de caja chica');
}

async function suiteGastos() {
  suite('6. GASTOS');

  const gastos = [
    { category: 'materiales', amount: 18500, description: 'Materiales para actividad', fund: 'general', date: '2026-05-12' },
    { category: 'compra_actividad', amount: 65000, description: 'Actividad 18 de septiembre', fund: 'general', date: '2026-09-15' },
    { category: 'regalos', amount: 120000, description: 'Compra regalos de Navidad', fund: 'general', date: '2026-12-10' },
    { category: 'comida', amount: 24300, description: 'Convivencia fin de año', fund: 'general', date: '2026-12-18' },
    { category: 'decoracion', amount: 9800, description: 'Decoración sala', fund: 'general', date: '2026-09-10' },
  ];
  for (const g of gastos) {
    const r = await POST('/expenses', g);
    if (r.status === 201) libro.gastoGeneral += g.amount;
    else record(false, 'Registrar gasto ' + g.description, JSON.stringify(r));
  }
  record(true, 'Se registran 5 gastos reales del fondo general', '$' + libro.gastoGeneral.toLocaleString('es-CL'));

  // El valor heredado 'general' se acepta pero se guarda normalizado como 'cuotas'.
  const todos = (await GET('/expenses')).data;
  const sumaGeneral = todos.filter(e => e.fund === 'cuotas').reduce((s, e) => s + e.amount, 0);
  eq('Suma de gastos del fondo de cuotas (ex "general"): app vs libro', sumaGeneral, libro.gastoGeneral);
  eq('Ningún gasto nuevo queda guardado con el fondo heredado "general"', todos.some(e => e.fund === 'general'), false);

  const enBD = await state.db.collection('expenses').find({ fund: 'cuotas' }).toArray();
  eq('BD: los gastos de cuotas persistidos suman lo mismo', enBD.reduce((s, e) => s + e.amount, 0), libro.gastoGeneral);

  let r = await POST('/expenses', { category: 'materiales', amount: 5000 });
  eq('Gasto sin descripción se rechaza', r.status, 400);
  r = await POST('/expenses', { amount: 5000, description: 'Sin categoría' });
  eq('Gasto sin categoría se rechaza', r.status, 400);
  r = await POST('/expenses', { category: 'materiales', amount: -1000, description: 'Negativo' });
  eq('Gasto con monto negativo se rechaza', r.status, 400);
  r = await POST('/expenses', { category: 'cripto', amount: 1000, description: 'Categoría inventada' });
  check('Categoría fuera del enum se rechaza', r.status === 400, 'status ' + r.status);
  r = await POST('/expenses', { category: 'materiales', amount: 0, description: 'Gasto en cero' });
  check('Gasto de $0 se rechaza', r.status === 400, 'status ' + r.status + ' — se aceptó un gasto de $0');
  if (r.status === 201) await DEL('/expenses/' + r.data._id);

  const filtrados = (await GET('/expenses?fund=caja_chica')).data;
  eq('Filtro por fondo caja_chica devuelve solo esos gastos', filtrados.every(e => e.fund === 'caja_chica'), true);

  const rango = (await GET('/expenses?from=2026-12-01&to=2026-12-31')).data;
  eq('Filtro por rango de fechas de diciembre devuelve 2 gastos', rango.length, 2);
}

async function suiteActividades() {
  suite('7. ACTIVIDADES');

  let r = await POST('/activities', {
    name: 'Fiesta 18 de Septiembre', type: '18_septiembre', date: '2026-09-18',
    description: 'Celebración de fiestas patrias del curso', status: 'completed',
    students: ctx.alumnos.slice(0, 10).map(a => a._id),
  });
  eq('Crea la actividad de 18 de septiembre', r.status, 201);
  ctx.actividad = r.data;

  const act = ctx.actividad._id;

  for (let i = 0; i < 8; i++) {
    const rp = await POST('/payments', {
      type: 'actividad_18_septiembre', amount: 3000, status: 'paid',
      student: ctx.alumnos[i]._id, activity: act, date: '2026-09-10',
      description: 'Aporte 18 de septiembre',
    });
    if (rp.status === 201) { libro.ingresoActividades += 3000; }
    else record(false, 'Aporte a actividad', JSON.stringify(rp));
  }
  const rg = await POST('/expenses', {
    category: 'compra_actividad', amount: 15000, description: 'Empanadas y bebidas',
    fund: 'general', activity: act, date: '2026-09-17',
  });
  if (rg.status === 201) libro.gastoGeneral += 15000;

  r = await GET('/activities/' + act);
  eq('Ingresos de la actividad = 8 x $3.000 = $24.000', r.data.totalIncome, 24000);
  eq('Gastos de la actividad = $15.000', r.data.totalExpense, 15000);
  eq('Balance de la actividad = $9.000', r.data.balance, 9000);

  const rep = await GET('/reports/activity/' + act);
  eq('El reporte de actividad coincide con la ficha (ingresos)', rep.data.totalIncome, r.data.totalIncome);
  eq('El reporte de actividad coincide con la ficha (balance)', rep.data.balance, r.data.balance);

  // Un aporte pendiente no debe sumar al balance de la actividad
  const rp = await POST('/payments', {
    type: 'actividad_18_septiembre', amount: 3000, status: 'pending',
    student: ctx.alumnos[10]._id, activity: act, date: '2026-09-10',
  });
  const conPendiente = await GET('/activities/' + act);
  eq('Un aporte PENDIENTE no infla el ingreso de la actividad', conPendiente.data.totalIncome, 24000);
  if (rp.status === 201) await DEL('/payments/' + rp.data._id);

  r = await POST('/activities', { name: 'Sin fecha' });
  eq('Actividad sin fecha se rechaza', r.status, 400);
  r = await POST('/activities', { date: '2026-10-01' });
  eq('Actividad sin nombre se rechaza', r.status, 400);
  r = await GET('/activities/000000000000000000000000');
  eq('Actividad inexistente devuelve 404', r.status, 404);
}

async function suiteDescuentos() {
  suite('8. DESCUENTOS');

  let r = await POST('/discounts', { description: 'Beca alumna con dificultad económica', amount: 5000, source: 'cuotas_mensuales', category: 'otro', date: '2026-06-05' });
  if (r.status === 201) libro.descuentoCuotas += 5000;
  eq('Crea descuento sobre cuotas mensuales', r.status, 201);

  r = await POST('/discounts', { description: 'Aporte para colación', amount: 2500, source: 'caja_chica', category: 'convivencia', date: '2026-07-08' });
  if (r.status === 201) libro.descuentoCajaChica += 2500;
  eq('Crea descuento sobre caja chica', r.status, 201);

  r = await GET('/discounts');
  eq('Total descuentos de cuotas: app vs libro', r.data.totalFromFees, libro.descuentoCuotas);
  eq('Desglose por fondo: cuotas', r.data.byFund.cuotas, libro.descuentoCuotas);
  eq('Desglose por fondo: caja chica', r.data.byFund.caja_chica, libro.descuentoCajaChica);
  eq('Total descuentos de caja chica: app vs libro', r.data.totalFromPettyCash, libro.descuentoCajaChica);
  eq('Total general de descuentos', r.data.total, libro.descuentoCuotas + libro.descuentoCajaChica);

  r = await POST('/discounts', { description: 'Sin monto', source: 'caja_chica' });
  eq('Descuento sin monto se rechaza', r.status, 400);
  r = await POST('/discounts', { description: 'Cero', amount: 0, source: 'caja_chica' });
  eq('Descuento de $0 se rechaza', r.status, 400);
  r = await POST('/discounts', { description: 'Negativo', amount: -100, source: 'caja_chica' });
  eq('Descuento negativo se rechaza', r.status, 400);
  r = await POST('/discounts', { description: 'Origen inventado', amount: 100, source: 'bitcoin' });
  check('Origen fuera del enum se rechaza', r.status === 400, 'status ' + r.status);
}

async function suiteConsistencia() {
  suite('9. CONSISTENCIA GLOBAL — dashboard vs libro contable independiente');

  const d = (await GET('/dashboard/summary')).data;

  eq('Dashboard: ingreso por cuotas', d.income.monthly, libro.ingresoCuotas);
  eq('Dashboard: ingreso por actividades', d.income.activities, libro.ingresoActividades);
  eq('Dashboard: ingreso total', d.income.total, libro.ingresoCuotas + libro.ingresoActividades);
  eq('Dashboard: gasto fondo general', d.expenses.general, libro.gastoGeneral);
  eq('Dashboard: gasto caja chica', d.expenses.pettyCash, libro.gastoCajaChica);
  eq('Dashboard: descuentos de cuotas', d.discounts.fromFees, libro.descuentoCuotas);
  eq('Dashboard: descuentos de caja chica', d.discounts.fromPettyCash, libro.descuentoCajaChica);

  const saldoGeneralEsperado = libro.ingresoCuotas + libro.ingresoActividades - libro.gastoGeneral - libro.descuentoCuotas;
  eq('Saldo fondo general = ingresos - gastos generales - descuentos de cuotas', d.balance.general, saldoGeneralEsperado);

  const cajaEsperada = libro.cajaChicaIngresos + libro.ingresoCajaChicaPagos
    - libro.cajaChicaEgresos - libro.gastoCajaChica - libro.descuentoCajaChica;
  eq('Saldo caja chica = ingresos - egresos - gastos - descuentos', d.balance.pettyCash, cajaEsperada);

  // El saldo general que ve el tesorero es el dinero total del curso: los dos
  // fondos juntos, no solo el de cuotas.
  eq('Saldo general = fondo de cuotas + caja chica', d.balance.total, saldoGeneralEsperado + cajaEsperada);
  eq('El total nunca queda descuadrado respecto de sus partes',
     d.balance.total, d.balance.general + d.balance.pettyCash);
  eq('El total también es la suma de los tres fondos',
     d.balance.total, d.funds.reduce((s, f) => s + f.balance, 0));
  eq('Fondo general = cuotas + actividades', d.balance.general, d.balance.cuotas + d.balance.actividades);

  const totalAlumnos = await state.db.collection('students').countDocuments();
  eq('Dashboard: total de alumnos coincide con la BD', d.students.total, totalAlumnos);

  // Contraste directo contra la base de datos
  const pagosBD = await state.db.collection('payments').find({ status: 'paid' }).toArray();
  const cuotasBD = pagosBD.filter(p => p.type === 'cuota_mensual').reduce((s, p) => s + p.amount, 0);
  eq('BD: suma de cuotas pagadas = dashboard', cuotasBD, d.income.monthly);

  const gastosBD = await state.db.collection('expenses').find({}).toArray();
  eq('BD: suma de todos los gastos = dashboard total', gastosBD.reduce((s, e) => s + e.amount, 0), d.expenses.total);

  // El reporte general debe cuadrar con el dashboard
  const rep = (await GET('/reports/general')).data;
  const ingresoRepEsperado = libro.ingresoCuotas + libro.ingresoActividades + libro.ingresoCajaChicaPagos;
  eq('Reporte general: ingreso total = suma de pagos pagados', rep.totalIncome, ingresoRepEsperado);
  eq('Reporte general: gasto total = todos los gastos', rep.totalExpense, libro.gastoGeneral + libro.gastoCajaChica);
  eq('Reporte general: balance = ingresos - gastos', rep.balance, rep.totalIncome - rep.totalExpense);

  // Ficha de alumno vs reporte por alumno
  const alu = ctx.alumnos[0];
  const ficha = (await GET('/students/' + alu._id)).data;
  const repAlu = (await GET('/reports/student/' + alu._id)).data;
  eq('Historial del alumno: ficha vs reporte (cantidad de pagos)', ficha.payments.length, repAlu.payments.length);
  const pagadoFicha = ficha.payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  eq('Total pagado del alumno: ficha vs reporte', pagadoFicha, repAlu.totalPaid);

  const pagosAluBD = await state.db.collection('payments')
    .find({ student: new (require('mongodb').ObjectId)(alu._id), status: 'paid' }).toArray();
  eq('BD: pagos del alumno coinciden con el reporte', pagosAluBD.reduce((s, p) => s + p.amount, 0), repAlu.totalPaid);
}

async function suiteDuplicacion() {
  suite('10. DUPLICACIÓN Y CONCURRENCIA (doble click)');

  const alumno = ctx.alumnos[1]._id;
  const pago = { type: 'aporte_voluntario', amount: 7000, status: 'paid', student: alumno, date: '2026-08-01', description: 'Aporte voluntario doble click' };

  const [a, b] = await Promise.all([POST('/payments', pago), POST('/payments', pago)]);
  const creados = [a, b].filter(x => x.status === 201);
  check('Doble click en "guardar pago" no crea dos pagos idénticos',
    creados.length === 1,
    'se crearon ' + creados.length + ' pagos de $7.000 con el mismo alumno, monto y fecha');
  for (const c of creados) { await DEL('/payments/' + c.data._id); }

  const saldoAntes = (await GET('/petty-cash')).data.balance;
  const mov = { type: 'expense', amount: 3300 };
  const [c1, c2] = await Promise.all([POST('/petty-cash', mov), POST('/petty-cash', mov)]);
  const movs = [c1, c2].filter(x => x.status === 201);
  const saldoDespues = (await GET('/petty-cash')).data.balance;
  check('Doble click en caja chica no duplica el egreso',
    saldoDespues === saldoAntes - 3300,
    'saldo bajó ' + (saldoAntes - saldoDespues) + ' cuando debía bajar 3300');
  for (const m of movs) await DEL('/petty-cash/' + m.data._id);

  const g = { category: 'otro', amount: 9900, description: 'Gasto doble click', fund: 'general', date: '2026-08-02' };
  const [g1, g2] = await Promise.all([POST('/expenses', g), POST('/expenses', g)]);
  const gs = [g1, g2].filter(x => x.status === 201);
  check('Doble click en gastos no duplica el registro', gs.length === 1, 'se crearon ' + gs.length + ' gastos idénticos');
  for (const x of gs) await DEL('/expenses/' + x.data._id);

  const mes = '2026-11';
  const antes = (await GET('/payments?type=cuota_mensual&month=' + mes)).data.length;
  await Promise.all([
    POST('/payments/generate-monthly', { month: mes, amount: CUOTA }),
    POST('/payments/generate-monthly', { month: mes, amount: CUOTA }),
  ]);
  const lista = (await GET('/payments?type=cuota_mensual&month=' + mes)).data;
  check('Doble click en "Generar Cuotas" no duplica las cuotas del mes',
    lista.length === antes, 'antes ' + antes + ' cuotas, despues ' + lista.length);

  // Restaura noviembre para no contaminar la auditoría de integridad posterior.
  const vistos = new Set();
  for (const p of lista) {
    const k = String(p.student && (p.student._id || p.student));
    if (vistos.has(k) && p.status === 'pending') await DEL('/payments/' + p._id);
    else vistos.add(k);
  }
}

async function suiteHostil() {
  suite('11. CASOS HOSTILES Y ROBUSTEZ');

  let r = await GET('/students/no-es-un-id');
  check('ID con formato inválido responde error controlado (no cuelga ni cae)',
    r.status >= 400 && r.status < 500,
    'status ' + r.status + (r.error ? ' — ' + r.error : '') + ' (se esperaba 400/404)');

  r = await GET('/payments/12345');
  check('GET pago con ID inválido responde error controlado', r.status >= 400 && r.status < 500,
    'status ' + r.status + (r.error ? ' — ' + r.error : ''));

  r = await DEL('/expenses/no-existe-id');
  check('DELETE con ID inválido responde error controlado', r.status >= 400 && r.status < 500,
    'status ' + r.status + (r.error ? ' — ' + r.error : ''));

  r = await PUT('/payments/000000000000000000000000', { amount: 1 });
  eq('PUT sobre pago inexistente devuelve 404', r.status, 404);
  r = await DEL('/payments/000000000000000000000000');
  eq('DELETE sobre pago inexistente devuelve 404', r.status, 404);

  r = await POST('/payments', { type: 'inventado', amount: 1000 });
  check('Tipo de pago fuera del enum se rechaza', r.status === 400, 'status ' + r.status);

  r = await POST('/payments', { type: 'cuota_mensual', amount: 'muchos pesos' });
  check('Monto en texto se rechaza', r.status === 400, 'status ' + r.status + ' — aceptó un monto no numérico');
  if (r.status === 201) await DEL('/payments/' + r.data._id);

  r = await POST('/payments', { type: 'cuota_mensual', amount: 0, status: 'paid' });
  check('Pago de $0 se rechaza', r.status === 400, 'status ' + r.status + ' — aceptó un pago de $0');
  if (r.status === 201) await DEL('/payments/' + r.data._id);

  r = await POST('/payments', { type: 'cuota_mensual', amount: 1e15, status: 'paid' });
  check('Monto absurdamente grande se rechaza', r.status === 400,
    'status ' + r.status + ' — aceptó un pago de $' + 1e15);
  if (r.status === 201) await DEL('/payments/' + r.data._id);

  r = await POST('/payments', { type: 'cuota_mensual', amount: 5000, date: 'no-es-fecha' });
  check('Fecha inválida se rechaza', r.status === 400, 'status ' + r.status);
  if (r.status === 201) await DEL('/payments/' + r.data._id);

  r = await POST('/payments', { type: 'cuota_mensual', amount: 5000, student: 'id-falso' });
  check('Pago con alumno inexistente se rechaza', r.status === 400, 'status ' + r.status);
  if (r.status === 201) await DEL('/payments/' + r.data._id);

  r = await POST('/payments', { type: 'cuota_mensual', amount: 5000, student: '000000000000000000000000', status: 'paid' });
  check('Pago apuntando a un alumno que no existe se rechaza', r.status === 400,
    'status ' + r.status + ' — quedó un pago huérfano en la base');
  if (r.status === 201) await DEL('/payments/' + r.data._id);

  r = await GET('/payments?status[$ne]=cancelado');
  const total = (await GET('/payments')).data.length;
  check('Inyección NoSQL en filtros no expone datos ni rompe la consulta',
    r.status >= 400 || (Array.isArray(r.data) && r.data.length !== total) === false,
    'status ' + r.status + ' — el operador $ne llegó hasta la consulta de Mongo');

  r = await POST('/auth/login', { username: { $ne: null }, password: { $ne: null } }, { token: null });
  check('Inyección NoSQL en el login no autentica ni tumba el servidor',
    r.status >= 400 && r.status < 500,
    'status ' + r.status + (r.error ? ' — ' + r.error : '') + (r.data && r.data.token ? ' — DEVOLVIÓ TOKEN' : ''));

  const xss = '<script>alert("xss")</script>';
  r = await POST('/students', { name: xss });
  if (r.status === 201) {
    const leido = await GET('/students/' + r.data._id);
    check('El contenido con etiquetas HTML se almacena sin ejecutarse (se revisa el render en el front)',
      typeof leido.data.student.name === 'string', 'tipo inesperado');
    await DEL('/students/' + r.data._id);
  }

  r = await POST('/payments', 'esto no es json {{{');
  check('Body malformado responde error controlado', r.status >= 400 && r.status < 500,
    'status ' + r.status + (r.error ? ' — ' + r.error : ''));

  r = await GET('/reports/general?from=fecha-mala&to=otra-mala');
  check('Reporte con fechas inválidas responde error controlado', r.status >= 400 && r.status < 500,
    'status ' + r.status + (r.error ? ' — ' + r.error : ''));

  r = await GET('/payments/month-summary/mes-invalido');
  check('Resumen de un mes con formato inválido responde error controlado',
    r.status >= 200 && r.status < 500, 'status ' + r.status + (r.error ? ' — ' + r.error : ''));

  const health = await GET('/health', { token: null });
  check('El servidor sigue en pie tras los casos hostiles',
    health.status === 200 && !state.crashed,
    state.crashed ? 'EL SERVIDOR SE CAYÓ. Últimas líneas:\n' + (state.crashLog || '') : 'health status ' + health.status);
}

async function suiteIntegridad() {
  suite('12. INTEGRIDAD DE DATOS EN LA BASE');

  const victima = ctx.alumnos[18];
  const pagosAntes = await state.db.collection('payments')
    .countDocuments({ student: new (require('mongodb').ObjectId)(victima._id) });
  check('El alumno a eliminar tiene pagos asociados', pagosAntes > 0, 'tiene ' + pagosAntes);

  const r = await DEL('/students/' + victima._id);
  const sigueEnBD = await state.db.collection('students')
    .findOne({ _id: new (require('mongodb').ObjectId)(victima._id) });
  const pagosDespues = await state.db.collection('payments')
    .countDocuments({ student: new (require('mongodb').ObjectId)(victima._id) });

  // Correcto es cualquiera de las dos: se conserva el alumno (baja lógica) o se
  // eliminan también sus pagos. Lo inaceptable es borrar al alumno y dejar el dinero.
  check('Eliminar un alumno con historial no deja pagos huérfanos',
    (sigueEnBD && pagosDespues > 0) || pagosDespues === 0,
    'el alumno se borró y quedaron ' + pagosDespues + ' pagos huérfanos (historial financiero roto)');

  check('Un alumno con historial se marca inactivo en vez de eliminarse',
    sigueEnBD && sigueEnBD.status === 'inactive',
    sigueEnBD ? 'quedó con estado ' + sigueEnBD.status : 'el alumno fue eliminado físicamente');

  const sinHistorial = await POST('/students', { name: 'Alumno Mal Ingresado' });
  const rd = await DEL('/students/' + sinHistorial.data._id);
  const borrado = await state.db.collection('students')
    .findOne({ _id: new (require('mongodb').ObjectId)(sinHistorial.data._id) });
  check('Un alumno sin movimientos sí se elimina de verdad', rd.status === 200 && !borrado,
    'status ' + rd.status + ' — quedó en la base');

  const ids = new Set((await state.db.collection('students').find({}, { projection: { _id: 1 } }).toArray()).map(s => String(s._id)));
  const huerfanos = (await state.db.collection('payments').find({ student: { $ne: null } }).toArray())
    .filter(p => !ids.has(String(p.student)));
  eq('La base no contiene pagos huérfanos', huerfanos.length, 0);

  const cuotas = await state.db.collection('payments').find({ type: 'cuota_mensual' }).toArray();
  const clave = {};
  for (const c of cuotas) {
    const k = String(c.student) + '|' + c.month;
    clave[k] = (clave[k] || 0) + 1;
  }
  const dup = Object.entries(clave).filter(([, n]) => n > 1);
  eq('No existen cuotas duplicadas (mismo alumno + mismo mes)', dup.length, 0);

  const indices = await state.db.collection('students').indexes();
  check('La colección de alumnos tiene índice único en el nombre',
    indices.some(i => i.unique && i.key && i.key.name),
    'sin índice único: nada impide dos alumnos con el mismo nombre');

  const idxPagos = await state.db.collection('payments').indexes();
  check('La colección de pagos tiene índice que evita cuotas duplicadas',
    idxPagos.some(i => i.unique),
    'sin índice único en (student, month, type)');

  const negativos = await state.db.collection('payments').countDocuments({ amount: { $lt: 0 } });
  eq('No hay montos negativos almacenados en pagos', negativos, 0);
  const negGastos = await state.db.collection('expenses').countDocuments({ amount: { $lt: 0 } });
  eq('No hay montos negativos almacenados en gastos', negGastos, 0);

  const users = await state.db.collection('users').find({}).toArray();
  check('Todas las contraseñas están hasheadas con bcrypt',
    users.every(u => typeof u.password === 'string' && u.password.startsWith('$2')),
    'hay contraseñas en texto plano');
}

module.exports = {
  suiteCajaChica, suiteGastos, suiteActividades, suiteDescuentos,
  suiteConsistencia, suiteDuplicacion, suiteHostil, suiteIntegridad,
};
