// Endurecimiento derivado de una auditoría de seguridad del perfil de solo
// lectura. Cada bloque cubre un riesgo que se comprobó explotable contra el
// servidor real, no una hipótesis.
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record, state } = H;
const { ESCRITURAS } = require('./qa-viewer');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function suiteEndurecimiento() {
  suite('29. REVOCACIÓN DE SESIÓN — cambiar la contraseña cierra las sesiones');

  // Antes, cambiar o resetear la clave NO expulsaba a nadie: el token seguía
  // sirviendo hasta expirar (7 días). El único corte era desactivar la cuenta.
  let r = await POST('/users', { username: 'revocable', password: 'Clave1Inicial', name: 'Cuenta Revocable', role: 'viewer' });
  eq('Se crea una cuenta de prueba', r.status, 201);
  const id = r.data && r.data.id;

  const sesion1 = (await POST('/auth/login', { username: 'revocable', password: 'Clave1Inicial' }, { token: null })).data.token;
  eq('La sesión recién abierta funciona', (await GET('/students', { token: sesion1 })).status, 200);

  // El administrador resetea la contraseña.
  r = await PUT(`/users/${id}/password`, { password: 'Clave2Reseteada' });
  eq('El administrador resetea la contraseña', r.status, 200);
  eq('El token anterior queda invalidado', (await GET('/students', { token: sesion1 })).status, 401);
  eq('La contraseña vieja ya no sirve', (await POST('/auth/login', { username: 'revocable', password: 'Clave1Inicial' }, { token: null })).status, 401);

  const sesion2 = (await POST('/auth/login', { username: 'revocable', password: 'Clave2Reseteada' }, { token: null })).data.token;
  eq('Con la contraseña nueva se abre una sesión válida', (await GET('/students', { token: sesion2 })).status, 200);

  // El propio usuario cambia su contraseña.
  r = await PUT('/auth/change-password', { currentPassword: 'Clave2Reseteada', newPassword: 'Clave3Propia' }, { token: sesion2 });
  eq('El usuario cambia su propia contraseña', r.status, 200);
  eq('Su token anterior también queda invalidado', (await GET('/students', { token: sesion2 })).status, 401);

  const sesion3 = (await POST('/auth/login', { username: 'revocable', password: 'Clave3Propia' }, { token: null })).data.token;
  eq('Vuelve a entrar con la nueva', (await GET('/students', { token: sesion3 })).status, 200);

  suite('30. CAMBIO DE CONTRASEÑA HOSTIL — no se puede colar nada en el cuerpo');

  r = await PUT('/auth/change-password', {
    currentPassword: 'Clave3Propia', newPassword: 'Clave4Final',
    role: 'admin', active: true, username: 'suplantado', _id: '000000000000000000000000', name: 'Otro',
  }, { token: sesion3 });
  eq('El cambio se acepta ignorando los campos de más', r.status, 200);

  const enBD = await state.db.collection('users').findOne({ _id: new (require('mongodb').ObjectId)(id) });
  eq('El rol sigue siendo viewer', enBD.role, 'viewer');
  eq('El nombre de usuario no cambió', enBD.username, 'revocable');
  eq('El nombre para mostrar no cambió', enBD.name, 'Cuenta Revocable');
  check('La contraseña quedó hasheada, no en claro', String(enBD.password).startsWith('$2'), enBD.password);

  await DEL(`/users/${id}`);

  suite('31. TABLA DE RUTAS POR REFLEXIÓN — ninguna escritura sin requireAdmin');

  // Recorrer las rutas escritas a mano deja fuera cualquiera que se agregue
  // mañana. Aquí se inspecciona el stack real de cada router.
  const MODULOS = {
    '/api/students': 'students', '/api/payments': 'payments', '/api/expenses': 'expenses',
    '/api/activities': 'activities', '/api/petty-cash': 'pettyCash', '/api/dashboard': 'dashboard',
    '/api/reports': 'reports', '/api/discounts': 'discounts', '/api/users': 'users', '/api/auth': 'auth',
  };
  // Escrituras que legítimamente NO exigen admin.
  const PERMITIDAS = new Set(['POST /api/auth/login', 'PUT /api/auth/change-password']);

  const mutantes = [];
  const sinProteger = [];

  for (const [prefijo, archivo] of Object.entries(MODULOS)) {
    const router = require(`../src/routes/${archivo}`);
    // Middlewares aplicados con router.use() a todo el router (por ejemplo protect).
    const globales = router.stack.filter((l) => !l.route).map((l) => l.handle && l.handle.name);

    for (const capa of router.stack) {
      if (!capa.route) continue;
      const metodos = Object.keys(capa.route.methods).filter((m) => ['post', 'put', 'patch', 'delete'].includes(m));
      if (metodos.length === 0) continue;

      const cadena = [...globales, ...capa.route.stack.map((s) => s.handle && s.handle.name)];
      for (const m of metodos) {
        const etiqueta = `${m.toUpperCase()} ${prefijo}${capa.route.path === '/' ? '' : capa.route.path}`;
        mutantes.push(etiqueta);
        if (!cadena.includes('requireAdmin') && !PERMITIDAS.has(etiqueta)) sinProteger.push(etiqueta);
      }
    }
  }

  check(`Se inspeccionaron ${mutantes.length} endpoints que escriben`, mutantes.length >= 24, `solo ${mutantes.length}`);
  eq('Ninguna escritura queda sin requireAdmin', sinProteger, []);

  // La matriz escrita a mano debe cubrir todo lo que existe de verdad.
  const cubiertos = new Set(ESCRITURAS.map(([m, u]) => `${m} /api${u}`.replace(/\/000000000000000000000000/g, '/:id')));
  const faltantes = mutantes
    .filter((e) => !PERMITIDAS.has(e))
    .filter((e) => !cubiertos.has(e.replace(/:[A-Za-z]+/g, ':id')));
  eq('La matriz de qa-viewer cubre el 100% de las escrituras reales', faltantes, []);

  suite('32. BÚSQUEDA PÚBLICA — no se puede reconstruir el padrón');

  // La auditoría recuperó el curso completo con 26 consultas de dos letras,
  // porque el filtro aceptaba subcadenas.
  r = await GET('/public/students?q=za', { token: null });
  eq('Dos caracteres ya no devuelven nada', (r.data.results || []).length, 0);

  const alumnos = (await GET('/students')).data;
  const victima = alumnos.find((a) => a.name.includes(' '));
  const palabra = victima.name.split(/\s+/).find((p) => p.length >= 6).toLowerCase();

  r = await GET(`/public/students?q=${encodeURIComponent(palabra.slice(0, 4))}`, { token: null });
  check('Buscar por el prefijo de una palabra sí encuentra al alumno',
    (r.data.results || []).some((a) => a.name === victima.name), `prefijo "${palabra.slice(0, 4)}"`);

  r = await GET(`/public/students?q=${encodeURIComponent(palabra.slice(2, 6))}`, { token: null });
  eq('Buscar por un fragmento del medio ya NO encuentra a nadie', (r.data.results || []).length, 0);

  // Barrido de dos letras: no debe recuperar un solo alumno.
  const letras = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const recuperados = new Set();
  for (const l of letras.slice(0, 12)) {
    const rb = await GET(`/public/students?q=${l}a`, { token: null });
    for (const a of rb.data.results || []) recuperados.add(a.id);
  }
  eq('Un barrido de combinaciones de dos letras no recupera a ningún alumno', recuperados.size, 0);

  suite('33. LÍMITE DE INTENTOS — no se puede dejar fuera a otra cuenta');

  // El freno agrupaba solo por IP: unos pocos fallos contra un usuario
  // cualquiera bloqueaban el login legítimo de la tesorera desde la misma IP.
  // Y detrás del proxy de Render, esa IP la comparte todo internet.
  const ipAtacante = { headers: { 'X-Forwarded-For': '203.0.113.77' }, token: null };

  for (let i = 0; i < 10; i++) {
    await POST('/auth/login', { username: 'victima-inexistente', password: `intento-${i}` }, ipAtacante);
  }
  const bloqueado = await POST('/auth/login', { username: 'victima-inexistente', password: 'otro' }, ipAtacante);
  eq('Tras muchos fallos, esa cuenta desde esa IP queda bloqueada', bloqueado.status, 429);

  const legitimo = await POST('/auth/login', { username: 'tesorera', password: 'Kinder2026!' }, ipAtacante);
  check('La tesorera SÍ puede entrar desde la misma IP pese al bloqueo del atacante',
    legitimo.status === 200, `devolvió ${legitimo.status}: el bloqueo es por IP y deja fuera a terceros`);

  const otraIp = await POST('/auth/login', { username: 'victima-inexistente', password: 'x' },
    { headers: { 'X-Forwarded-For': '198.51.100.42' }, token: null });
  check('Otra IP no arrastra el bloqueo ajeno', otraIp.status === 401, `devolvió ${otraIp.status}`);

  suite('34. FUGAS DE DATOS — ninguna respuesta lleva contraseñas');

  const buscaClave = (valor, ruta = '') => {
    if (valor === null || typeof valor !== 'object') return null;
    for (const [k, v] of Object.entries(valor)) {
      if (/password|contrase/i.test(k)) return `${ruta}.${k}`;
      const hondo = buscaClave(v, `${ruta}.${k}`);
      if (hondo) return hondo;
    }
    return null;
  };

  const vlogin = await POST('/auth/login', { username: 'apoderado', password: 'Lectura2026' }, { token: null });
  const vt = vlogin.data && vlogin.data.token;
  const LECTURAS = ['/auth/me', '/students', '/payments', '/expenses', '/petty-cash', '/discounts',
                    '/activities', '/dashboard/summary', '/reports/general', '/reports/petty-cash'];

  for (const url of LECTURAS) {
    const rr = await GET(url, { token: vt });
    const fuga = buscaClave(rr.data);
    check(`GET ${url} no expone ninguna contraseña`, fuga === null, `apareció en ${fuga}`);
  }

  const pubIds = (await GET('/public/students?q=sof', { token: null })).data.results || [];
  if (pubIds.length) {
    const est = await GET(`/public/students/${pubIds[0].id}/statement`, { token: null });
    check('El estado de cuenta público tampoco expone contraseñas', buscaClave(est.data) === null, 'hay una fuga');
  }
}

module.exports = { suiteEndurecimiento };
