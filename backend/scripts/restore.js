// Restaura un respaldo generado por backup.js.
// Uso: node scripts/restore.js --from <dir_del_respaldo> --yes [--drop]
//   --yes   confirmación obligatoria (sin ella el script no escribe nada)
//   --drop  vacía cada colección antes de insertar (por defecto se niega a tocar colecciones con datos)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const readline = require('readline');
const { MongoClient } = require('mongodb');
const { EJSON } = require('bson');

const arg  = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

const FROM = arg('from');
const DROP = flag('drop');
const YES  = flag('yes');
const URI  = process.env.MONGODB_URI;

const safeUri = (uri) => uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]*@/, '$1****@');

const confirm = (question) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
});

const run = async () => {
  if (!URI)  { console.error('❌ Falta MONGODB_URI en el entorno.'); process.exit(1); }
  if (!FROM) { console.error('❌ Falta --from <dir>. Ej: node scripts/restore.js --from ../backups/2026-09-09T12-00-00Z --yes'); process.exit(1); }
  if (!YES)  { console.error('❌ Falta --yes. La restauración sobrescribe datos: debe confirmarse explícitamente.'); process.exit(1); }

  const dir = path.resolve(FROM);
  if (!fs.existsSync(path.join(dir, '_manifest.json'))) {
    console.error(`❌ ${dir} no parece un respaldo válido (falta _manifest.json).`);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '_manifest.json'), 'utf8'));
  const client   = new MongoClient(URI, { serverSelectionTimeoutMS: 15000 });

  try {
    await client.connect();
    const db = client.db();

    console.log(`📦 Respaldo:  ${manifest.database} — ${manifest.createdAt} (${manifest.totalDocuments} documentos)`);
    console.log(`🎯 Destino:   ${db.databaseName} en ${safeUri(URI)}`);
    console.log(`   Modo:      ${DROP ? 'DROP (vacía cada colección antes de insertar)' : 'seguro (solo colecciones vacías)'}\n`);

    // El destino se escribe de verdad: se exige tipear el nombre de la base.
    const typed = await confirm(`Escribe el nombre de la base de destino para continuar (${db.databaseName}): `);
    if (typed !== db.databaseName) {
      console.error('❌ El nombre no coincide. Cancelado, no se escribió nada.');
      process.exit(1);
    }

    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_manifest.json');
    let restored = 0;

    for (const file of files) {
      const name = path.basename(file, '.json');
      const docs = EJSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      const col  = db.collection(name);

      if (docs.length === 0) { console.log(`   – ${name.padEnd(16)} vacío, omitido`); continue; }

      const existing = await col.countDocuments();
      if (existing > 0) {
        if (!DROP) {
          console.log(`   ! ${name.padEnd(16)} tiene ${existing} documentos — omitido (usa --drop para reemplazar)`);
          continue;
        }
        await col.deleteMany({});
      }

      await col.insertMany(docs, { ordered: false });
      restored += docs.length;
      console.log(`   ✔ ${name.padEnd(16)} ${String(docs.length).padStart(6)} documentos restaurados`);
    }

    console.log(`\n✅ Restauración terminada: ${restored} documentos.`);
  } catch (err) {
    console.error(`❌ Falló la restauración: ${err.message}`);
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
};

run();
