require('dotenv').config({ path: '../../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const User = require('../models/User');

const seed = async () => {
  await connectDB();

  const existing = await User.findOne({ username: 'admin' });
  if (existing) {
    console.log('ℹ️  Usuario admin ya existe.');
    process.exit(0);
  }

  const hashed = await bcrypt.hash('admin123', 12);
  await User.create({
    username: 'admin',
    password: hashed,
    name: 'Tesorero Principal',
    role: 'admin',
  });

  console.log('✅ Usuario admin creado: admin / admin123');
  console.log('⚠️  Cambia la contraseña después del primer login.');
  process.exit(0);
};

seed().catch((e) => { console.error(e); process.exit(1); });
