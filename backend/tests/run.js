// Corre la auditoría completa contra un servidor real y una base limpia.
const H = require('./harness');
const A = require('./qa-e2e');
const B = require('./qa-e2e-b');
const C = require('./qa-e2e-c');
const P = require('./qa-public');
const CC = require('./qa-caja-chica');
const V = require('./qa-viewer');

const SUITES = [
  A.suiteAuth, A.suiteAlumnos, A.suiteCuotas, A.suiteRegenerar,
  B.suiteCajaChica, B.suiteGastos, B.suiteActividades, B.suiteDescuentos,
  B.suiteConsistencia, B.suiteDuplicacion, C.suiteContrato, C.suiteFechas, P.suitePublica, CC.suiteCajaChicaSeccion, V.suiteViewer, B.suiteHostil, B.suiteIntegridad,
];

(async () => {
  console.log('Levantando servidor real + MongoDB limpia...');
  await H.boot();
  console.log('Listo. Iniciando auditoría.\n');

  for (const s of SUITES) {
    if (H.state.crashed) {
      H.suite('ABORTADO');
      H.record(false, 'El servidor cayó antes de ' + s.name,
        'Últimas líneas del proceso:\n' + (H.state.crashLog || '(sin salida)'));
      break;
    }
    try {
      await s();
    } catch (err) {
      H.record(false, 'La suite ' + s.name + ' lanzó una excepción', err.stack);
      if (H.state.crashed) {
        H.record(false, 'El servidor se cayó durante ' + s.name,
          'Últimas líneas:\n' + (H.state.crashLog || '(sin salida)'));
        break;
      }
    }
  }

  const fallas = H.report();
  await H.shutdown();
  process.exit(fallas > 0 ? 1 : 0);
})().catch(async (err) => {
  console.error('Error fatal en la auditoría:', err);
  await H.shutdown();
  process.exit(2);
});
