// Carga los datos reales del curso desde scripts/data/tesoreria-curso.json.
//
// Por defecto SOLO SIMULA. Escribir exige --commit de forma explícita, porque
// esto va contra la base de producción y no hay deshacer.
//
// Uso:
//   node scripts/import-tesoreria.js --anio 2025              (simulación)
//   node scripts/import-tesoreria.js --anio 2025 --commit     (escribe de verdad)
//
// Opciones:
//   --anio <AAAA>          obligatorio. La planilla origen no trae año.
//   --fecha-gastos <fecha> fecha a usar para los gastos (por defecto <anio>-12-01).
//   --forzar               permite importar aunque la base ya tenga alumnos.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const fs = require('fs');
const mongoose = require('mongoose');
const Student = require('../src/models/Student');
const Payment = require('../src/models/Payment');
const Expense = require('../src/models/Expense');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const flag = (n) => process.argv.includes(`--${n}`);
const clp = (n) => '$' + n.toLocaleString('es-CL');
const safeUri = (u) => u.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]*@/, '$1****@');

const ANIO   = Number.parseInt(arg('anio'), 10);
const COMMIT = flag('commit');
const FORZAR = flag('forzar');
const URI    = process.env.MONGODB_URI;
// IDs concretos a eliminar antes de importar (registros de prueba). Lista explícita
// separada por comas: nunca borra una colección entera.
const LIMPIAR = (arg('limpiar', '') || '').split(',').map((s) => s.trim()).filter(Boolean);

const datos = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/tesoreria-curso.json'), 'utf8'));
const FECHA_GASTOS = arg('fecha-gastos', `${ANIO}-12-01`);

// Construye todos los documentos a insertar sin tocar la base.
const construir = () => {
  const alumnos = [];
  const pagos = [];

  for (const a of datos.alumnos) {
    const _id = new mongoose.Types.ObjectId();
    alumnos.push({ _id, name: a.nombre, status: 'active' });

    for (let i = 0; i < a.cuotas.length; i++) {
      const numeroMes = datos.mesInicial + i;
      const mes = `${ANIO}-${String(numeroMes).padStart(2, '0')}`;
      const pagada = a.cuotas[i] === '1';
      pagos.push({
        type: 'cuota_mensual',
        amount: datos.montoCuota,
        // La planilla no registra el día exacto: se usa el 5 para las pagadas
        // (fecha habitual de cobro) y el 1 para las pendientes.
        date: new Date(`${mes}-${pagada ? '05' : '01'}T12:00:00.000Z`),
        student: _id,
        description: `Cuota mensual ${MESES[numeroMes - 1]} ${ANIO}`,
        status: pagada ? 'paid' : 'pending',
        month: mes,
      });
    }

    // La caja chica se carga como pago de tipo 'caja_chica': así el que no la
    // pagó queda registrado como pendiente (un movimiento de caja chica no
    // permite representar una deuda) y el que sí pagó suma al saldo.
    pagos.push({
      type: 'caja_chica',
      amount: datos.montoCajaChica,
      date: new Date(`${ANIO}-${String(datos.mesInicial).padStart(2, '0')}-01T12:00:00.000Z`),
      student: _id,
      description: 'Cuota única de caja chica',
      status: a.cajaChica ? 'paid' : 'pending',
    });
  }

  const gastos = datos.gastos.map((g) => ({
    category: g.categoria,
    amount: g.monto,
    date: new Date(`${FECHA_GASTOS}T12:00:00.000Z`),
    description: g.concepto,
    paymentMethod: 'otro',
    fund: 'general',
  }));

  return { alumnos, pagos, gastos };
};

