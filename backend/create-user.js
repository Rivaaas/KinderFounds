// Script para crear usuario: node create-user.js <username> <password> [name]
// Requiere MONGODB_URI en .env o argumento --uri=...
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('./src/models/User');

const [,, username, password, name = 'Usuario'] = process.argv;

if (!username || !password) {
  console.error('Uso: node create-user.js <username> <password> [nombre]');
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Conectado a MongoDB');

  const existing = await User.findOne({ username });
  if (existing) {
    existing.password = await bcrypt.hash(password, 12);
    existing.name = name;
    await existing.save();
    console.log(`✅ Usuario '${username}' actualizado.`);
  } else {
    await User.create({ username, password: await bcrypt.hash(password, 12), name, role: 'admin' });
    console.log(`✅ Usuario '${username}' creado.`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(e => { console.error(e); process.exit(1); });
