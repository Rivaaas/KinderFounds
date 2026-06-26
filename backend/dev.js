// Servidor de desarrollo: usa MongoDB en memoria si no hay MONGODB_URI en .env
require('dotenv').config();

const startServer = async () => {
  if (!process.env.MONGODB_URI) {
    console.log('⚙️  Sin MONGODB_URI — iniciando MongoDB en memoria...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri() + 'kindercash';
    process.env.MONGODB_URI = uri;
    console.log('✅ MongoDB en memoria lista');

    // Sembrar usuarios automáticamente
    const mongoose = require('mongoose');
    const bcrypt   = require('bcryptjs');
    await mongoose.connect(uri);
    const User = require('./src/models/User');

    const users = [
      { username: 'admin', password: 'admin123', name: 'Administrador', role: 'admin' },
      { username: 'user',  password: 'admin',    name: 'Tesorero',       role: 'admin' },
    ];

    for (const u of users) {
      const exists = await User.findOne({ username: u.username });
      if (!exists) {
        await User.create({ ...u, password: await bcrypt.hash(u.password, 10) });
        console.log(`✅ Usuario creado: ${u.username} / ${u.password}`);
      }
    }

    await mongoose.disconnect();
  }

  // Importar servidor principal (reconecta a MONGODB_URI)
  require('./server.js');
};

startServer().catch(console.error);
