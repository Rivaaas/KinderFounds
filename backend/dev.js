// Servidor de desarrollo local: usa MongoDB en memoria si no hay MONGODB_URI
require('dotenv').config();

const startServer = async () => {
  if (!process.env.MONGODB_URI) {
    console.log('⚙️  Sin MONGODB_URI — iniciando MongoDB en memoria...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    const uri = process.env.MONGODB_URI = mongod.getUri() + 'kinderfounds';
    console.log('✅ MongoDB en memoria lista');

    const mongoose = require('mongoose');
    const bcrypt   = require('bcryptjs');
    await mongoose.connect(uri);
    const User = require('./src/models/User');

    const adminUser = process.env.ADMIN_USER     || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin';

    const exists = await User.findOne({ username: adminUser });
    if (!exists) {
      await User.create({
        username: adminUser,
        password: await bcrypt.hash(adminPass, 10),
        name: 'Administrador',
        role: 'admin',
      });
      console.log(`✅ Usuario creado desde variables de entorno.`);
    }

    await mongoose.disconnect();
  }

  require('./server.js');
};

startServer().catch(console.error);
