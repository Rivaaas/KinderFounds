// Pruebas del detector de peticiones lentas (aviso de servidor despertando).
// Ejecuta: npm run test:ux
import {
  SLOW_THRESHOLD_MS, trackRequest, releaseRequest, onSlowRequestChange, isWaking,
  attachSlowRequestTracking, _reset,
} from '../src/services/slowRequest.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const resultados = [];

const check = (nombre, ok, detalle = '') => {
  resultados.push({ nombre, ok });
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${nombre}${ok || !detalle ? '' : `\n        ${detalle}`}`);
};

// Margen sobre el umbral para no depender de la precisión de los temporizadores.
const MARGEN = 900;

const pruebas = {
  async 'Una petición rápida nunca muestra el aviso'() {
    let veces = 0;
    const off = onSlowRequestChange((e) => { if (e.waking) veces++; });
    const id = trackRequest();
    await espera(300);
    releaseRequest(id);
    await espera(SLOW_THRESHOLD_MS + MARGEN);
    off();
    check('Una petición rápida nunca muestra el aviso', veces === 0 && !isWaking(),
      `el aviso apareció ${veces} veces`);
  },

  async 'Una petición lenta muestra el aviso al cruzar el umbral'() {
    const id = trackRequest();
    await espera(SLOW_THRESHOLD_MS - 1500);
    const antes = isWaking();
    await espera(1500 + MARGEN);
    const despues = isWaking();
    releaseRequest(id);
    check('No se avisa antes del umbral', antes === false, 'se avisó demasiado pronto');
    check('Se avisa al superar el umbral', despues === true, 'no se avisó nunca');
  },

  async 'El aviso desaparece solo al llegar la respuesta'() {
    const id = trackRequest();
    await espera(SLOW_THRESHOLD_MS + MARGEN);
    const durante = isWaking();
    releaseRequest(id);
    await espera(100);
    check('El aviso se oculta al responder la petición', durante === true && isWaking() === false,
      `durante: ${durante}, después: ${isWaking()}`);
  },

  async 'Una petición rápida en paralelo no oculta el aviso'() {
    const lenta = trackRequest();
    await espera(SLOW_THRESHOLD_MS + MARGEN);
    const rapida = trackRequest();
    await espera(150);
    releaseRequest(rapida);
    await espera(150);
    const sigue = isWaking();
    releaseRequest(lenta);
    await espera(100);
    check('Una petición rápida en paralelo no oculta el aviso prematuramente',
      sigue === true && isWaking() === false, `seguía avisando: ${sigue}`);
  },

  async 'Al terminar la lenta, una reciente en curso no mantiene el aviso'() {
    const lenta = trackRequest();
    await espera(SLOW_THRESHOLD_MS + MARGEN);
    const reciente = trackRequest();
    await espera(150);
    releaseRequest(lenta);
    await espera(150);
    const tras = isWaking();
    releaseRequest(reciente);
    check('Al terminar la lenta, una petición reciente no mantiene el aviso', tras === false,
      'el aviso quedó pegado con una petición que recién empezaba');
  },

  async 'Una petición fallida también libera el aviso'() {
    const id = trackRequest();
    await espera(SLOW_THRESHOLD_MS + MARGEN);
    const durante = isWaking();
    releaseRequest(id); // el interceptor de error llama igual a releaseRequest
    await espera(100);
    check('Una petición fallida también oculta el aviso', durante === true && isWaking() === false,
      'el aviso quedó visible tras un error');
  },

  async 'Sin peticiones no quedan temporizadores vivos'() {
    // Se compara contra la referencia previa: medir el total de temporizadores del
    // proceso incluiría los de la propia prueba y daría un resultado engañoso.
    const activos = () => process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    const referencia = activos();

    const id = trackRequest();
    const conPeticion = activos();
    releaseRequest(id);
    const tras = activos();

    check('Mientras hay una petición en curso, el detector mantiene su temporizador',
      conPeticion > referencia, `referencia ${referencia}, con petición ${conPeticion}`);
    check('Al liberarla no queda ningún temporizador del detector',
      tras === referencia, `referencia ${referencia}, tras liberar ${tras}`);
  },

  async 'El aviso informa desde cuándo se espera'() {
    let visto = null;
    const off = onSlowRequestChange((e) => { if (e.waking) visto = e; });
    const inicio = Date.now();
    const id = trackRequest();
    await espera(SLOW_THRESHOLD_MS + MARGEN);
    releaseRequest(id);
    off();
    const desfase = visto ? Math.abs(visto.since - inicio) : Infinity;
    check('El aviso informa el instante en que empezó la espera', desfase < 500,
      `desfase de ${desfase} ms`);
  },
};

// Prueba de integración real: axios contra un servidor que tarda a propósito,
// igual que Render al despertar. Verifica el interceptor tal como lo usa la app.
const pruebaIntegracion = async () => {
  const http = await import('node:http');
  const axios = (await import('axios')).default;

  const servidor = http.createServer((req, res) => {
    // /lento simula el arranque en frío; /rapido, una petición normal.
    const demora = req.url.startsWith('/lento') ? SLOW_THRESHOLD_MS + 1200 : 50;
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    }, demora);
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const cliente = attachSlowRequestTracking(axios.create({ baseURL: base }));
  const estados = [];
  const off = onSlowRequestChange((e) => estados.push(e.waking));

  await cliente.get('/rapido');
  const trasRapida = estados.filter(Boolean).length;
  check('Integración: una petición rápida real no dispara el aviso', trasRapida === 0,
    `el aviso apareció ${trasRapida} veces`);

  const promesa = cliente.get('/lento');
  await espera(SLOW_THRESHOLD_MS + 600);
  const durante = isWaking();
  const respuesta = await promesa;          // la petición nunca se cancela
  await espera(100);

  check('Integración: una petición lenta real dispara el aviso', durante === true,
    'el aviso no apareció durante la espera');
  check('Integración: la petición original no se cancela y devuelve su respuesta',
    respuesta.status === 200 && respuesta.data.ok === true, JSON.stringify(respuesta.data));
  check('Integración: el aviso se oculta solo al llegar la respuesta', isWaking() === false,
    'el aviso quedó visible tras responder');

  // Un error también debe liberar el aviso.
  servidor.close();
  await espera(50);
  let fallo = false;
  try { await cliente.get('/lento'); } catch { fallo = true; }
  await espera(100);
  check('Integración: si la petición falla, el aviso no queda pegado',
    fallo === true && isWaking() === false, `falló: ${fallo}, avisando: ${isWaking()}`);

  off();
};

(async () => {
  console.log(`\nDetector de peticiones lentas (umbral ${SLOW_THRESHOLD_MS} ms)\n`);
  for (const [nombre, fn] of Object.entries(pruebas)) {
    _reset();
    try { await fn(); }
    catch (e) { check(nombre, false, e.stack); }
  }
  _reset();
  console.log('');
  try { await pruebaIntegracion(); }
  catch (e) { check('Prueba de integración con axios', false, e.stack); }
  _reset();

  const fallas = resultados.filter((r) => !r.ok).length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`TOTAL: ${resultados.length} verificaciones | ${resultados.length - fallas} OK | ${fallas} FALLAS`);
  process.exit(fallas ? 1 : 0);
})();
