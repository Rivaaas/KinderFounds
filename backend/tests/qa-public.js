// Consulta pública de estado de cuenta: los 12 casos pedidos.
//
// Los datos de prueba usan el año 2027 y meses Enero..Octubre para no chocar con
// la simulación principal (2026, Marzo..Diciembre) y, de paso, comprobar que el
// detalle mensual se construye desde los registros y no desde meses fijos.
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record } = H;

const CUOTA = 5000;
const CAJA  = 10000;
const MESES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

const pub = {};

// Crea un alumno con N cuotas pagadas de 10, y caja chica pagada o no.
const crearAlumno = async (nombre, cuotasPagadas, cajaPagada) => {
  const r = await POST('/students', { name: nombre });
  if (r.status !== 201) { record(false, 'Fixture: crear ' + nombre, JSON.stringify(r)); return null; }
  const id = r.data._id;

  for (let i = 0; i < MESES.length; i++) {
    const rp = await POST('/payments', {
      type: 'cuota_mensual', amount: CUOTA, month: `2027-${MESES[i]}`,
      student: id, date: `2027-${MESES[i]}-05`,
      status: i < cuotasPagadas ? 'paid' : 'pending',
    });
    if (rp.status !== 201) record(false, `Fixture: cuota ${MESES[i]} de ${nombre}`, JSON.stringify(rp));
  }

  const rc = await POST('/payments', {
    type: 'caja_chica', amount: CAJA, student: id, date: '2027-01-05',
    status: cajaPagada ? 'paid' : 'pending', description: 'Cuota única de caja chica',
  });
  if (rc.status !== 201) record(false, `Fixture: caja chica de ${nombre}`, JSON.stringify(rc));

  return id;
};