const cuadrar = ({ pagos, gastos }) => {
  const pagado = (t) => pagos.filter((p) => p.type === t && p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const cuotas = pagado('cuota_mensual');
  const caja   = pagado('caja_chica');
  const egreso = gastos.reduce((s, g) => s + g.amount, 0);
  return { cuotas, caja, total: cuotas + caja, egreso, saldo: cuotas + caja - egreso };
};

const run = async () => {
  if (!Number.isInteger(ANIO) || ANIO < 2000 || ANIO > 2100) {
    console.error('❌ Falta --anio <AAAA>. La planilla origen no trae año y sin él las cuotas');
    console.error('   quedarían en el mes equivocado. Ejemplo: node scripts/import-tesoreria.js --anio 2025');
    process.exit(1);
  }
  if (!URI) {
    console.error('❌ Falta MONGODB_URI en backend/.env. Sin eso no hay a dónde importar.');
    process.exit(1);
  }

  const datosNuevos = construir();
  const t = cuadrar(datosNuevos);
  const esperado = datos.resumenEsperado;

  console.log('\n=== CORRECCIÓN DE CODIFICACIÓN ===');
  const corregidos = datos.alumnos.filter((a) => a.nombre !== a.nombreOrigen);
  for (const a of corregidos) console.log(`  ${a.nombreOrigen}\n    -> ${a.nombre}`);
  for (const g of datos.gastos.filter((g) => g.conceptoOrigen)) console.log(`  ${g.conceptoOrigen}\n    -> ${g.concepto}`);
  console.log(`  (${corregidos.length} alumnos y ${datos.gastos.filter((g) => g.conceptoOrigen).length} gastos corregidos)`);

  console.log('\n=== A IMPORTAR ===');
  console.log(`  Año de las cuotas:  ${ANIO} (${MESES[datos.mesInicial - 1]} a Diciembre)`);
  console.log(`  Alumnos:            ${datosNuevos.alumnos.length}`);
  console.log(`  Cuotas mensuales:   ${datosNuevos.pagos.filter((p) => p.type === 'cuota_mensual').length}`);
  console.log(`  Cuotas caja chica:  ${datosNuevos.pagos.filter((p) => p.type === 'caja_chica').length}`);
  console.log(`  Gastos:             ${datosNuevos.gastos.length} (todos con fecha ${FECHA_GASTOS}, la planilla no trae fechas)`);

  console.log('\n=== CUADRATURA CONTRA EL RESUMEN DE LA PLANILLA ===');
  const filas = [
    ['Ingreso por cuotas',     t.cuotas, esperado.ingresoCuotas],
    ['Ingreso por caja chica', t.caja,   esperado.ingresoCajaChica],
    ['Ingreso total',          t.total,  esperado.ingresoTotal],
    ['Egresos',                t.egreso, esperado.egresoTotal],
    ['Saldo',                  t.saldo,  esperado.saldo],
  ];
  let descuadre = false;
  for (const [etiqueta, calculado, plantilla] of filas) {
    const ok = calculado === plantilla;
    if (!ok) descuadre = true;
    console.log(`  ${ok ? '✔' : '✘'} ${etiqueta.padEnd(24)} ${clp(calculado).padStart(12)}   planilla: ${clp(plantilla)}`);
  }
  if (descuadre) {
    console.error('\n❌ Los totales no cuadran con el resumen de la planilla. No se importa nada.');
    process.exit(1);
  }

  console.log('\n=== SALDOS QUE MOSTRARÁ LA APP ===');
  console.log(`  Fondo general (cuotas - gastos):  ${clp(t.cuotas - t.egreso)}`);
  console.log(`  Caja chica:                       ${clp(t.caja)}`);
  console.log(`  Suma de ambos:                    ${clp(t.saldo)}  (= saldo de la planilla)`);
  console.log('  Nota: la planilla llevaba un solo bolsillo; la app separa fondo general y caja');
  console.log('  chica. El total coincide, el desglose es más detallado.');

  const cliente = await mongoose.connect(URI, { serverSelectionTimeoutMS: 15000 });
  const nombreBD = cliente.connection.name;
  console.log(`\n=== DESTINO ===\n  ${safeUri(URI)}\n  Base: ${nombreBD}`);

  const [yaAlumnos, yaPagos, yaGastos] = await Promise.all([
    Student.countDocuments(), Payment.countDocuments(), Expense.countDocuments(),
  ]);
  console.log(`  Contenido actual: ${yaAlumnos} alumnos, ${yaPagos} pagos, ${yaGastos} gastos`);

  if (yaAlumnos > 0) {
    console.log('\n  Alumnos ya presentes:');
    for (const s of await Student.find().select('name status createdAt').sort({ name: 1 })) {
      const choca = datos.alumnos.some((a) => {
        const partes = s.name.toLowerCase().split(/\s+/);
        return partes.every((p) => a.nombre.toLowerCase().includes(p));
      });
      console.log(`    - ${s.name}${choca ? '   ⚠️  coincide con un alumno de la planilla (quedaría duplicado)' : ''}`);
    }
  }

  // Limpieza previa acotada: elimina SOLO los identificadores indicados a mano en
  // --limpiar, nunca una colección completa. Se usa para descartar registros de
  // prueba antes de la carga inicial, y siempre con respaldo hecho.
  if (LIMPIAR.length) {
    const aBorrarAlumnos = await Student.find({ _id: { $in: LIMPIAR } });
    const aBorrarPagos   = await Payment.find({ _id: { $in: LIMPIAR } });
    const huerfanos      = await Payment.find({ student: { $in: aBorrarAlumnos.map((s) => s._id) } });

    console.log('\n=== LIMPIEZA PREVIA (solo los IDs indicados) ===');
    for (const s of aBorrarAlumnos) console.log(`  alumno  ${s._id}  ${s.name}`);
    for (const p of aBorrarPagos)   console.log(`  pago    ${p._id}  ${p.type} ${clp(p.amount)} ${p.month || ''}`);
    for (const p of huerfanos)      console.log(`  pago    ${p._id}  (de un alumno a borrar) ${p.type} ${clp(p.amount)}`);

    const encontrados = new Set([...aBorrarAlumnos, ...aBorrarPagos].map((d) => String(d._id)));
    const faltantes = LIMPIAR.filter((id) => !encontrados.has(id));
    if (faltantes.length) {
      console.error(`\n❌ Estos IDs no existen en la base: ${faltantes.join(', ')}`);
      console.error('   No se borra nada: el estado no es el esperado.');
      await mongoose.disconnect();
      process.exit(1);
    }

    if (COMMIT) {
      const rp = await Payment.deleteMany({ _id: { $in: [...aBorrarPagos, ...huerfanos].map((p) => p._id) } });
      const rs = await Student.deleteMany({ _id: { $in: aBorrarAlumnos.map((s) => s._id) } });
      console.log(`  → eliminados ${rs.deletedCount} alumnos y ${rp.deletedCount} pagos.`);
    } else {
      console.log('  (simulación: no se borró nada)');
    }
  }

  // El bloqueo se evalúa después de la limpieza y solo al escribir: la simulación
  // siempre debe poder mostrarse completa.
  const alumnosRestantes = await Student.countDocuments();
  if (alumnosRestantes > 0 && COMMIT && !FORZAR) {
    console.error(`\n❌ La base todavía tiene ${alumnosRestantes} alumnos. Importar encima duplicaría registros.`);
    console.error('   Revisa qué hay antes de continuar. Si de verdad quieres agregar, usa --forzar.');
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!COMMIT) {
    console.log('\n🔵 SIMULACIÓN. No se escribió nada.');
    console.log('   Para importar de verdad, repite el comando agregando --commit');
    console.log('   y respalda antes con: npm run backup');
    await mongoose.disconnect();
    return;
  }

  console.log('\n⚠️  Escribiendo en la base...');
  await Student.insertMany(datosNuevos.alumnos);
  await Payment.insertMany(datosNuevos.pagos);
  await Expense.insertMany(datosNuevos.gastos);

  // Se vuelve a leer desde la base: lo que importa es lo que quedó guardado.
  const guardados = await Payment.find({ status: 'paid' });
  const gastosBD  = await Expense.find({});
  const verif = {
    alumnos: await Student.countDocuments(),
    cuotas:  guardados.filter((p) => p.type === 'cuota_mensual').reduce((s, p) => s + p.amount, 0),
    caja:    guardados.filter((p) => p.type === 'caja_chica').reduce((s, p) => s + p.amount, 0),
    egreso:  gastosBD.reduce((s, g) => s + g.amount, 0),
  };

  console.log('\n=== VERIFICACIÓN LEYENDO DESDE LA BASE ===');
  const checks = [
    ['Alumnos',              verif.alumnos, esperado.totalAlumnos],
    ['Ingreso cuotas',       verif.cuotas,  esperado.ingresoCuotas],
    ['Ingreso caja chica',   verif.caja,    esperado.ingresoCajaChica],
    ['Egresos',              verif.egreso,  esperado.egresoTotal],
    ['Saldo',                verif.cuotas + verif.caja - verif.egreso, esperado.saldo],
  ];
  let fallo = false;
  for (const [etiqueta, real, esp] of checks) {
    const ok = real === esp;
    if (!ok) fallo = true;
    console.log(`  ${ok ? '✔' : '✘'} ${etiqueta.padEnd(20)} ${String(real).padStart(10)}   esperado: ${esp}`);
  }

  await mongoose.disconnect();
  console.log(fallo ? '\n❌ La importación terminó con diferencias. Revisa antes de usar la app.'
                    : '\n✅ Importación completa y cuadrada.');
  process.exit(fallo ? 1 : 0);
};

run().catch(async (e) => {
  console.error('❌ Error:', e.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
