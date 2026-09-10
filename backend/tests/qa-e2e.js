// Auditoría E2E de KinderFunds. Ejecuta: npm run qa
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record, state } = H;

const CUOTA = 5000;
const NOMBRES = [
  'Sofía González', 'Mateo Rojas', 'Emilia Pérez', 'Vicente Soto', 'Isabella Muñoz',
  'Agustín Contreras', 'Florencia Silva', 'Benjamín Torres', 'Antonella Vargas', 'Maximiliano Fuentes',
  'Catalina Herrera', 'Tomás Espinoza', 'Josefa Cárdenas', 'Lucas Sepúlveda', 'Amanda Riquelme',
  'Joaquín Navarro', 'Renata Fuentealba', 'Gaspar Molina', 'Trinidad Bustos',
];
const MESES = ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
// Índices de alumnos que NO pagan cada mes (morosidad simulada).
const MOROSOS = {
  '2026-03': [], '2026-04': [4, 11], '2026-05': [6], '2026-06': [2],
  '2026-07': [], '2026-08': [4, 8], '2026-09': [], '2026-10': [11],
  '2026-11': [], '2026-12': [1, 3, 5, 7],
};

// Contabilidad paralela calculada por la suite y contrastada contra la app.
const libro = {
  cuotasGeneradas: 0, cuotasPagadas: 0,
  ingresoCuotas: 0, ingresoActividades: 0, ingresoCajaChicaPagos: 0,
  gastoGeneral: 0, gastoCajaChica: 0,
  descuentoCuotas: 0, descuentoCajaChica: 0,
  cajaChicaIngresos: 0, cajaChicaEgresos: 0,
};
const ctx = { alumnos: [], tardio: null, actividad: null };

async function suiteAuth() {
  suite('1. AUTENTICACIÓN Y AUTORIZACIÓN');

  let r = await POST('/auth/login', { username: 'tesorera', password: 'incorrecta' }, { token: null });
  eq('Login con contraseña incorrecta devuelve 401', r.status, 401);

  r = await POST('/auth/login', { username: 'noexiste', password: 'x' }, { token: null });
  eq('Login con usuario inexistente devuelve 401', r.status, 401);
  check('No revela si el usuario existe (mismo mensaje)', r.data && r.data.message === 'Credenciales incorrectas.', r.data && r.data.message);

  r = await POST('/auth/login', {}, { token: null });
  eq('Login sin credenciales devuelve 400', r.status, 400);

  r = await POST('/auth/login', { username: '  TESORERA  ', password: 'Kinder2026!' }, { token: null });
  eq('Login normaliza espacios y mayúsculas', r.status, 200);

  r = await GET('/students', { token: null });
  eq('Endpoint protegido sin token devuelve 401', r.status, 401);

  r = await GET('/students', { token: 'basura.invalida.token' });
  eq('Token inválido devuelve 401', r.status, 401);

  const jwt = require('jsonwebtoken');
  const expirado = jwt.sign({ id: '000000000000000000000000' }, 'qa-secret-solo-para-pruebas', { expiresIn: '-1h' });
  r = await GET('/students', { token: expirado });
  eq('Token expirado devuelve 401', r.status, 401);

  const otroSecreto = jwt.sign({ id: '000000000000000000000000' }, 'secreto-del-atacante', { expiresIn: '1h' });
  r = await GET('/students', { token: otroSecreto });
  eq('Token firmado con otro secreto devuelve 401', r.status, 401);

  r = await GET('/auth/me');
  check('GET /auth/me devuelve el usuario', r.data && r.data.user && r.data.user.username === 'tesorera', JSON.stringify(r.data));
  check('GET /auth/me NO expone el hash de contraseña', !(r.data && r.data.user && r.data.user.password), 'password presente en la respuesta');

  r = await POST('/users', { username: 'apoderado', password: 'Lectura2026', name: 'Apoderado Lector', role: 'viewer' });
  eq('Se crea usuario con perfil viewer', r.status, 201);
  const vlogin = await POST('/auth/login', { username: 'apoderado', password: 'Lectura2026' }, { token: null });
  const vtoken = vlogin.data && vlogin.data.token;
  ctx.vtoken = vtoken;

  r = await GET('/students', { token: vtoken });
  eq('Viewer puede leer alumnos', r.status, 200);
  r = await POST('/students', { name: 'Intruso Escritor' }, { token: vtoken });
  eq('Viewer NO puede crear alumnos (403)', r.status, 403);
  r = await POST('/payments', { type: 'cuota_mensual', amount: 5000 }, { token: vtoken });
  eq('Viewer NO puede crear pagos (403)', r.status, 403);
  r = await GET('/users', { token: vtoken });
  eq('Viewer NO puede listar usuarios (403)', r.status, 403);
  r = await POST('/petty-cash', { type: 'expense', amount: 1000 }, { token: vtoken });
  eq('Viewer NO puede mover caja chica (403)', r.status, 403);
  r = await DEL('/students/000000000000000000000000', { token: vtoken });
  eq('Viewer NO puede eliminar (403)', r.status, 403);
  r = await POST('/expenses', { category: 'otro', amount: 1000, description: 'x' }, { token: vtoken });
  eq('Viewer NO puede crear gastos (403)', r.status, 403);
  r = await POST('/discounts', { description: 'x', amount: 100, source: 'caja_chica' }, { token: vtoken });
  eq('Viewer NO puede crear descuentos (403)', r.status, 403);
  r = await POST('/activities', { name: 'x', date: '2026-05-01' }, { token: vtoken });
  eq('Viewer NO puede crear actividades (403)', r.status, 403);
}

