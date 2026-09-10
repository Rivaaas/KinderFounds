// Script para crear usuario: node create-user.js <username> <password> [name] [role]
// role: 'admin' (por defecto) o 'viewer' (solo lectura).
// Requiere MONGODB_URI en .env o argumento --uri=...
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./src/models/User');

const [,, rawUsername, password, name = 'Usuario', rawRole = 'admin'] = process.argv;

if (!rawUsername || !password) {
  console.error('Uso: node create-user.js <username> <password> [nombre] [admin|viewer]');
  process.exit(1);
}

const username = rawUsername.trim().toLowerCase();
const role     = rawRole === 'viewer' ? 'viewer' : 'admin';

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  const existing = await User.findOne({ username });
  if (existing) {
    existing.password = await bcrypt.hash(password, 12);
    existing.name = name;
    existing.role = role;
    existing.active = true;
    await existing.save();
    console.log(`✅ Usuario '${username}' actualizado (rol: ${role}).`);
  } else {
    await User.create({ username, password: await bcrypt.hash(password, 12), name, role });
    console.log(`✅ Usuario '${username}' creado (rol: ${role}).`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
