// Seguimiento de peticiones lentas.
//
// El backend vive en una instancia gratuita de Render, que se apaga tras un rato
// sin tráfico. La primera petición después de eso tarda entre 30 y 60 segundos en
// responder mientras el contenedor arranca: sin aviso, la pantalla parece
// congelada y el usuario cierra la página creyendo que la app está rota.
//
// Este módulo no cancela ni reintenta nada: solo avisa que hay una petición
// tardando más de lo normal, para que la interfaz pueda explicarlo. Vive aparte
// de axios para poder probarlo sin levantar el navegador.

// Umbral a partir del cual una espera deja de ser normal. Por debajo de esto no
// se avisa nada: la inmensa mayoría de las peticiones responden en milisegundos.
export const SLOW_THRESHOLD_MS = 6000;

// Cada cuánto se revisa si alguna petición en curso ya cruzó el umbral.
const CHECK_INTERVAL_MS = 500;

const enCurso = new Map(); // id -> instante de inicio
const oyentes = new Set();

let secuencia = 0;
let temporizador = null;
let avisando = false;
let inicioAviso = 0;

const ahora = () => Date.now();

const notificar = () => {
  const estado = { waking: avisando, since: inicioAviso };
  for (const fn of oyentes) fn(estado);
};

const evaluar = () => {
  temporizador = null;

  const t = ahora();
  const masAntigua = Math.min(...[...enCurso.values()], Infinity);
  const lenta = enCurso.size > 0 && t - masAntigua >= SLOW_THRESHOLD_MS;

  if (lenta !== avisando) {
    avisando = lenta;
    // El instante de inicio se fija en la petición que gatilló el aviso, para
    // poder mostrar cuánto lleva esperando el usuario.
    inicioAviso = lenta ? masAntigua : 0;
    notificar();
  }

  // El reloj solo corre mientras haya algo pendiente: sin peticiones no hay
  // temporizadores vivos.
  if (enCurso.size > 0) programar();
};

const programar = () => {
  if (temporizador === null) temporizador = setTimeout(evaluar, CHECK_INTERVAL_MS);
};

// Registra el inicio de una petición. Devuelve el identificador con el que se
// libera después.
export const trackRequest = () => {
  const id = ++secuencia;
  enCurso.set(id, ahora());
  programar();
  return id;
};

// Libera una petición, haya terminado bien o mal.
export const releaseRequest = (id) => {
  if (id === undefined || id === null) return;
  enCurso.delete(id);

  if (enCurso.size === 0) {
    if (temporizador !== null) { clearTimeout(temporizador); temporizador = null; }
    if (avisando) { avisando = false; inicioAviso = 0; notificar(); }
    return;
  }
  // Quedan peticiones: puede que la que gatilló el aviso ya haya terminado.
  evaluar();
};

// Suscribe un oyente al estado del aviso. Devuelve la función para desuscribirse.
export const onSlowRequestChange = (fn) => {
  oyentes.add(fn);
  fn({ waking: avisando, since: inicioAviso });
  return () => oyentes.delete(fn);
};

// Estado actual, para quien lo necesite fuera de una suscripción.
export const isWaking = () => avisando;

// Conecta una instancia de axios al detector.
//
// Marca cada petición al salir y la libera al volver, responda bien o mal. No
// fija timeout: la petición original se deja correr hasta que el servidor
// despierte, que es justamente lo que se quiere durante el arranque en frío.
export const attachSlowRequestTracking = (instancia) => {
  instancia.interceptors.request.use(
    (config) => { config.__slowId = trackRequest(); return config; },
    (error) => { releaseRequest(error?.config?.__slowId); return Promise.reject(error); }
  );

  instancia.interceptors.response.use(
    (res) => { releaseRequest(res.config?.__slowId); return res; },
    (error) => { releaseRequest(error?.config?.__slowId); return Promise.reject(error); }
  );

  return instancia;
};

// Reinicia el módulo. Existe para las pruebas; la aplicación no lo usa.
export const _reset = () => {
  enCurso.clear();
  oyentes.clear();
  if (temporizador !== null) { clearTimeout(temporizador); temporizador = null; }
  secuencia = 0;
  avisando = false;
  inicioAviso = 0;
};
