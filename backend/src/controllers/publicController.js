const Student   = require('../models/Student');
const Payment   = require('../models/Payment');
const PettyCash = require('../models/PettyCash');
const { isValidId } = require('../utils/validation');

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const MIN_BUSQUEDA = 2;
const MAX_RESULTADOS = 10;

// Quita tildes y pasa a minúsculas para que "gonzalez" encuentre "GONZÁLEZ".
// El rango ̀-ͯ son las marcas diacríticas que NFD separa de la letra.
const normalizar = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Etiqueta legible de un mes 'AAAA-MM'.
const etiquetaMes = (mes) => {
  if (typeof mes !== 'string') return 'Sin mes';
  const [a, m] = mes.split('-');
  const i = Number.parseInt(m, 10) - 1;
  return MESES[i] ? `${MESES[i]} ${a}` : mes;
};

// Una cuota anulada no se cobra: sale del total exigido, pero se informa aparte
// para que el apoderado entienda por qué su total no es el del resto.
const esVigente = (p) => p.status !== 'cancelled';

const totales = (registros, pagadoExtra = 0) => {
  const vigentes = registros.filter(esVigente);
  const exigido  = vigentes.reduce((s, p) => s + p.amount, 0);
  const pagado   = vigentes.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0) + pagadoExtra;
  return {
    total: exigido,
    paid: pagado,
    // Nunca se muestran cifras negativas: si pagó de más, se informa como excedente.
    pending: Math.max(0, exigido - pagado),
    surplus: Math.max(0, pagado - exigido),
    cancelled: registros.filter((p) => p.status === 'cancelled').reduce((s, p) => s + p.amount, 0),
  };
};

// GET /api/public/students?q=texto
// Búsqueda pública: devuelve solo id y nombre, nada financiero. Exige un mínimo
// de caracteres para que no sirva como listado completo del curso.
exports.searchStudents = async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < MIN_BUSQUEDA)
    return res.json({ results: [], message: `Escribe al menos ${MIN_BUSQUEDA} caracteres.` });

  // El curso tiene decenas de alumnos, así que se filtra en memoria: permite
  // ignorar tildes y buscar por cualquier parte del nombre, algo que un regex
  // de Mongo no resuelve bien. Con miles de registros habría que indexar un
  // campo normalizado en la base.
  const alumnos = await Student.find().select('name status').sort({ name: 1 });
  const termino = normalizar(q);
  const partes  = termino.split(/\s+/).filter(Boolean);

  const coincide = (nombre) => {
    const n = normalizar(nombre);
    return partes.every((p) => n.split(/\s+/).some((palabra) => palabra.startsWith(p)) || n.includes(p));
  };

  const results = alumnos
    .filter((a) => coincide(a.name))
    .slice(0, MAX_RESULTADOS)
    .map((a) => ({ id: a._id, name: a.name, active: a.status === 'active' }));

  res.json({ results, truncated: results.length === MAX_RESULTADOS });
};

// GET /api/public/students/:id/statement
// Estado de cuenta calculado desde los registros reales. No hay montos fijos en
// el código: el total exigido es la suma de las cuotas que el tesorero generó.
exports.getStatement = async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ message: 'Estudiante no válido.' });

  const student = await Student.findById(id).select('name status');
  if (!student) return res.status(404).json({ message: 'No encontramos un estudiante con ese nombre.' });

  const [pagos, movimientos] = await Promise.all([
    Payment.find({ student: id }).select('type amount status month date description').sort({ month: 1, date: 1 }),
    // La caja chica puede haberse registrado como movimiento desde la pantalla
    // Caja Chica, no solo como pago: se suman ambas fuentes para no subestimar.
    PettyCash.find({ student: id, type: 'income' }).select('amount date'),
  ]);

  const cuotas    = pagos.filter((p) => p.type === 'cuota_mensual');
  const cajaPagos = pagos.filter((p) => p.type === 'caja_chica');
  const otros     = pagos.filter((p) => p.type !== 'cuota_mensual' && p.type !== 'caja_chica');

  const movimientosCaja = movimientos.reduce((s, m) => s + m.amount, 0);

  const tCuotas = totales(cuotas);
  const tCaja   = totales(cajaPagos, movimientosCaja);
  const tOtros  = totales(otros);

  // El total exigido incluye los otros aportes si existen, para que "pagado" y
  // "pendiente" describan la situación completa del alumno y no una parte.
  const total   = tCuotas.total + tCaja.total + tOtros.total;
  const pagado  = tCuotas.paid + tCaja.paid + tOtros.paid;
  const pendiente = Math.max(0, total - pagado);

  let estado = 'al_dia';
  if (total > 0 && pagado === 0) estado = 'sin_pagos';
  else if (pendiente > 0) estado = 'con_deuda';

  res.json({
    student: { name: student.name, active: student.status === 'active' },
    cuotas: {
      ...tCuotas,
      count: cuotas.filter(esVigente).length,
      paidCount: cuotas.filter((p) => p.status === 'paid').length,
      months: cuotas.map((p) => ({
        month: p.month || null,
        label: etiquetaMes(p.month),
        amount: p.amount,
        status: p.status,
      })),
    },
    pettyCash: {
      ...tCaja,
      // Movimientos registrados directamente en la pantalla de Caja Chica.
      fromMovements: movimientosCaja,
    },
    otherPayments: {
      ...tOtros,
      items: otros.map((p) => ({
        type: p.type,
        description: p.description || '',
        amount: p.amount,
        status: p.status,
        date: p.date,
      })),
    },
    summary: { total, paid: pagado, pending: pendiente, surplus: Math.max(0, pagado - total), estado },
  });
};
