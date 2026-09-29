// Actividades y Cuotas: cuota por alumno, registro de pagos por participante y
// la lista pública de quiénes pagaron y quiénes no.
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record } = H;

const CUOTA = 5000;

async function suiteActividades() {
  suite('19. ACTIVIDADES Y CUOTAS — registro por alumno');

  const alumnos = [];
  for (const n of ['Ximena Stand Uno', 'Ximena Stand Dos', 'Ximena Stand Tres']) {
    const r = await POST('/students', { name: n });
    if (r.status !== 201) record(false, 'Fixture: crear ' + n, JSON.stringify(r));
    alumnos.push(r.data?._id);
  }
  const [a1, a2, a3] = alumnos;

  let r = await POST('/activities', {
    name: 'Stand Kermesse', type: 'otro', date: '2027-11-10',
    amountPerStudent: CUOTA, students: [a1, a2],
  });
  eq('Se crea la actividad con cuota por alumno', r.status, 201);
  eq('La cuota queda guardada', r.data?.amountPerStudent, CUOTA);
  eq('Por defecto es visible en la consulta pública', r.data?.publicVisible, true);
  const act = r.data?._id;

  r = await POST('/activities', { name: 'Mal', date: '2027-01-01', amountPerStudent: -5 });
  eq('Una cuota negativa se rechaza', r.status, 400);
  r = await POST('/activities', { name: 'Mal', date: '2027-01-01', amountPerStudent: 'abc' });
  eq('Una cuota no numérica se rechaza', r.status, 400);

  r = await GET(`/activities/${act}`);
  eq('El detalle trae la nómina de participantes', r.data?.roster?.length, 2);
  check('Sin pagos, todos figuran pendientes con la cuota de la actividad',
    r.data.roster.every((x) => x.status === 'pending' && x.amount === CUOTA), JSON.stringify(r.data.roster));
  eq('Totales: 0 pagados, 2 pendientes', [r.data.totals.paidCount, r.data.totals.pendingCount], [0, 2]);
  eq('Totales: esperado $10.000', r.data.totals.expected, CUOTA * 2);

  // Marcar pagado
  r = await PUT(`/activities/${act}/students/${a1}/payment`, { status: 'paid' });
  eq('Marcar "pagó" responde 200', r.status, 200);
  eq('El pago queda con tipo actividad', r.data?.type, 'actividad');
  eq('El pago toma la cuota de la actividad', r.data?.amount, CUOTA);
  eq('La descripción es el nombre de la actividad', r.data?.description, 'Stand Kermesse');
  check('El pago lleva fecha', !!r.data?.date, 'sin fecha');

  // Doble clic: no duplica
  r = await PUT(`/activities/${act}/students/${a1}/payment`, { status: 'paid' });
  eq('Un segundo "pagó" no falla', r.status, 200);
  const enBase = await H.state.db.collection('payments').countDocuments({ type: 'actividad', student: { $exists: true } });
  eq('En la base hay UN solo pago de actividad para ese alumno', enBase, 1);

  // Dos clics simultáneos
  await Promise.all([
    PUT(`/activities/${act}/students/${a2}/payment`, { status: 'paid' }),
    PUT(`/activities/${act}/students/${a2}/payment`, { status: 'paid' }),
  ]);
  const simult = await H.state.db.collection('payments').countDocuments({ type: 'actividad' });
  eq('Dos clics simultáneos tampoco duplican (índice único)', simult, 2);

  r = await GET(`/activities/${act}`);
  eq('Totales tras dos pagos: 2 pagados, 0 pendientes', [r.data.totals.paidCount, r.data.totals.pendingCount], [2, 0]);
  eq('Recaudado $10.000', r.data.totals.collected, CUOTA * 2);
  eq('El total recaudado histórico (totalIncome) coincide', r.data.totalIncome, CUOTA * 2);

  // Monto distinto y volver a pendiente
  r = await PUT(`/activities/${act}/students/${a1}/payment`, { status: 'paid', amount: 3000 });
  eq('Se puede ajustar el monto de un alumno', r.data?.amount, 3000);
  r = await PUT(`/activities/${act}/students/${a1}/payment`, { status: 'pending' });
  eq('Se puede volver a pendiente', r.data?.status, 'pending');
  r = await GET(`/activities/${act}`);
  eq('Tras volver a pendiente: 1 pagado, 1 pendiente', [r.data.totals.paidCount, r.data.totals.pendingCount], [1, 1]);

  // Alumno fuera de la lista: pasa a ser participante
  r = await PUT(`/activities/${act}/students/${a3}/payment`, { status: 'paid' });
  eq('Un alumno fuera de la lista puede pagar', r.status, 200);
  r = await GET(`/activities/${act}`);
  eq('Y pasa a figurar como participante', r.data.roster.length, 3);

  // Validaciones
  r = await PUT(`/activities/${act}/students/${a1}/payment`, { status: 'volando' });
  eq('Un estado inválido se rechaza', r.status, 400);
  r = await PUT(`/activities/${act}/students/000000000000000000000000/payment`, { status: 'paid' });
  eq('Un alumno inexistente devuelve 404', r.status, 404);
  r = await PUT(`/activities/${act}/students/no-id/payment`, { status: 'paid' });
  eq('Un id inválido devuelve 400', r.status, 400);

  r = await POST('/activities', { name: 'Sin cuota', date: '2027-01-01', students: [a1] });
  const sinCuota = r.data?._id;
  r = await PUT(`/activities/${sinCuota}/students/${a1}/payment`, { status: 'paid' });
  eq('Sin cuota definida ni monto, no se registra el pago', r.status, 400);
  r = await PUT(`/activities/${sinCuota}/students/${a1}/payment`, { status: 'paid', amount: 1500 });
  eq('Pero con monto explícito sí', r.status, 200);

  // Quitar registro
  r = await DEL(`/activities/${act}/students/${a3}/payment`);
  eq('Se puede quitar el registro de un alumno', r.status, 200);
  r = await DEL(`/activities/${act}/students/${a3}/payment`);
  eq('Quitarlo dos veces devuelve 404', r.status, 404);

  // El pago aparece en el estado de cuenta público del alumno
  r = await GET(`/public/students/${a2}/statement`, { token: null });
  eq('El estado de cuenta del alumno suma la cuota como "otros aportes"', r.data?.otherPayments?.paid, CUOTA);
  check('Y muestra el nombre de la actividad',
    (r.data?.otherPayments?.items || []).some((i) => i.description === 'Stand Kermesse'), JSON.stringify(r.data?.otherPayments));

  // Listado con resumen
  r = await GET('/activities');
  const tarjeta = (r.data || []).find((a) => a._id === act);
  check('El listado trae totales por actividad', tarjeta && tarjeta.totals && tarjeta.totals.paidCount === 1, JSON.stringify(tarjeta?.totals));

  suite('20. ACTIVIDADES Y CUOTAS — solo lectura y borrado');

  r = await POST('/users', { username: 'lector.act', password: 'Lector2026!', name: 'Lector', role: 'viewer' });
  const login = await POST('/auth/login', { username: 'lector.act', password: 'Lector2026!' }, { token: null });
  const tv = login.data?.token;
  r = await PUT(`/activities/${act}/students/${a1}/payment`, { status: 'paid' }, { token: tv });
  eq('Un viewer no puede marcar pagos', r.status, 403);
  r = await DEL(`/activities/${act}/students/${a2}/payment`, { token: tv });
  eq('Un viewer no puede quitar pagos', r.status, 403);
  r = await GET(`/activities/${act}`, { token: tv });
  eq('Un viewer sí ve la nómina', r.status, 200);
  r = await PUT(`/activities/${act}/students/${a1}/payment`, { status: 'paid' }, { token: null });
  eq('Sin token no se puede marcar pagos', r.status, 401);

  r = await DEL(`/activities/${act}`);
  eq('No se borra una actividad con cuotas registradas', r.status, 409);

  suite('21. CONSULTA PÚBLICA — actividades del curso');

  r = await GET('/public/activities', { token: null });
  eq('La lista pública responde SIN token', r.status, 200);
  const pub = (r.data?.activities || []).find((a) => a.name === 'Stand Kermesse');
  check('La actividad visible aparece', !!pub, JSON.stringify(r.data).slice(0, 300));
  eq('Muestra quiénes pagaron', pub?.paid, ['Ximena Stand Dos']);
  eq('Muestra quiénes no', pub?.pending, ['Ximena Stand Uno']);
  eq('Trae la cuota por alumno', pub?.amountPerStudent, CUOTA);
  eq('Trae los totales', [pub?.totals.paidCount, pub?.totals.pendingCount, pub?.totals.collected], [1, 1, CUOTA]);
  check('No expone identificadores internos', !JSON.stringify(r.data).includes('_id') && !JSON.stringify(r.data).includes('"id"'), 'aparece un id');
  check('Solo expone campos previstos por actividad',
    Object.keys(pub || {}).sort().join(',') === 'amountPerStudent,date,description,name,paid,pending,status,totals,type,typeLabel',
    Object.keys(pub || {}).join(','));

  await PUT(`/activities/${act}`, { publicVisible: false });
  r = await GET('/public/activities', { token: null });
  check('Una actividad oculta no aparece en la lista pública',
    !(r.data?.activities || []).some((a) => a.name === 'Stand Kermesse'), 'sigue apareciendo');
  await PUT(`/activities/${act}`, { publicVisible: true });

  r = await PUT('/public/activities', {}, { token: null });
  check('La ruta pública no acepta escrituras', r.status === 404 || r.status === 405, 'status ' + r.status);
}

module.exports = { suiteActividades };
