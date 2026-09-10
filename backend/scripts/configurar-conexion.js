// Configura MONGODB_URI en backend/.env de forma segura e inspecciona el cluster.
//
// Pide la contraseña por consola con la entrada oculta: nunca pasa por argumentos
// (que quedan en el historial del shell) ni por el código.
//
// Uso: npm run conectar
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { MongoClient } = require('mongodb');

const ENV_PATH = path.join(__dirname, '../.env');
const HOST_POR_DEFECTO = 'cluster0.a3ywqoc.mongodb.net';

const rl = () => readline.createInterface({ input: process.stdin, output: process.stdout });

const preguntar = (texto, porDefecto) => new Promise((resolve) => {
  const i = rl();
  i.question(porDefecto ? `${texto} [${porDefecto}]: ` : `${texto}: `, (r) => {
    i.close();
    resolve(r.trim() || porDefecto || '');
  });
});

// Entrada oculta: se intercepta la escritura de la consola para no mostrar la clave.
const preguntarOculto = (texto) => new Promise((resolve) => {
  const i = rl();
  let visible = true;
  i._writeToOutput = function (s) {
    if (visible) { i.output.write(s); return; }
    // Deja pasar solo los saltos de línea para que el cursor avance.
    if (s.includes('\n')) i.output.write('\n');
  };
  i.question(`${texto}: `, (r) => { i.close(); process.stdout.write('\n'); resolve(r); });
  visible = false;
});

const safeUri = (u) => u.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]*@/, '$1****@');

const escribirEnv = (uri) => {
  let contenido = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const linea = `MONGODB_URI=${uri}`;

  if (/^MONGODB_URI=.*$/m.test(contenido)) {
    // Se guarda una copia antes de sobrescribir: el .env tiene el resto de secretos.
    fs.copyFileSync(ENV_PATH, ENV_PATH + '.bak');
    contenido = contenido.replace(/^MONGODB_URI=.*$/m, linea);
    console.log(`   (se guardó copia del .env anterior en .env.bak)`);
  } else {
    contenido = contenido.replace(/\n*$/, '\n') + linea + '\n';
  }
  fs.writeFileSync(ENV_PATH, contenido);
};

const run = async () => {
  console.log('\n=== Configuración de conexión a MongoDB Atlas ===\n');
  console.log('La contraseña no se muestra al escribirla, no se guarda en el historial');
  console.log('del shell y solo se escribe en backend/.env.\n');

  const host    = await preguntar('Host del cluster', HOST_POR_DEFECTO);
  const usuario = await preguntar('Usuario de base de datos', 'rivaaasv_db_user');
  const clave   = await preguntarOculto('Contraseña');

  if (!clave) { console.error('❌ No se ingresó contraseña.'); process.exit(1); }

  // Los caracteres especiales de la contraseña rompen la URI si no se codifican.
  const claveCodificada = encodeURIComponent(clave);
  if (claveCodificada !== clave) console.log('   (la contraseña tiene caracteres especiales: se codificaron para la URI)');

  const base = `mongodb+srv://${usuario}:${claveCodificada}@${host}`;

  console.log('\n📡 Probando conexión...');
  const client = new MongoClient(`${base}/?retryWrites=true&w=majority&appName=Cluster0`, { serverSelectionTimeoutMS: 20000 });

  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    console.log('✅ Conexión correcta.\n');
  } catch (err) {
    console.error(`❌ No se pudo conectar: ${err.message}\n`);
    if (/authentication failed/i.test(err.message))
      console.error('   La contraseña o el usuario no coinciden. Revísalos en Atlas → Database Access.');
    else if (/ENOTFOUND|querySrv/i.test(err.message))
      console.error('   El host no resuelve. Verifica el nombre del cluster.');
    else
      console.error('   Si dice timeout, agrega tu IP en Atlas → Network Access → Add Current IP Address.');
    await client.close().catch(() => {});
    process.exit(1);
  }

  // Inventario del cluster: esto responde en qué base vive realmente la información.
  console.log('=== CONTENIDO DEL CLUSTER ===');
  let candidata = null;
  try {
    const { databases } = await client.db().admin().listDatabases();
    const propias = databases.filter((d) => !['admin', 'local', 'config'].includes(d.name));

    if (propias.length === 0) console.log('  (el cluster no tiene bases de datos con contenido)');

    for (const d of propias) {
      const db = client.db(d.name);
      const cols = (await db.listCollections().toArray()).filter((c) => c.type === 'collection');
      console.log(`\n  📁 ${d.name}`);
      if (cols.length === 0) { console.log('       (sin colecciones)'); continue; }

      let totalDocs = 0;
      for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
        const n = await db.collection(c.name).countDocuments();
        totalDocs += n;
        console.log(`       ${c.name.padEnd(18)} ${String(n).padStart(6)} documentos`);
      }
      // La base con datos de la app es la que la aplicación está usando de verdad.
      if (cols.some((c) => c.name === 'users') && (!candidata || totalDocs > candidata.docs))
        candidata = { name: d.name, docs: totalDocs };
    }
  } catch (err) {
    console.log(`  No se pudo listar las bases (${err.message}).`);
    console.log('  El usuario puede no tener permiso de listado; no impide usar la app.');
  }

  console.log('\n=== BASE DE DATOS A USAR ===');
  if (candidata) {
    console.log(`  Detectada con datos de la aplicación: "${candidata.name}" (${candidata.docs} documentos)`);
    console.log('  Debe coincidir EXACTAMENTE con la que usa MONGODB_URI en Render,');
    console.log('  o la app no verá lo que importemos.');
  } else {
    console.log('  No se detectó ninguna base con colección "users".');
    console.log('  Si la app nunca escribió aquí, la base se creará al importar.');
  }

  const nombreBase = await preguntar('\nNombre de la base a usar', candidata ? candidata.name : 'kinderfounds');
  if (!nombreBase) { console.error('❌ Se requiere un nombre de base.'); process.exit(1); }

  const uriFinal = `${base}/${nombreBase}?retryWrites=true&w=majority&appName=Cluster0`;
  await client.close();

  escribirEnv(uriFinal);
  console.log(`\n✅ MONGODB_URI escrita en backend/.env`);
  console.log(`   ${safeUri(uriFinal)}`);
  console.log('\nSiguiente paso: npm run backup');
};

run().catch((e) => { console.error('❌ Error:', e.message); process.exit(1); });
