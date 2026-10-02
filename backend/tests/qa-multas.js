// Multas a alumnos: nacen pendientes, al cobrarlas entran al fondo elegido, se
// reflejan en el dashboard, en el libro de caja chica y en el estado de cuenta
// público. La suite deja la base como la encontró.
const { suite, check, eq, record, GET, POST, PUT, DEL, state } = require('./harness');

const dash = async () => (await GET('/dashboard/summary')).data;
const fondo = (d, key) => d.funds.find((f) => f.key === key);

async function suiteMultas() {
  suite('MULTAS — cobros extra a alumnos');

  const alumnos = await state.db.collection('students').find({}).limit(2).toArray();
  if (alumnos.length < 1) { record(false, 'No hay alumnos para probar multas'); return; }
  const alumno = String(alumnos[0]._id);

  const antes = await dash();
  const statementAntes = (await GET(`/public/students/${alumno}/statement`, { token: null })).data;

  // --- Validaciones ----------------------------------------------------------
  let r = await POST('/fines', { reason: 'dano_material', amount: 3000 });
  eq('Multa sin alumno se rechaza', r.status, 400);
  r = await POST('/fines', { student: alumno, reason: 'volar_sin_permiso', amount: 3000 });
  eq('Motivo fuera de la lista se rechaza', r.status, 400);
  r = await POST('/fines', { student: alumno, reason: 'otro', amount: 3000 });
  eq('Motivo "otro" sin descripción se rechaza', r.status, 400);
  r = await POST('/fines', { student: alumno, reason: 'dano_material', amount: 0 });
  eq('Multa de $0 se rechaza', r.status, 400);
  r = await POST('/fines', { student: '000000000000000000000000', reason: 'dano_material', amount: 3000 });
  eq('Alumno inexistente se rechaza', r.status, 400);

  // --- Crear -----------------------------------------------------------------
  r = await POST('/fines', { student: alumno, reason: 'dano_material', description: 'Rompió un cuento de la biblioteca', amount: 4500, date: '2026-10-02' });
  eq('Se registra una multa', r.status, 201);
  const multa = r.data?._id;
  eq('Nace pendiente', r.data?.status, 'pending');
  check('Viene con el nombre del alumno', r.data?.student?.name, JSON.stringify(r.data));

  r = await POST('/fines', { student: alumno, reason: 'dano_material', description: 'Rompió un cuento de la biblioteca', amount: 4500, date: '2026-10-02' });
  eq('El mismo envío repetido se rechaza como duplicado', r.status, 409);

  let d = await dash();
  eq('Una multa pendiente no suma a ningún fondo', d.balance.total, antes.balance.total);
  eq('...pero el dashboard la informa como por cobrar', d.fines.pending, antes.fines.pending + 4500);

  let st = (await GET(`/public/students/${alumno}/statement`, { token: null })).data;
  eq('Estado de cuenta público: la multa aparece pendiente', st.fines.pending, 4500);
  check('Estado de cuenta público: muestra monto y motivo', st.fines.items.some((i) => i.amount === 4500 && i.reasonLabel === 'Daño de material'), JSON.stringify(st.fines.items));
  eq('Estado de cuenta público: el pendiente total la incluye', st.summary.pending, statementAntes.summary.pending + 4500);

  // --- Cobrar eligiendo fondo ------------------------------------------------
  r = await PUT(`/fines/${multa}/pay`, {});
  eq('Cobrar sin indicar fondo se rechaza', r.status, 400);
  r = await PUT(`/fines/${multa}/pay`, { fund: 'bitcoin' });
  eq('Cobrar a un fondo inexistente se rechaza', r.status, 400);

  r = await PUT(`/fines/${multa}/pay`, { fund: 'caja_chica', date: '2026-10-02' });
  eq('Se marca pagada eligiendo caja chica', r.status, 200);
  eq('Queda con el fondo elegido', r.data?.paidFund, 'caja_chica');

  d = await dash();
  eq('El dinero entra a caja chica', fondo(d, 'caja_chica').balance, fondo(antes, 'caja_chica').balance + 4500);
  eq('...y no al fondo de cuotas', fondo(d, 'cuotas').balance, fondo(antes, 'cuotas').balance);
  eq('El total del curso sube en el monto de la multa', d.balance.total, antes.balance.total + 4500);
  eq('Resumen de multas: cobradas a caja chica', d.fines.byFund.caja_chica, antes.fines.byFund.caja_chica + 4500);

  const libro = (await GET('/petty-cash')).data;
  check('La multa aparece en el libro de caja chica como ingreso con origen "fine"',
    libro.movements.some((m) => m.origin === 'fine' && m.amount === 4500 && m.type === 'income'),
    JSON.stringify(libro.movements.slice(0, 3)));

  st = (await GET(`/public/students/${alumno}/statement`, { token: null })).data;
  eq('Estado de cuenta público: la multa pasa a pagada', st.fines.paid, 4500);
  eq('Estado de cuenta público: ya no está pendiente', st.fines.pending, 0);

  // --- Corregir el fondo de una multa ya pagada -------------------------------
  r = await PUT(`/fines/${multa}/pay`, { fund: 'actividades' });
  eq('Se puede corregir el fondo de una multa pagada', r.status, 200);
  d = await dash();
  eq('Caja chica devuelve el monto', fondo(d, 'caja_chica').balance, fondo(antes, 'caja_chica').balance);
  eq('Actividades lo recibe', fondo(d, 'actividades').balance, fondo(antes, 'actividades').balance + 4500);

  // --- Deshacer el pago ------------------------------------------------------
  r = await PUT(`/fines/${multa}/unpay`);
  eq('Se deshace el pago', r.status, 200);
  eq('Vuelve a pendiente', r.data?.status, 'pending');
  check('Sin fondo ni fecha de pago', !r.data?.paidFund && !r.data?.paidAt, JSON.stringify(r.data));
  d = await dash();
  eq('Los saldos vuelven a los de partida', d.funds.map((f) => f.balance), antes.funds.map((f) => f.balance));

  r = await PUT(`/fines/${multa}/unpay`);
  eq('Deshacer una multa que no está pagada se rechaza', r.status, 400);

  // --- Anular ----------------------------------------------------------------
  r = await PUT(`/fines/${multa}`, { status: 'cancelled' });
  eq('Se anula la multa', r.status, 200);
  r = await PUT(`/fines/${multa}/pay`, { fund: 'cuotas' });
  eq('Una multa anulada no se puede cobrar', r.status, 400);
  r = await PUT(`/fines/${multa}`, { status: 'paid' });
  eq('No se puede marcar pagada por edición directa', r.status, 400);
  st = (await GET(`/public/students/${alumno}/statement`, { token: null })).data;
  eq('Anulada, no se informa al apoderado', st.fines.count, 0);
  d = await dash();
  eq('Anulada, no cuenta como por cobrar', d.fines.pending, antes.fines.pending);

  // --- Listado y filtros ---------------------------------------------------
  r = await GET('/fines');
  check('El listado trae totales y etiquetas de motivos', r.data?.totals && r.data?.reasons?.dano_material, JSON.stringify(r.data?.totals));
  r = await GET(`/fines?student=${alumno}&status=cancelled`);
  check('Filtra por alumno y estado', r.data.fines.every((f) => f.status === 'cancelled' && String(f.student._id) === alumno), JSON.stringify(r.data.fines.length));
  r = await GET('/fines?status=cualquiera');
  eq('Estado inválido en el filtro se rechaza', r.status, 400);

  // --- Limpieza ----------------------------------------------------------------
  r = await DEL(`/fines/${multa}`);
  eq('Se elimina la multa', r.status, 200);
  r = await DEL(`/fines/${multa}`);
  eq('Eliminar dos veces devuelve 404', r.status, 404);
  d = await dash();
  eq('Tras la limpieza el dashboard queda como al inicio', [d.balance.total, d.fines.pending, d.fines.paid], [antes.balance.total, antes.fines.pending, antes.fines.paid]);
}

module.exports = { suiteMultas };
