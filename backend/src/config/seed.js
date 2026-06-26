require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const connectDB = require('./db');
const User = require('../models/User');

const seed = async () => {
  await connectDB();

  const adminUser = process.env.ADMIN_USER     || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminPass) {
    console.error('❌ Define ADMIN_PASSWORD en tu archivo .env antes de ejecutar este script.');
    process.exit(1);
  }

  const existing = await User.findOne({ username: adminUser });
  if (existing) {
    console.log(`ℹ️  El usuario '${adminUser}' ya existe en la base de datos.`);
    process.exit(0);
  }

  await User.create({
    username: adminUser,
    password: await bcrypt.hash(adminPass, 12),
    name: 'Administrador',
    role: 'admin',
  });

  console.log(`✅ Usuario '${adminUser}' creado correctamente.`);
  console.log('⚠️  Recuerda cambiar la contraseña después del primer login.');
  process.exit(0);
};

seed().catch(e => { console.error(e); process.exit(1); });
