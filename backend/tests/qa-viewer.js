// Matriz completa de autorización del perfil de solo lectura.
//
// Se entrega una credencial 'viewer' a terceros (apoderados), así que la
// promesa "puede mirar, no puede tocar" tiene que estar cubierta endpoint por
// endpoint y no depender de que alguien se acuerde de poner requireAdmin al
// agregar una ruta nueva.
//
// Las escrituras se prueban con cuerpo vacío a propósito: si la autorización
// fallara, la validación devolvería 400 en vez de 403 y el test lo detecta sin
// llegar a escribir nada.
const H = require('./harness');
const { GET, POST, PUT, DEL, suite, check, eq, record } = H;

const ID_INEXISTENTE = '000000000000000000000000';

// Todo endpoint que cree, modifique o elimine datos.
const ESCRITURAS = [
  ['POST',   '/students',                          {}],
  ['PUT',    `/students/${ID_INEXISTENTE}`,        {}],
  ['DELETE', `/students/${ID_INEXISTENTE}`,        null],
  ['POST',   '/payments',                          {}],
  ['PUT',    `/payments/${ID_INEXISTENTE}`,        {}],
  ['DELETE', `/payments/${ID_INEXISTENTE}`,        null],
  ['POST',   '/payments/generate-monthly',         {}],
  ['POST',   '/expenses',                          {}],
  ['PUT',    `/expenses/${ID_INEXISTENTE}`,        {}],
  ['DELETE', `/expenses/${ID_INEXISTENTE}`,        null],
  ['POST',   '/petty-cash',                        {}],
  ['PUT',    `/petty-cash/${ID_INEXISTENTE}`,      {}],
  ['DELETE', `/petty-cash/${ID_INEXISTENTE}`,      null],
  ['PUT',    '/petty-cash/initial-balance',        {}],
  ['POST',   '/discounts',                         {}],
  ['PUT',    `/discounts/${ID_INEXISTENTE}`,       {}],
  ['DELETE', `/discounts/${ID_INEXISTENTE}`,       null],
  ['POST',   '/fines',                             {}],
  ['PUT',    `/fines/${ID_INEXISTENTE}`,           {}],
  ['PUT',    `/fines/${ID_INEXISTENTE}/pay`,       {}],
  ['PUT',    `/fines/${ID_INEXISTENTE}/unpay`,     {}],
  ['DELETE', `/fines/${ID_INEXISTENTE}`,           null],
  ['POST',   '/activities',                        {}],
  ['PUT',    `/activities/${ID_INEXISTENTE}`,      {}],
  ['DELETE', `/activities/${ID_INEXISTENTE}`,      null],
  ['POST',   '/users',                             {}],
  ['PUT',    `/users/${ID_INEXISTENTE}`,           {}],
  ['DELETE', `/users/${ID_INEXISTENTE}`,           null],
  ['PUT',    `/users/${ID_INEXISTENTE}/password`,  {}],
];

// Todo lo que un viewer sí debe poder consultar.
const LECTURAS = [
  '/auth/me', '/students', '/payments', '/expenses', '/petty-cash',
  '/discounts', '/fines', '/activities', '/dashboard/summary', '/dashboard/chart/monthly',
  '/reports/general', '/reports/petty-cash', '/petty-cash/initial-balance',
];

const llamar = (metodo, url, cuerpo, opts) =>
  metodo === 'GET' ? GET(url, opts)
  : metodo === 'DELETE' ? DEL(url, opts)
  : metodo === 'POST' ? POST(url, cuerpo, opts)
  : PUT(url, cuerpo, opts);

