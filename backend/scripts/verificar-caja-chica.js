// Contrasta la planilla de caja chica contra lo que ya está en la base.
// Solo lee: no escribe nada. Sirve para decidir si hace falta importar o si el
// dato ya está cargado, y así no duplicar cobros.
//
// Uso: node scripts/verificar-caja-chica.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const mongoose = require('mongoose');
const Student = require('../src/models/Student');
const Payment = require('../src/models/Payment');
const PettyCash = require('../src/models/PettyCash');

const clp = (n) => '$' + n.toLocaleString('es-CL');

// Mismo criterio de slug que usa la planilla origen: sin tildes, minúsculas,
// separado por guiones. Permite cruzar sin depender de los nombres corruptos.
const slug = (nombre) => nombre
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\(.*?\)/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('❌ Falta MONGODB_URI en backend/.env.');
    process.exit(1);
  }

  const datos = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/caja-chica.json'), 'utf8'));
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`🗄️  Base: ${mongoose.connection.name}\n`);

  const alumnos = await Student.find().select('name');
  const porSlug = new Map(alumnos.map((a) => [slug(a.name), a]));

  const cobros = await Payment.find({ type: 'caja_chica' }).select('student amount status');
  const porAlumno = new Map(cobros.map((p) => [String(p.student), p]));

  const movimientos = await PettyCash.find({ type: 'income' }).select('student amount');
  const movPorAlumno = new Map();
  for (const m of movimientos) {
    const k = String(m.student);
    movPorAlumno.set(k, (movPorAlumno.get(k) || 0) + m.amount);
  }

  let coinciden = 0, faltantes = 0, distintos = 0, sinAlumno = 0;
  const problemas = [];

  for (const r of datos.registros) {
    const alumno = porSlug.get(r._id);
    if (!alumno) { sinAlumno++; problemas.push(`  ✘ sin alumno en la base: ${r._id}`); continue; }

    const cobro = porAlumno.get(String(alumno._id));
    const extra = movPorAlumno.get(String(alumno._id)) || 0;

    if (!cobro && extra === 0) {
      faltantes++;
      problemas.push(`  ✘ ${alumno.name}: no tiene caja chica registrada`);
      continue;
    }

    const pagadoBD = (cobro && cobro.status === 'paid' ? cobro.amount : 0) + extra;
    if (pagadoBD === r.monto) coinciden++;
    else {
      distintos++;
      problemas.push(`  ✘ ${alumno.name}: planilla ${clp(r.monto)} vs base ${clp(pagadoBD)}`);
    }
  }

  console.log('=== CRUCE PLANILLA vs BASE DE DATOS ===');
  console.log(`  Registros en la planilla:     ${datos.registros.length}`);
  console.log(`  Coinciden exactamente:        ${coinciden}`);
  console.log(`  Con monto distinto:           ${distintos}`);
  console.log(`  Sin registro en la base:      ${faltantes}`);
  console.log(`  Sin alumno correspondiente:   ${sinAlumno}`);
  if (problemas.length) console.log('\n' + problemas.join('\n'));

  const esperadoPlanilla = datos.registros.reduce((s, r) => s + r.monto, 0);
  const pagadoBD = cobros.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0)
                 + movimientos.reduce((s, m) => s + m.amount, 0);
  const exigidoBD = cobros.reduce((s, p) => s + p.amount, 0);

  console.log('\n=== TOTALES ===');
  console.log(`  Recaudado según la planilla:  ${clp(esperadoPlanilla)}`);
  console.log(`  Recaudado según la base:      ${clp(pagadoBD)}   ${pagadoBD === esperadoPlanilla ? '✔' : '✘'}`);
  console.log(`  Total exigido (19 x ${clp(datos.montoEsperado)}): ${clp(exigidoBD)}`);
  console.log(`  Registros de cobro en la base: ${cobros.length}`);

  const duplicados = cobros.length - new Set(cobros.map((p) => String(p.student))).size;
  console.log(`  Alumnos con cobro duplicado:   ${duplicados} ${duplicados === 0 ? '✔' : '✘'}`);

  const veredicto = coinciden === datos.registros.length && duplicados === 0;
  console.log(veredicto
    ? '\n✅ La planilla YA está cargada y cuadra. Importarla de nuevo duplicaría los cobros.'
    : '\n⚠️  Hay diferencias: revisa el detalle antes de importar nada.');

  await mongoose.disconnect();
  process.exit(veredicto ? 0 : 1);
};

run().catch(async (e) => {
  console.error('❌ Error:', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
