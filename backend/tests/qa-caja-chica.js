// Sección Caja Chica: saldo inicial, saldo corrido y la fórmula del saldo.
//
// La base es compartida con el resto de la auditoría, así que en vez de asumir
// cifras absolutas se verifica la INVARIANTE (saldo = inicial + ingresos - gastos)
// y los cambios relativos al aplicar cada movimiento.
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record } = H;
const A = require('./qa-e2e');
const { ctx } = A;

const clp = (n) => '$' + n.toLocaleString('es-CL');

async function suiteCajaChicaSeccion() {
  suite('19. CAJA CHICA — saldo inicial y fórmula del saldo');

  let r = await GET('/petty-cash');
  const base = r.data;
  eq('El saldo inicial arranca en $0 y no rompe nada', base.initialBalance, 0);
  check('La respuesta trae los campos de la sección',
    ['initialBalance', 'currentBalance', 'movementCount', 'totalIncome', 'totalExpense'].every(k => base[k] !== undefined),
    JSON.stringify(Object.keys(base)));
  eq('Saldo disponible = inicial + ingresos - gastos',
    base.currentBalance, base.initialBalance + base.totalIncome - base.totalExpense);
  eq('La cantidad de movimientos coincide con las filas listadas', base.movementCount, base.movements.length);

  // Cada fila debe traer su saldo resultante.
  check('Cada movimiento trae su saldo resultante',
    base.movements.every(m => typeof m.balanceAfter === 'number'),
    'faltan balanceAfter en algunas filas');

  // El saldo corrido, recorrido de la más antigua a la más nueva, debe reconstruir
  // exactamente el saldo disponible.
  const cronologico = base.movements.slice().reverse();
  let acumulado = base.initialBalance;
  let corridoOk = true;
  for (const m of cronologico) {
    acumulado += m.type === 'income' ? m.amount : -m.amount;
    if (m.balanceAfter !== acumulado) { corridoOk = false; break; }
  }
  check('El saldo resultante de cada fila cuadra con el acumulado', corridoOk,
    'la columna de saldo resultante no sigue la secuencia de movimientos');
  eq('El último saldo resultante es el saldo disponible',
     cronologico.length ? cronologico[cronologico.length - 1].balanceAfter : base.initialBalance,
     base.currentBalance);

  suite('20. CAJA CHICA — el ejemplo de la especificación');

  // Saldo inicial 10.000, ingreso +5.000, gasto -2.000, gasto -1.500 => 11.500
  const antes = (await GET('/petty-cash')).data;
  r = await PUT('/petty-cash/initial-balance', { amount: 10000 });
  eq('Se configura un saldo inicial de $10.000', r.status, 200);
  eq('El endpoint devuelve el saldo inicial guardado', r.data.initialBalance, 10000);

  const conInicial = (await GET('/petty-cash')).data;
  eq('El saldo disponible sube exactamente en $10.000', conInicial.currentBalance, antes.currentBalance + 10000);

  const alumno = ctx.alumnos[4]._id;
  const ing = await POST('/petty-cash', { type: 'income', amount: 5000, student: alumno, date: '2026-09-09' });
  const g1  = await POST('/petty-cash', { type: 'expense', amount: 2000, date: '2026-09-09' });
  const g2  = await POST('/petty-cash', { type: 'expense', amount: 1500, date: '2026-09-09' });
  record([ing, g1, g2].every(x => x.status === 201), 'Se registran +$5.000, −$2.000 y −$1.500',
    JSON.stringify([ing.status, g1.status, g2.status]));

  const final = (await GET('/petty-cash')).data;
  eq('Ingresos suben en $5.000', final.totalIncome, conInicial.totalIncome + 5000);
  eq('Gastos suben en $3.500', final.totalExpense, conInicial.totalExpense + 3500);
  eq('El saldo neto del ejemplo aporta +$1.500 (5000 - 2000 - 1500)',
     final.currentBalance, conInicial.currentBalance + 1500);
  eq('La fórmula se sigue cumpliendo tras los movimientos',
     final.currentBalance, final.initialBalance + final.totalIncome - final.totalExpense);
  eq('El contador de movimientos sube en 3', final.movementCount, conInicial.movementCount + 3);

  record(true, `Comprobado: ${clp(10000)} inicial + ${clp(5000)} − ${clp(2000)} − ${clp(1500)} sobre el saldo previo`, '');

  suite('21. CAJA CHICA — validaciones y seguridad del saldo inicial');

  r = await PUT('/petty-cash/initial-balance', { amount: -5000 });
  eq('Saldo inicial negativo se rechaza', r.status, 400);
  r = await PUT('/petty-cash/initial-balance', { amount: 'mucha plata' });
  eq('Saldo inicial no numérico se rechaza', r.status, 400);
  r = await PUT('/petty-cash/initial-balance', {});
  eq('Saldo inicial ausente se rechaza', r.status, 400);
  r = await PUT('/petty-cash/initial-balance', { amount: 1e15 });
  eq('Saldo inicial desmesurado se rechaza', r.status, 400);
  r = await PUT('/petty-cash/initial-balance', { amount: 0 });
  eq('Saldo inicial $0 sí se acepta', r.status, 200);
  await PUT('/petty-cash/initial-balance', { amount: 10000 });

  r = await PUT('/petty-cash/initial-balance', { amount: 999 }, { token: null });
  eq('Sin sesión no se puede tocar el saldo inicial (401)', r.status, 401);
  r = await PUT('/petty-cash/initial-balance', { amount: 999 }, { token: ctx.vtoken });
  eq('Un perfil viewer no puede tocar el saldo inicial (403)', r.status, 403);
  r = await GET('/petty-cash/initial-balance', { token: ctx.vtoken });
  eq('Un viewer sí puede consultarlo', r.status, 200);
  r = await GET('/petty-cash', { token: null });
  eq('La caja chica completa sigue sin ser pública (401)', r.status, 401);

  const trasIntentos = (await GET('/petty-cash')).data;
  eq('Los intentos rechazados no alteraron el saldo inicial', trasIntentos.initialBalance, 10000);

  suite('22. CAJA CHICA — coherencia con el resto de la aplicación');

  const dash = (await GET('/dashboard/summary')).data;
  eq('El dashboard muestra el mismo saldo de caja chica', dash.balance.pettyCash, trasIntentos.currentBalance);

  const rep = (await GET('/reports/petty-cash')).data;
  eq('El reporte de caja chica muestra el mismo saldo disponible', rep.currentBalance, trasIntentos.currentBalance);
  eq('El reporte informa el mismo saldo inicial', rep.initialBalance, 10000);

  // El saldo inicial es del fondo, no de un alumno: no debe alterar su estado de cuenta.
  const alumnoPub = ctx.alumnos[0]._id;
  const antesPub = (await GET(`/public/students/${alumnoPub}/statement`, { token: null })).data.pettyCash;
  await PUT('/petty-cash/initial-balance', { amount: 50000 });
  const despuesPub = (await GET(`/public/students/${alumnoPub}/statement`, { token: null })).data.pettyCash;
  eq('El saldo inicial del fondo NO altera la caja chica de un alumno',
     JSON.stringify(despuesPub), JSON.stringify(antesPub));

  // Se deja la caja como estaba para no contaminar el resto de la auditoría.
  await PUT('/petty-cash/initial-balance', { amount: 0 });
  for (const m of [ing, g1, g2]) if (m.status === 201) await DEL('/petty-cash/' + m.data._id);

  const restaurada = (await GET('/petty-cash')).data;
  eq('Caja chica restaurada: saldo inicial en $0', restaurada.initialBalance, 0);
  eq('Caja chica restaurada: mismo saldo que al empezar', restaurada.currentBalance, base.currentBalance);
  eq('Caja chica restaurada: mismos movimientos', restaurada.movementCount, base.movementCount);
}

module.exports = { suiteCajaChicaSeccion };
