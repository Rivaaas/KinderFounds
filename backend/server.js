require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');
const sanitize = require('./src/middleware/sanitize');

const authRoutes       = require('./src/routes/auth');
const studentRoutes    = require('./src/routes/students');
const paymentRoutes    = require('./src/routes/payments');
const expenseRoutes    = require('./src/routes/expenses');
const activityRoutes   = require('./src/routes/activities');
const pettyCashRoutes  = require('./src/routes/pettyCash');
const dashboardRoutes  = require('./src/routes/dashboard');
const reportRoutes     = require('./src/routes/reports');
const discountRoutes   = require('./src/routes/discounts');
const userRoutes       = require('./src/routes/users');
const publicRoutes     = require('./src/routes/public');

// Sin secreto no se pueden firmar ni verificar sesiones. Antes el proceso
// arrancaba igual y fallaba recién en el primer login, con un error confuso.
if (!process.env.JWT_SECRET) {
  console.error('❌ Falta JWT_SECRET. Define la variable de entorno antes de arrancar el servidor.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('⚠️  JWT_SECRET es corto: usa al menos 32 caracteres aleatorios.');
}

connectDB();

const app = express();

// Detrás del proxy de Render, req.ip es la dirección del proxy y no la del
// visitante: todos los usuarios comparten un mismo contador y basta con unos
// pocos intentos fallidos de cualquiera para bloquear el login de todos.
// Se indica el número de saltos, nunca `true`: con `true` el cliente puede
// falsificar X-Forwarded-For y saltarse el límite por completo.
app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY_HOPS, 10) || 1);

// El navegador compara el origen carácter por carácter: sin esquema o con barra
// final, la cabecera no coincide y bloquea la respuesta aunque el servidor
// responda 200. Se normaliza aquí para que un dedazo en la variable de entorno
// no vuelva a costar una sesión de diagnóstico.
const normalizarOrigen = (valor) => {
  if (!valor) return null;
  const limpio = valor.trim().replace(/\/+$/, '');
  return /^https?:\/\//.test(limpio) ? limpio : `https://${limpio}`;
};

const origenPermitido = normalizarOrigen(process.env.FRONTEND_URL);
if (!origenPermitido && process.env.NODE_ENV === 'production') {
  console.error('❌ Falta FRONTEND_URL. En producción no se arranca con CORS abierto a cualquier origen.');
  process.exit(1);
}
if (!origenPermitido) {
  console.warn('⚠️  FRONTEND_URL no está definida: solo se aceptarán peticiones desde localhost.');
} else if (origenPermitido !== process.env.FRONTEND_URL) {
  console.warn(`⚠️  FRONTEND_URL normalizada a "${origenPermitido}" (revisa la variable de entorno).`);
}

// Sin FRONTEND_URL se cae a localhost, no a '*': degradar a origen abierto es
// una decisión demasiado grande para tomarla por omisión.
app.use(cors({
  origin: origenPermitido || [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  credentials: true,
}));
// Límite explícito: sin él, un cuerpo enorme consume memoria del proceso.
app.use(express.json({ limit: '200kb' }));
app.use(sanitize);

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'KINDERFOUNDS' }));

// Consulta pública de estado de cuenta: sin autenticación, a propósito.
app.use('/api/public',     publicRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/students',   studentRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/expenses',   expenseRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/discounts',  discountRoutes);
app.use('/api/users',      userRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
