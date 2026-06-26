require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

const authRoutes       = require('./src/routes/auth');
const studentRoutes    = require('./src/routes/students');
const paymentRoutes    = require('./src/routes/payments');
const expenseRoutes    = require('./src/routes/expenses');
const activityRoutes   = require('./src/routes/activities');
const pettyCashRoutes  = require('./src/routes/pettyCash');
const dashboardRoutes  = require('./src/routes/dashboard');
const reportRoutes     = require('./src/routes/reports');
const discountRoutes   = require('./src/routes/discounts');

connectDB();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'KINDERFOUNDS' }));

app.use('/api/auth',       authRoutes);
app.use('/api/students',   studentRoutes);
app.use('/api/payments',   paymentRoutes);
app.use('/api/expenses',   expenseRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/discounts',  discountRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
