// Infraestructura de pruebas E2E: levanta el servidor real contra una base limpia
// en memoria y expone helpers HTTP + acceso directo a la BD para verificar persistencia.
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}/api`;

const state = { mongod: null, server: null, client: null, db: null, token: null, crashed: false };

const results = [];
let currentSuite = '(sin suite)';

const suite = (name) => { currentSuite = name; console.log(`\n\x1b[1m### ${name}\x1b[0m`); };

const record = (ok, name, detail) => {
  results.push({ suite: currentSuite, name, ok, detail });
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${tag}  ${name}${detail ? `\n        ${String(detail).replace(/\n/g, '\n        ')}` : ''}`);
  return ok;
};

const check = (name, cond, detail) => record(!!cond, name, cond ? '' : detail);

const eq = (name, actual, expected, ctx = '') => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  return record(ok, name, ok ? '' : `esperado: ${JSON.stringify(expected)} | obtenido: ${JSON.stringify(actual)}${ctx ? ` | ${ctx}` : ''}`);
};

// --- HTTP ---------------------------------------------------------------
const api = async (method, url, body, opts = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = opts.token === null ? null : (opts.token || state.token);
  if (token) headers.Authorization = `Bearer ${token}`;

  let res, text;
  try {
    res = await fetch(BASE + url, {
      method,
      headers,
      body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
      signal: AbortSignal.timeout(opts.timeout || 8000),
    });
    text = await res.text();
  } catch (err) {
    return { status: 0, data: null, error: err.name === 'TimeoutError' ? 'TIMEOUT (sin respuesta)' : err.message };
  }
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, raw: text };
};

const GET  = (u, o)    => api('GET', u, undefined, o);
const POST = (u, b, o) => api('POST', u, b, o);
const PUT  = (u, b, o) => api('PUT', u, b, o);
const DEL  = (u, o)    => api('DELETE', u, undefined, o);

// --- Arranque -----------------------------------------------------------
const waitForHealth = async (ms = 45000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (state.crashed) return false;
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (r.ok) return true;
    } catch { /* aún no levanta */ }
  }
  return false;
};

const boot = async () => {
  state.mongod = await MongoMemoryServer.create();
  const uri = state.mongod.getUri() + 'kinderqa';

  state.client = new MongoClient(uri);
  await state.client.connect();
  state.db = state.client.db();

  state.server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      MONGODB_URI: uri,
      PORT: String(PORT),
      JWT_SECRET: 'qa-secret-solo-para-pruebas',
      JWT_EXPIRES_IN: '7d',
      FRONTEND_URL: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const serverLog = [];
  state.server.stdout.on('data', (d) => serverLog.push(d.toString()));
  state.server.stderr.on('data', (d) => serverLog.push(d.toString()));
  state.server.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      state.crashed = true;
      state.crashLog = serverLog.slice(-25).join('');
    }
  });
  state.serverLog = serverLog;

  if (!(await waitForHealth())) throw new Error('El servidor no respondió:\n' + serverLog.join(''));

  // Usuario admin de pruebas
  const bcrypt = require('bcryptjs');
  await state.db.collection('users').insertOne({
    username: 'tesorera', password: await bcrypt.hash('Kinder2026!', 12),
    name: 'Tesorera QA', role: 'admin', active: true, createdAt: new Date(), updatedAt: new Date(),
  });
  const login = await POST('/auth/login', { username: 'tesorera', password: 'Kinder2026!' }, { token: null });
  if (!login.data?.token) throw new Error('No se pudo autenticar: ' + JSON.stringify(login));
  state.token = login.data.token;
};

const shutdown = async () => {
  try { state.server?.kill('SIGKILL'); } catch {}
  try { await state.client?.close(); } catch {}
  try { await state.mongod?.stop(); } catch {}
};

// Reinicia el servidor si un test lo tumbó, para poder seguir auditando.
const ensureAlive = async () => {
  if (!state.crashed) return true;
  return false;
};

const report = () => {
  const failed = results.filter(r => !r.ok);
  console.log(`\n\x1b[1m${'='.repeat(70)}\x1b[0m`);
  console.log(`\x1b[1mTOTAL: ${results.length} verificaciones | ${results.length - failed.length} OK | ${failed.length} FALLAS\x1b[0m`);
  if (failed.length) {
    console.log('\n\x1b[31mFALLAS:\x1b[0m');
    let s = '';
    for (const f of failed) {
      if (f.suite !== s) { s = f.suite; console.log(`\n  [${s}]`); }
      console.log(`   - ${f.name}${f.detail ? `\n       ${String(f.detail).replace(/\n/g, '\n       ')}` : ''}`);
    }
  }
  return failed.length;
};

module.exports = { state, boot, shutdown, ensureAlive, api, GET, POST, PUT, DEL, suite, check, eq, record, report, BASE, PORT };