async function suitePublica() {
  suite('15. CONSULTA PÚBLICA — datos de prueba');

  pub.nadie   = await crearAlumno('Zulema Nada Paga', 0, false);   // Caso 1
  pub.cuotas  = await crearAlumno('Zulema Cuotas Completas', 10, false); // Caso 2
  pub.caja    = await crearAlumno('Zulema Solo Caja', 0, true);     // Caso 3
  pub.todo    = await crearAlumno('Zulema Todo Pagado', 10, true);  // Caso 4
  pub.mitad   = await crearAlumno('Zulema Cinco Cuotas', 5, false); // Caso 5
  record(Object.values(pub).every(Boolean), 'Se crean los 5 alumnos de prueba', JSON.stringify(pub));

  suite('16. CONSULTA PÚBLICA — acceso sin autenticación');

  let r = await GET('/public/students?q=zulema', { token: null });
  eq('La búsqueda pública responde SIN token', r.status, 200);
  check('Devuelve los 5 alumnos de prueba', (r.data.results || []).length >= 5, JSON.stringify(r.data).slice(0, 200));
  check('Solo expone id, nombre y si está activo (nada financiero)',
    r.data.results.every(a => Object.keys(a).sort().join(',') === 'active,id,name'),
    JSON.stringify(r.data.results[0]));

  r = await GET(`/public/students/${pub.todo}/statement`, { token: null });
  eq('El estado de cuenta responde SIN token', r.status, 200);
  check('No expone identificadores internos de los pagos',
    !JSON.stringify(r.data).includes('"_id"'), 'aparece _id en la respuesta');
  check('No expone al resto del curso', !JSON.stringify(r.data).includes('Zulema Nada'), 'aparecen otros alumnos');

  suite('17. CONSULTA PÚBLICA — los 12 casos');

  // Caso 1: no ha pagado nada
  let s = (await GET(`/public/students/${pub.nadie}/statement`, { token: null })).data;
  eq('Caso 1 — total a pagar $60.000', s.summary.total, 60000);
  eq('Caso 1 — pagado $0', s.summary.paid, 0);
  eq('Caso 1 — pendiente $60.000', s.summary.pending, 60000);
  eq('Caso 1 — estado "sin_pagos" (🔴 Pendiente de pago)', s.summary.estado, 'sin_pagos');

  // Caso 2: pagó las 10 cuotas
  s = (await GET(`/public/students/${pub.cuotas}/statement`, { token: null })).data;
  eq('Caso 2 — cuotas pagadas $50.000', s.cuotas.paid, 50000);
  eq('Caso 2 — cuotas total $50.000', s.cuotas.total, 50000);
  eq('Caso 2 — cuotas pendientes $0', s.cuotas.pending, 0);
  eq('Caso 2 — caja chica pendiente $10.000', s.pettyCash.pending, 10000);
  eq('Caso 2 — estado "con_deuda" (🟠)', s.summary.estado, 'con_deuda');

  // Caso 3: pagó solo la caja chica
  s = (await GET(`/public/students/${pub.caja}/statement`, { token: null })).data;
  eq('Caso 3 — caja chica pagada $10.000', s.pettyCash.paid, 10000);
  eq('Caso 3 — caja chica pendiente $0', s.pettyCash.pending, 0);
  eq('Caso 3 — cuotas pendientes $50.000', s.cuotas.pending, 50000);

  // Caso 4: pagó todo
  s = (await GET(`/public/students/${pub.todo}/statement`, { token: null })).data;
  eq('Caso 4 — total $60.000', s.summary.total, 60000);
  eq('Caso 4 — pagado $60.000', s.summary.paid, 60000);
  eq('Caso 4 — pendiente $0', s.summary.pending, 0);
  eq('Caso 4 — estado "al_dia" (🟢 Cuenta al día)', s.summary.estado, 'al_dia');

  // Caso 5: pagó 5 cuotas
  s = (await GET(`/public/students/${pub.mitad}/statement`, { token: null })).data;
  eq('Caso 5 — cuotas pagadas $25.000', s.cuotas.paid, 25000);
  eq('Caso 5 — cuotas pendientes $25.000', s.cuotas.pending, 25000);
  eq('Caso 5 — caja chica pendiente $10.000', s.pettyCash.pending, 10000);
  eq('Caso 5 — total pendiente $35.000', s.summary.pending, 35000);
  eq('Caso 5 — detalle: 10 meses', s.cuotas.months.length, 10);
  eq('Caso 5 — detalle: 5 pagados', s.cuotas.months.filter(m => m.status === 'paid').length, 5);
  eq('Caso 5 — el detalle sale de los datos, no de meses fijos', s.cuotas.months[0].label, 'Enero 2027');

  // Caso 6: pago parcial registrado con otro monto
  const rp = await POST('/payments', {
    type: 'aporte_voluntario', amount: 3000, status: 'paid',
    student: pub.mitad, date: '2027-06-01', description: 'Abono parcial',
  });
  s = (await GET(`/public/students/${pub.mitad}/statement`, { token: null })).data;
  eq('Caso 6 — un aporte de otro tipo se refleja como "otros aportes"', s.otherPayments.paid, 3000);
  eq('Caso 6 — el pagado total sube a $28.000', s.summary.paid, 28000);
  eq('Caso 6 — el total exigido sube a $63.000', s.summary.total, 63000);
  eq('Caso 6 — el pendiente sigue siendo $35.000', s.summary.pending, 35000);
  if (rp.status === 201) await DEL('/payments/' + rp.data._id);

  // Caso 7: estudiante inexistente
  r = await GET('/public/students/000000000000000000000000/statement', { token: null });
  eq('Caso 7 — estudiante inexistente devuelve 404', r.status, 404);
  eq('Caso 7 — mensaje amable, sin detalles técnicos', r.data.message, 'No encontramos un estudiante con ese nombre.');
  r = await GET('/public/students/no-es-un-id/statement', { token: null });
  eq('Caso 7 — id con formato inválido devuelve 400 controlado', r.status, 400);
  check('Caso 7 — el error no filtra información interna',
    !/mongo|cast|stack|at |ObjectId/i.test(JSON.stringify(r.data)), JSON.stringify(r.data));

  // Caso 8: búsqueda parcial
  r = await GET('/public/students?q=Cinco', { token: null });
  check('Caso 8 — búsqueda parcial por segundo nombre encuentra al alumno',
    r.data.results.some(a => a.id === pub.mitad), JSON.stringify(r.data.results));
  r = await GET('/public/students?q=Completas', { token: null });
  check('Caso 8 — búsqueda por apellido encuentra al alumno',
    r.data.results.some(a => a.id === pub.cuotas), JSON.stringify(r.data.results));

  // Caso 9: mayúsculas/minúsculas y tildes
  r = await GET('/public/students?q=ZULEMA%20TODO', { token: null });
  check('Caso 9 — mayúsculas encuentran al alumno', r.data.results.some(a => a.id === pub.todo), JSON.stringify(r.data.results));
  r = await GET('/public/students?q=zulema%20todo', { token: null });
  check('Caso 9 — minúsculas encuentran al alumno', r.data.results.some(a => a.id === pub.todo), JSON.stringify(r.data.results));
  r = await GET('/public/students?q=gonzalez', { token: null });
  check('Caso 9 — búsqueda sin tildes encuentra nombres con tilde (GONZÁLEZ)',
    r.data.results.length === 0 || r.data.results.every(a => /gonz/i.test(a.name.normalize('NFD').replace(/[̀-ͯ]/g, ''))),
    JSON.stringify(r.data.results));

  // Caso 10: recargar / repetir la consulta da lo mismo (no hay caché ni estado)
  const a1 = (await GET(`/public/students/${pub.mitad}/statement`, { token: null })).data;
  const a2 = (await GET(`/public/students/${pub.mitad}/statement`, { token: null })).data;
  eq('Caso 10 — repetir la consulta devuelve exactamente lo mismo', JSON.stringify(a1), JSON.stringify(a2));

  // Caso 11 y 12: las rutas administrativas siguen protegidas
  for (const ruta of ['/students', '/payments', '/dashboard/summary', '/reports/general', '/petty-cash', '/users', '/expenses']) {
    const rr = await GET(ruta, { token: null });
    eq(`Caso 12 — ${ruta} sigue exigiendo autenticación (401)`, rr.status, 401);
  }
  r = await POST('/students', { name: 'Intruso Público' }, { token: null });
  eq('Caso 12 — no se puede crear un alumno sin token', r.status, 401);
  r = await DEL(`/students/${pub.nadie}`, { token: null });
  eq('Caso 12 — no se puede eliminar un alumno sin token', r.status, 401);

  suite('18. CONSULTA PÚBLICA — protecciones y coherencia con el panel');

  r = await GET('/public/students?q=z', { token: null });
  check('Una sola letra no devuelve resultados (evita listar el curso completo)',
    (r.data.results || []).length === 0, JSON.stringify(r.data).slice(0, 150));
  r = await GET('/public/students', { token: null });
  eq('Sin parámetro de búsqueda no devuelve nada', (r.data.results || []).length, 0);
  r = await GET('/public/students?q=', { token: null });
  eq('Búsqueda vacía no devuelve nada', (r.data.results || []).length, 0);

  r = await GET('/public/students?q[$ne]=x', { token: null });
  check('Inyección NoSQL en la búsqueda pública no expone datos',
    r.status === 200 && (r.data.results || []).length === 0, 'status ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 120));

  r = await GET('/public/students?q=' + encodeURIComponent('.*'), { token: null });
  check('Un comodín de expresión regular no lista a todo el curso',
    (r.data.results || []).length === 0, 'devolvió ' + (r.data.results || []).length + ' alumnos');

  // Nunca cifras negativas, aunque el alumno haya pagado de más.
  // Un movimiento de Caja Chica suma a lo pagado sin aumentar lo exigido, que es
  // la forma en que realmente se produce un excedente.
  const extra = await POST('/petty-cash', { type: 'income', amount: 3000, student: pub.todo, date: '2027-02-01' });
  s = (await GET(`/public/students/${pub.todo}/statement`, { token: null })).data;
  check('Un pago en exceso nunca produce un pendiente negativo', s.summary.pending === 0, 'pendiente: ' + s.summary.pending);
  eq('El excedente de caja chica se informa como tal', s.pettyCash.surplus, 3000);
  eq('El excedente aparece en el total general', s.summary.surplus, 3000);
  eq('El estado sigue siendo "al día" con excedente', s.summary.estado, 'al_dia');
  if (extra.status === 201) await DEL('/petty-cash/' + extra.data._id);

  // Una cuota anulada sale del total exigido
  const cuotasMitad = (await GET(`/payments?type=cuota_mensual&student=${pub.mitad}&status=pending`)).data;
  await PUT('/payments/' + cuotasMitad[0]._id, { status: 'cancelled' });
  s = (await GET(`/public/students/${pub.mitad}/statement`, { token: null })).data;
  eq('Una cuota anulada baja el total exigido de $50.000 a $45.000', s.cuotas.total, 45000);
  eq('Una cuota anulada se informa aparte', s.cuotas.cancelled, 5000);
  await PUT('/payments/' + cuotasMitad[0]._id, { status: 'pending' });

  // Lo que registra el tesorero se ve de inmediato en la consulta pública
  const antes = (await GET(`/public/students/${pub.mitad}/statement`, { token: null })).data.summary;
  const pendientes = (await GET(`/payments?type=cuota_mensual&student=${pub.mitad}&status=pending`)).data;
  await PUT('/payments/' + pendientes[0]._id, { status: 'paid', date: '2027-06-10' });
  const despues = (await GET(`/public/students/${pub.mitad}/statement`, { token: null })).data.summary;
  eq('El pago que registra el tesorero sube el pagado en $5.000', despues.paid, antes.paid + CUOTA);
  eq('...y baja el pendiente en $5.000', despues.pending, antes.pending - CUOTA);

  // La caja chica registrada desde la pantalla Caja Chica también cuenta
  const mov = await POST('/petty-cash', { type: 'income', amount: 2000, student: pub.nadie, date: '2027-03-01' });
  s = (await GET(`/public/students/${pub.nadie}/statement`, { token: null })).data;
  eq('Un movimiento de Caja Chica del alumno suma a su caja chica pagada', s.pettyCash.paid, 2000);
  eq('...y baja su pendiente de caja chica a $8.000', s.pettyCash.pending, 8000);
  if (mov.status === 201) await DEL('/petty-cash/' + mov.data._id);

  // Limpieza: los alumnos de prueba no deben contaminar la auditoría de integridad
  for (const id of Object.values(pub)) {
    if (!id) continue;
    for (const p of (await GET(`/payments?student=${id}`)).data) await DEL('/payments/' + p._id);
    await DEL('/students/' + id);
  }
  const quedan = (await GET('/public/students?q=zulema', { token: null })).data.results;
  eq('Los alumnos de prueba quedan eliminados', quedan.length, 0);
}

module.exports = { suitePublica };