async function suiteViewer() {
  suite('23. PERFIL DE SOLO LECTURA — la credencial de invitado');

  let r = await POST('/users', { username: 'Invitado', password: 'Completos2026', name: 'Invitado', role: 'viewer' });
  eq('Se crea la credencial de invitado con rol viewer', r.status, 201);
  eq('El rol guardado es viewer', r.data && r.data.role, 'viewer');
  const invitadoId = r.data && r.data.id;

  r = await POST('/auth/login', { username: 'Invitado', password: 'Completos2026' }, { token: null });
  eq('El invitado puede iniciar sesión', r.status, 200);
  eq('La sesión reporta rol viewer', r.data && r.data.user && r.data.user.role, 'viewer');
  check('El nombre para mostrar es "Invitado"', r.data && r.data.user && r.data.user.name === 'Invitado',
    JSON.stringify(r.data && r.data.user));
  const t = r.data && r.data.token;

  r = await POST('/auth/login', { username: 'invitado', password: 'Completos2026' }, { token: null });
  eq('El usuario no distingue mayúsculas al entrar', r.status, 200);
  r = await POST('/auth/login', { username: 'Invitado', password: 'completos2026' }, { token: null });
  eq('La contraseña SÍ distingue mayúsculas', r.status, 401);

  suite('24. PERFIL DE SOLO LECTURA — puede consultar todo el panel');

  for (const url of LECTURAS) {
    const rr = await GET(url, { token: t });
    eq(`GET ${url} responde 200`, rr.status, 200);
  }

  suite('25. PERFIL DE SOLO LECTURA — no puede modificar nada');

  for (const [metodo, url, cuerpo] of ESCRITURAS) {
    const rr = await llamar(metodo, url, cuerpo, { token: t });
    check(`${metodo} ${url} se rechaza con 403`, rr.status === 403,
      `devolvió ${rr.status}` + (rr.status === 400 ? ' — la autorización no se aplicó, solo lo frenó la validación' : ''));
  }

  suite('26. PERFIL DE SOLO LECTURA — límites de lectura y escalada');

  let rr = await GET('/users', { token: t });
  eq('No puede listar los usuarios del sistema', rr.status, 403);

  rr = await GET('/auth/me', { token: t });
  check('Su propio perfil no expone el hash de contraseña',
    !(rr.data && rr.data.user && rr.data.user.password), 'el hash viaja en la respuesta');

  // Escalada de privilegios: no debe poder ascenderse a admin por ninguna vía.
  rr = await PUT(`/users/${invitadoId}`, { role: 'admin' }, { token: t });
  eq('No puede ascenderse a sí mismo a admin', rr.status, 403);
  rr = await POST('/users', { username: 'colado', password: 'Colado2026', name: 'Colado', role: 'admin' }, { token: t });
  eq('No puede crear un usuario admin', rr.status, 403);

  const tras = await GET(`/users`);
  const yo = (tras.data || []).find(u => String(u._id) === String(invitadoId));
  eq('Tras los intentos, sigue siendo viewer', yo && yo.role, 'viewer');

  // Cambiar la contraseña PROPIA sí es legítimo para un viewer.
  rr = await PUT('/auth/change-password', { currentPassword: 'Completos2026', newPassword: 'OtraClave2026' }, { token: t });
  eq('Sí puede cambiar su propia contraseña', rr.status, 200);
  rr = await POST('/auth/login', { username: 'Invitado', password: 'OtraClave2026' }, { token: null });
  eq('La nueva contraseña funciona', rr.status, 200);
  const t2 = rr.data && rr.data.token;
  rr = await PUT('/auth/change-password', { currentPassword: 'incorrecta', newPassword: 'Intento2026' }, { token: t2 });
  eq('No puede cambiarla sin saber la actual', rr.status, 401);
  rr = await PUT('/auth/change-password', { currentPassword: 'OtraClave2026', newPassword: 'Completos2026' }, { token: t2 });
  eq('Se restaura la contraseña original', rr.status, 200);

  // Un viewer desactivado no debe poder seguir usando su token.
  await PUT(`/users/${invitadoId}`, { active: false });
  rr = await GET('/students', { token: t2 });
  check('Un invitado desactivado deja de tener acceso aunque conserve el token',
    rr.status === 401 || rr.status === 403, `devolvió ${rr.status}`);
  rr = await POST('/auth/login', { username: 'Invitado', password: 'Completos2026' }, { token: null });
  eq('Un invitado desactivado no puede volver a entrar', rr.status, 403);
  await PUT(`/users/${invitadoId}`, { active: true });

  rr = await POST('/auth/login', { username: 'Invitado', password: 'Completos2026' }, { token: null });
  eq('Al reactivarlo vuelve a entrar', rr.status, 200);

  suite('27. PERFIL DE SOLO LECTURA — ninguna consulta escribe en la base');

  // Una lectura que escribe rompe la promesa del rol y fallaría con un usuario de
  // base de datos sin permisos de escritura. Se comprueba con la configuración,
  // que era el caso real: se creaba con un upsert dentro de un GET.
  const t3 = (await POST('/auth/login', { username: 'Invitado', password: 'Completos2026' }, { token: null })).data.token;

  await H.state.db.collection('settings').deleteMany({});
  const antes = await H.state.db.collection('settings').countDocuments();
  eq('Se parte sin documento de configuración', antes, 0);

  for (const url of ['/petty-cash', '/dashboard/summary', '/reports/petty-cash', '/petty-cash/initial-balance']) {
    const rl = await GET(url, { token: t3 });
    eq(`GET ${url} sigue respondiendo 200 sin configuración guardada`, rl.status, 200);
  }

  const despues = await H.state.db.collection('settings').countDocuments();
  check('Las consultas de un invitado NO crean el documento de configuración', despues === 0,
    `se crearon ${despues} documentos: un GET está escribiendo en la base`);

  const saldo = (await GET('/petty-cash', { token: t3 })).data;
  eq('Sin configuración guardada, el saldo inicial se asume $0', saldo.initialBalance, 0);
  eq('Y el saldo disponible se sigue calculando bien', saldo.currentBalance, saldo.totalIncome - saldo.totalExpense);

  // Solo un administrador crea la configuración, y solo al guardarla.
  await PUT('/petty-cash/initial-balance', { amount: 4000 });
  eq('Al guardarla, el administrador sí crea el documento', await H.state.db.collection('settings').countDocuments(), 1);
  eq('El saldo inicial guardado se refleja', (await GET('/petty-cash')).data.initialBalance, 4000);
  await PUT('/petty-cash/initial-balance', { amount: 0 });

  suite('28. ENDURECIMIENTO — privilegio mínimo y firma de sesión');

  // Si alguna vía futura crea un usuario sin indicar rol, debe quedar en el nivel
  // más bajo. El valor por defecto era 'admin'.
  const UserModel = require('../src/models/User');
  const sinRol = new UserModel({ username: 'sin-rol', password: 'x', name: 'Sin Rol' });
  eq('Un usuario creado sin rol queda como viewer, no como admin', sinRol.role, 'viewer');

  const jwt = require('jsonwebtoken');
  const idFalso = '000000000000000000000000';

  // Token sin firma: la cabecera del token la controla quien la envía, así que
  // la verificación tiene que exigir el algoritmo esperado.
  const sinFirma = jwt.sign({ id: idFalso }, '', { algorithm: 'none' });
  let rr2 = await GET('/students', { token: sinFirma });
  eq('Un token con algoritmo "none" se rechaza', rr2.status, 401);

  // Token bien formado pero firmado con otro secreto.
  const otroSecreto = jwt.sign({ id: idFalso }, 'secreto-del-atacante', { algorithm: 'HS256', expiresIn: '1h' });
  rr2 = await GET('/students', { token: otroSecreto });
  eq('Un token firmado con otro secreto se rechaza', rr2.status, 401);

  // Token válido en firma pero apuntando a un usuario inexistente.
  const usuarioFantasma = jwt.sign({ id: idFalso }, 'qa-secret-solo-para-pruebas', { algorithm: 'HS256', expiresIn: '1h' });
  rr2 = await GET('/students', { token: usuarioFantasma });
  eq('Un token de un usuario inexistente se rechaza', rr2.status, 401);

  // El reporte mensual no debe arrastrar campos de contacto del alumno.
  const mensual = await GET('/reports/month/2026-03');
  const conAlumno = (mensual.data.payments || []).filter(p => p.student);
  check('El reporte mensual solo expone el nombre del alumno, ningún dato de contacto',
    conAlumno.every(p => Object.keys(p.student).every(k => ['_id', 'name'].includes(k))),
    JSON.stringify(conAlumno[0] && conAlumno[0].student));

  // Se elimina para no dejar residuo en la auditoría.
  await DEL(`/users/${invitadoId}`);
  record(true, 'Credencial de prueba eliminada al terminar', '');
}

module.exports = { suiteViewer, ESCRITURAS, LECTURAS };