async function suiteAlumnos() {
  suite('2. ALUMNOS');

  for (const name of NOMBRES) {
    const r = await POST('/students', { name });
    if (r.status !== 201) { record(false, 'Crear alumno ' + name, JSON.stringify(r)); continue; }
    ctx.alumnos.push(r.data);
  }
  eq('Se crean los 19 alumnos del curso', ctx.alumnos.length, 19);

  const enBD = await state.db.collection('students').countDocuments();
  eq('BD: 19 alumnos persistidos realmente', enBD, 19);

  let r = await POST('/students', { name: '' });
  eq('Rechaza alumno sin nombre', r.status, 400);
  r = await POST('/students', {});
  eq('Rechaza alumno con body vacío', r.status, 400);

  r = await POST('/students', { name: '   ' });
  check('Rechaza alumno con nombre de solo espacios', r.status === 400,
    'status ' + r.status + ' — quedó creado con nombre vacío: ' + JSON.stringify(r.data && r.data.name));
  if (r.status === 201) await DEL('/students/' + r.data._id);

  r = await POST('/students', { name: NOMBRES[0] });
  check('Detecta alumno duplicado', r.status === 409 || r.status === 400,
    'status ' + r.status + ': permite dos alumnos llamados "' + NOMBRES[0] + '"');
  if (r.status === 201) await DEL('/students/' + r.data._id);

  r = await POST('/students', { name: 'Estado Inventado', status: 'zombie' });
  check('Rechaza estado fuera del enum', r.status === 400, 'status ' + r.status);
  if (r.status === 201) await DEL('/students/' + r.data._id);

  r = await GET('/students/' + ctx.alumnos[0]._id);
  check('La ficha del alumno incluye su historial de pagos', Array.isArray(r.data && r.data.payments), JSON.stringify(r.data).slice(0, 120));

  r = await GET('/students/000000000000000000000000');
  eq('Alumno inexistente devuelve 404', r.status, 404);

  r = await PUT('/students/' + ctx.alumnos[0]._id, { name: 'Sofía González Ríos' });
  eq('Edita el nombre de un alumno', r.status, 200);
  await PUT('/students/' + ctx.alumnos[0]._id, { name: NOMBRES[0] });

  r = await GET('/students?status=active');
  eq('Filtro status=active devuelve 19', r.data && r.data.length, 19);
  r = await GET('/students?status=inactive');
  eq('Filtro status=inactive devuelve 0', r.data && r.data.length, 0);
}

