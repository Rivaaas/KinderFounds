// Respalda todas las colecciones a archivos JSON (Extended JSON v2, preserva ObjectId y Date).
// Uso: node scripts/backup.js [--out <dir>] [--keep <n>]
// La cadena de conexión se lee de MONGODB_URI (.env o variable de entorno). Nunca se escribe en disco.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const OUT_ROOT = path.resolve(arg('out', path.join(__dirname, '../../backups')));
const KEEP     = Math.max(1, parseInt(arg('keep', '14'), 10) || 14);
const URI      = process.env.MONGODB_URI;

// Oculta la contraseña al imprimir la URI en logs.
const safeUri = (uri) => uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]*@/, '$1****@');

const prune = (root, keep) => {
  const dirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(d.name))
    .map((d) => d.name)
    .sort()
    .reverse();

  for (const old of dirs.slice(keep)) {
    fs.rmSync(path.join(root, old), { recursive: true, force: true });
    console.log(`   eliminado respaldo antiguo: ${old}`);
  }
};

const run = async () => {
  if (!URI) {
    console.error('❌ Falta MONGODB_URI. Define la variable en backend/.env o en el entorno.');
    console.error('   Sin ella este script no sabe qué base respaldar (la base en memoria no es respaldable).');
    process.exit(1);
  }

  const stamp  = new Date().toISOString().replace(/:/g, '-').replace(/\..+$/, 'Z');
  const outDir = path.join(OUT_ROOT, stamp);

  const client = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 });
  let totalDocs = 0;
  const summary = [];

  try {
    await client.connect();
    const db = client.db();
    console.log(`📡 Conectado a ${safeUri(URI)}`);
    console.log(`🗄️  Base: ${db.databaseName}`);

    const collections = (await db.listCollections().toArray())
      .filter((c) => c.type === 'collection' && !c.name.startsWith('system.'));

    if (collections.length === 0) {
      console.error('❌ La base no tiene colecciones. Abortando: no se genera un respaldo vacío.');
      console.error('   Verifica que MONGODB_URI apunte a la base correcta.');
      process.exit(1);
    }

    fs.mkdirSync(outDir, { recursive: true });

    for (const { name } of collections) {
      const docs = await db.collection(name).find({}).toArray();
      const file = path.join(outDir, `${name}.json`);
      // relaxed:false conserva los tipos BSON para que la restauración sea fiel.
      fs.writeFileSync(file, EJSON.stringify(docs, null, 2, { relaxed: false }), 'utf8');
      totalDocs += docs.length;
      summary.push({ collection: name, documents: docs.length });
      console.log(`   ✔ ${name.padEnd(16)} ${String(docs.length).padStart(6)} documentos`);
    }

    fs.writeFileSync(
      path.join(outDir, '_manifest.json'),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        database: db.databaseName,
        totalDocuments: totalDocs,
        collections: summary,
      }, null, 2),
      'utf8'
    );

    console.log(`\n✅ Respaldo completo: ${outDir}`);
    console.log(`   ${summary.length} colecciones, ${totalDocs} documentos.`);

    prune(OUT_ROOT, KEEP);
  } catch (err) {
    console.error(`❌ Falló el respaldo: ${err.message}`);
    // Un directorio a medio escribir es peor que ninguno: se elimina.
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
};

run();
