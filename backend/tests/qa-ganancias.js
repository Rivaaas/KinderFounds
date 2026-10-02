// Ganancias de actividades (venta de completos, kermesse...): cada una dice a
// qué fondo entra el dinero y el dashboard, el libro de caja chica y el reporte
// por actividad lo reflejan. La suite deja la base como la encontró.
const { suite, check, eq, GET, POST, PUT, DEL } = require('./harness');

const dash = async () => (await GET('/dashboard/summary')).data;
const fondo = (d, key) => d.funds.find((f) => f.key === key);

async function suiteGanancias() {
  suite('GANANCIAS DE ACTIVIDADES — venta de completos y similares');

  const antes = await dash();

  let r = await POST('/activities', {
    name: 'Venta de completos', type: 'venta', date: '2026-10-10', status: 'active',
    description: 'Venta en la salida del colegio', students: [], amountPerStudent: 0, publicVisible: true,
  });
  eq('Se crea una actividad de tipo "venta"', r.status, 201);
  const act = r.data?._id;
  eq('El tipo venta queda guardado', r.data?.type, 'venta');

  // --- Validaciones ----------------------------------------------------------
  r = await POST(`/activities/${act}/earnings`, { amount: 50000 });
  eq('Ganancia sin fondo se rechaza', r.status, 400);
  r = await POST(`/activities/${act}/earnings`, { amount: 50000, fund: 'bitcoin' });
  eq('Ganancia con fondo inexistente se rechaza', r.status, 400);
  r = await POST(`/activities/${act}/earnings`, { amount: 0, fund: 'actividades' });
  eq('Ganancia de $0 se rechaza', r.status, 400);
  r = await POST('/activities/000000000000000000000000/earnings', { amount: 1000, fund: 'actividades' });
  eq('Ganancia sobre actividad inexistente devuelve 404', r.status, 404);

  // --- Registrar cuánto se ganó y a qué fondo va -----------------------------
  r = await POST(`/activities/${act}/earnings`, { amount: 85000, fund: 'actividades', date: '2026-10-10', description: 'Día 1' });
  eq('Se registra la ganancia al fondo de actividades', r.status, 201);
  const g1 = r.data?._id;
  r = await POST(`/activities/${act}/earnings`, { amount: 85000, fund: 'actividades', date: '2026-10-10', description: 'Día 1' });
  eq('El mismo envío repetido se rechaza como duplicado', r.status, 409);

  r = await POST(`/activities/${act}/earnings`, { amount: 15000, fund: 'caja_chica', date: '2026-10-11', description: 'Vuelto sobrante' });
  eq('Se registra otra ganancia, esta vez a caja chica', r.status, 201);
  const g2 = r.data?._id;

  let d = await dash();
  eq('El fondo de actividades recibe su ganancia', fondo(d, 'actividades').balance, fondo(antes, 'actividades').balance + 85000);
  eq('La caja chica recibe la suya', fondo(d, 'caja_chica').balance, fondo(antes, 'caja_chica').balance + 15000);
  eq('El fondo de cuotas no cambia', fondo(d, 'cuotas').balance, fondo(antes, 'cuotas').balance);
  eq('El total del curso sube en la suma', d.balance.total, antes.balance.total + 100000);
  eq('Resumen de ganancias en el dashboard', d.activityEarnings.total, antes.activityEarnings.total + 100000);

  const libro = (await GET('/petty-cash')).data;
  check('La ganancia a caja chica aparece en su libro con origen "activity"',
    libro.movements.some((m) => m.origin === 'activity' && m.amount === 15000 && m.type === 'income'),
    JSON.stringify(libro.movements.slice(0, 3)));

  // --- La actividad informa sus ganancias -------------------------------------
  r = await GET(`/activities/${act}`);
  eq('Detalle: total ganado', r.data.earnings.total, 100000);
  eq('Detalle: desglose por fondo', r.data.earnings.byFund, { cuotas: 0, actividades: 85000, caja_chica: 15000 });
  eq('Detalle: el ingreso total de la actividad incluye las ganancias', r.data.totalIncome, 100000);
  eq('Detalle: lista de ganancias', r.data.earningEntries.length, 2);

  const lista = (await GET('/activities')).data.find((a) => a._id === act);
  eq('Listado: cada tarjeta trae el total ganado', lista?.earnings?.total, 100000);

  const rep = (await GET(`/reports/activity/${act}`)).data;
  eq('Reporte por actividad: incluye las ganancias', rep.totalEarnings, 100000);
  eq('Reporte por actividad: balance = ingresos - gastos', rep.balance, rep.totalIncome - rep.totalExpense);

  const pub = (await GET('/public/activities', { token: null })).data;
  const pubAct = pub.activities.find((a) => a.name === 'Venta de completos');
  eq('Consulta pública: muestra cuánto ganó la actividad (solo el total)', pubAct?.earned, 100000);

  // --- Corregir fondo de una ganancia --------------------------------------
  r = await PUT(`/activities/${act}/earnings/${g2}`, { fund: 'cuotas' });
  eq('Se puede cambiar el fondo de una ganancia', r.status, 200);
  d = await dash();
  eq('Caja chica devuelve el monto', fondo(d, 'caja_chica').balance, fondo(antes, 'caja_chica').balance);
  eq('Cuotas lo recibe', fondo(d, 'cuotas').balance, fondo(antes, 'cuotas').balance + 15000);
  eq('El total no cambia al mover entre fondos', d.balance.total, antes.balance.total + 100000);

  // --- No se puede borrar la actividad con ganancias ---------------------------
  r = await DEL(`/activities/${act}`);
  eq('Borrar una actividad con ganancias se rechaza con 409', r.status, 409);

  // --- Limpieza ---------------------------------------------------------------
  r = await DEL(`/activities/${act}/earnings/${g1}`);
  eq('Se elimina la primera ganancia', r.status, 200);
  r = await DEL(`/activities/${act}/earnings/${g2}`);
  eq('Se elimina la segunda ganancia', r.status, 200);
  r = await DEL(`/activities/${act}/earnings/${g2}`);
  eq('Eliminar dos veces devuelve 404', r.status, 404);
  r = await DEL(`/activities/${act}`);
  eq('Sin ganancias, la actividad sí se borra', r.status, 200);
  d = await dash();
  eq('Tras la limpieza los saldos vuelven a los de partida', d.funds.map((f) => f.balance), antes.funds.map((f) => f.balance));
}

module.exports = { suiteGanancias };