async function suiteCuotas() {
  suite('3. SIMULACIÓN FINANCIERA — 10 MESES DE CUOTAS');

  for (const mes of MESES) {
    if (mes === '2026-09' && !ctx.tardio) {
      const rn = await POST('/students', { name: 'Martina Aguilera' });
      ctx.tardio = rn.data;
      record(rn.status === 201, 'Ingresa alumna nueva en septiembre (Martina Aguilera)', JSON.stringify(rn.data));
    }

    const activos = (await GET('/students?status=active')).data.length;
    const gen = await POST('/payments/generate-monthly', { month: mes, amount: CUOTA, description: 'Cuota mensual ' + mes });
    if (gen.status !== 201) { record(false, 'Generar cuotas ' + mes, JSON.stringify(gen)); continue; }

    const cuotas = (await GET('/payments?type=cuota_mensual&month=' + mes)).data;
    eq(mes + ': se genera una cuota por alumno activo (' + activos + ')', cuotas.length, activos);
    libro.cuotasGeneradas += activos;

    const morosos = MOROSOS[mes] || [];
    let pagadasMes = 0;
    for (const cuota of cuotas) {
      const sid = cuota.student && (cuota.student._id || cuota.student);
      const idx = ctx.alumnos.findIndex(a => a._id === sid);
      if (idx !== -1 && morosos.includes(idx)) continue;
      const rp = await PUT('/payments/' + cuota._id, { status: 'paid', date: mes + '-05' });
      if (rp.status === 200) { pagadasMes++; libro.cuotasPagadas++; libro.ingresoCuotas += CUOTA; }
      else record(false, 'Marcar pagada una cuota de ' + mes, JSON.stringify(rp));
    }
    eq(mes + ': ' + (activos - morosos.length) + ' cuotas quedan pagadas', pagadasMes, activos - morosos.length);

    if (mes === '2026-05') {
      const abril = (await GET('/payments?type=cuota_mensual&month=2026-04&status=pending')).data;
      let regularizadas = 0;
      for (const c of abril) {
        const rr = await PUT('/payments/' + c._id, { status: 'paid', date: '2026-05-20' });
        if (rr.status === 200) { regularizadas++; libro.cuotasPagadas++; libro.ingresoCuotas += CUOTA; }
      }
      eq('Mayo: se regularizan las 2 cuotas atrasadas de abril', regularizadas, 2);
    }
  }

  const marzo = (await GET('/payments/month-summary/2026-03')).data;
  eq('Marzo: esperado = 19 x $5.000 = $95.000', marzo.totalExpected, 95000);
  eq('Marzo: pagado = $95.000', marzo.totalPaid, 95000);
  eq('Marzo: pendiente = $0', marzo.totalPending, 0);

  const abril = (await GET('/payments/month-summary/2026-04')).data;
  eq('Abril: tras regularizar, pagado = $95.000', abril.totalPaid, 95000);
  eq('Abril: pendiente = $0', abril.totalPending, 0);

  const activosDic = (await GET('/students?status=active')).data.length;
  const dic = (await GET('/payments/month-summary/2026-12')).data;
  eq('Diciembre: esperado = ' + activosDic + ' x $5.000', dic.totalExpected, activosDic * CUOTA);
  eq('Diciembre: 4 morosos => pendiente $20.000', dic.totalPending, 20000);

  const todas = (await GET('/payments?type=cuota_mensual')).data;
  eq('Cuotas generadas: app vs libro contable', todas.length, libro.cuotasGeneradas);
  const pagadas = todas.filter(p => p.status === 'paid');
  eq('Cuotas pagadas: app vs libro contable', pagadas.length, libro.cuotasPagadas);
  eq('Recaudación por cuotas: app vs libro contable', pagadas.reduce((s, p) => s + p.amount, 0), libro.ingresoCuotas);
}

async function suiteRegenerar() {
  suite('4. REGENERACIÓN DE CUOTAS (riesgo de cobro duplicado)');

  const mes = '2026-03';
  const antes = (await GET('/payments?type=cuota_mensual&month=' + mes)).data;
  const pagadasAntes = antes.filter(p => p.status === 'paid').length;
  eq('Marzo parte con 19 cuotas, todas pagadas', pagadasAntes, 19);

  const idsPagadasAntes = antes.filter(p => p.status === 'paid').map(p => p._id).sort();

  const regen = await POST('/payments/generate-monthly', { month: mes, amount: CUOTA, description: 'Regeneración accidental' });
  const despues = (await GET('/payments?type=cuota_mensual&month=' + mes)).data;

  // Lo grave no es que el total cambie (puede haber alumnos nuevos sin cuota de
  // ese mes), sino que un alumno que YA pagó reciba una segunda cuota pendiente.
  const porAlumno = {};
  for (const p of despues) {
    const sid = String(p.student && (p.student._id || p.student));
    porAlumno[sid] = (porAlumno[sid] || 0) + 1;
  }
  const duplicados = Object.values(porAlumno).filter(n => n > 1).length;
  eq('Ningún alumno queda con dos cuotas del mismo mes tras regenerar', duplicados, 0);

  const pagadasDespues = despues.filter(p => p.status === 'paid').map(p => p._id).sort();
  eq('Regenerar NO borra ni altera las cuotas ya pagadas', pagadasDespues, idsPagadasAntes);

  check('La respuesta informa cuántas cuotas creó y cuántas respetó',
    regen.data && (regen.data.created !== undefined && regen.data.skipped !== undefined),
    JSON.stringify(regen.data));

  // Regenerar dos veces seguidas no debe crear nada nuevo.
  const otra = await POST('/payments/generate-monthly', { month: mes, amount: CUOTA });
  eq('Regenerar de nuevo no crea ninguna cuota adicional', otra.data && otra.data.created, 0);

  // Deja marzo con solo las 19 cuotas pagadas originales.
  const sobrantes = (await GET('/payments?type=cuota_mensual&month=' + mes)).data.filter(p => p.status === 'pending');
  for (const p of sobrantes) await DEL('/payments/' + p._id);
  const final = (await GET('/payments?type=cuota_mensual&month=' + mes)).data;
  record(final.length === 19, 'Marzo restaurado a 19 cuotas para continuar la auditoría', 'quedaron ' + final.length);
}

module.exports = { suiteAuth, suiteAlumnos, suiteCuotas, suiteRegenerar, libro, ctx, CUOTA, MESES };
