// Separación del dinero en tres fondos (cuotas, actividades, caja chica):
// cada gasto y descuento sale del fondo elegido y el dashboard lo refleja.
// La suite deja la base como la encontró para no alterar las suites siguientes.
const { suite, check, eq, record, GET, POST, PUT, DEL } = require('./harness');

const dash = async () => (await GET('/dashboard/summary')).data;
const fondo = (d, key) => d.funds.find((f) => f.key === key);

async function suiteFondos() {
  suite('FONDOS — cuotas / actividades / caja chica');

  const antes = await dash();
  check('El dashboard entrega los tres fondos',
    Array.isArray(antes.funds) && ['cuotas', 'actividades', 'caja_chica'].every((k) => fondo(antes, k)),
    JSON.stringify(antes.funds));

  for (const f of antes.funds) {
    eq(`Fondo ${f.key}: saldo = ingresos - gastos - descuentos (+ saldo inicial en caja chica)`,
      f.balance, (f.initialBalance || 0) + f.income - f.expenses - f.discounts);
  }
  eq('Saldo total = suma de los saldos de los tres fondos',
    antes.balance.total, antes.funds.reduce((s, f) => s + f.balance, 0));
  eq('Descuentos: total = suma de los tres fondos',
    antes.discounts.total, antes.discounts.cuotas + antes.discounts.actividades + antes.discounts.pettyCash);

  const creados = { expenses: [], discounts: [] };

  // --- Gasto cargado al fondo de actividades -------------------------------
  let r = await POST('/expenses', { category: 'compra_actividad', amount: 7300, description: 'Globos para el stand', fund: 'actividades', date: '2026-10-02' });
  eq('Se registra un gasto con fondo "actividades"', r.status, 201);
  if (r.status === 201) creados.expenses.push(r.data._id);
  eq('El gasto queda guardado con fund = actividades', r.data?.fund, 'actividades');

  let d = await dash();
  eq('Un gasto de actividades descuenta solo del fondo de actividades',
    fondo(d, 'actividades').balance, fondo(antes, 'actividades').balance - 7300);
  eq('...y no toca el fondo de cuotas', fondo(d, 'cuotas').balance, fondo(antes, 'cuotas').balance);
  eq('...ni la caja chica', fondo(d, 'caja_chica').balance, fondo(antes, 'caja_chica').balance);

  // --- Descuento desde actividades ------------------------------------------
  r = await POST('/discounts', { description: 'Apoyo para rifa', amount: 1500, source: 'actividades', category: 'otro', date: '2026-10-02' });
  eq('Se registra un descuento con origen "actividades"', r.status, 201);
  if (r.status === 201) creados.discounts.push(r.data._id);

  d = await dash();
  eq('El descuento sale del fondo de actividades',
    fondo(d, 'actividades').balance, fondo(antes, 'actividades').balance - 7300 - 1500);
  eq('El total de descuentos lo incluye', d.discounts.total, antes.discounts.total + 1500);
  eq('El desglose de descuentos por actividades lo incluye', d.discounts.actividades, antes.discounts.actividades + 1500);

  // --- Valores heredados se aceptan y se normalizan --------------------------
  r = await POST('/expenses', { category: 'otro', amount: 1000, description: 'Gasto con fondo heredado', fund: 'general', date: '2026-10-02' });
  eq('Un gasto enviado con el fondo heredado "general" se acepta', r.status, 201);
  if (r.status === 201) creados.expenses.push(r.data._id);
  eq('...y se guarda normalizado como "cuotas"', r.data?.fund, 'cuotas');

  r = await POST('/discounts', { description: 'Descuento con origen heredado', amount: 500, source: 'cuotas_mensuales', date: '2026-10-02' });
  eq('Un descuento con el origen heredado "cuotas_mensuales" se acepta', r.status, 201);
  if (r.status === 201) creados.discounts.push(r.data._id);
  eq('...y se guarda normalizado como "cuotas"', r.data?.source, 'cuotas');

  d = await dash();
  eq('Ambos descontaron del fondo de cuotas',
    fondo(d, 'cuotas').balance, fondo(antes, 'cuotas').balance - 1000 - 500);

  // --- Filtros por fondo incluyen los equivalentes heredados ----------------
  const porCuotas = (await GET('/expenses?fund=cuotas')).data;
  check('Filtrar gastos por "cuotas" trae los guardados como cuotas o general',
    porCuotas.every((e) => e.fund === 'cuotas' || e.fund === 'general') && porCuotas.some((e) => e._id === creados.expenses[1]),
    JSON.stringify(porCuotas.map((e) => e.fund)));
  const porGeneral = (await GET('/expenses?fund=general')).data;
  eq('Filtrar por el alias heredado "general" devuelve lo mismo que "cuotas"', porGeneral.length, porCuotas.length);
  const descActividades = (await GET('/discounts?source=actividades')).data;
  check('Filtrar descuentos por "actividades" devuelve solo ese fondo',
    descActividades.discounts.length > 0 && descActividades.discounts.every((x) => x.source === 'actividades'),
    JSON.stringify(descActividades.discounts.map((x) => x.source)));

  // --- Fondos inválidos se rechazan ----------------------------------------
  r = await POST('/expenses', { category: 'otro', amount: 1000, description: 'Fondo inventado', fund: 'bitcoin' });
  eq('Gasto con fondo inexistente se rechaza con 400', r.status, 400);
  r = await POST('/discounts', { description: 'Fondo inventado', amount: 1000, source: 'bitcoin' });
  eq('Descuento con fondo inexistente se rechaza con 400', r.status, 400);
  r = await GET('/expenses?fund=bitcoin');
  eq('Filtro por fondo inexistente se rechaza con 400', r.status, 400);

  // --- Reasignar un gasto de fondo mueve el dinero entre fondos --------------
  r = await PUT('/expenses/' + creados.expenses[0], { fund: 'caja_chica' });
  eq('Se puede cambiar el fondo de un gasto existente', r.status, 200);
  d = await dash();
  eq('Al moverlo a caja chica, el fondo de actividades recupera el monto',
    fondo(d, 'actividades').balance, fondo(antes, 'actividades').balance - 1500);
  eq('...y la caja chica lo descuenta', fondo(d, 'caja_chica').balance, fondo(antes, 'caja_chica').balance - 7300);
  eq('El saldo total no cambia al mover dinero entre fondos',
    d.balance.total, antes.balance.total - 7300 - 1500 - 1000 - 500);

  // --- Gráfico mensual con desglose por fondo -------------------------------
  const chart = (await GET('/dashboard/chart/monthly?year=2026')).data;
  const oct = chart[9];
  check('El gráfico mensual desglosa gastos por fondo', oct && typeof oct.expenseCuotas === 'number' && typeof oct.expenseActividades === 'number' && typeof oct.expenseCajaChica === 'number', JSON.stringify(oct));
  eq('En el gráfico, el gasto del mes = suma de los tres fondos', oct.expense, oct.expenseCuotas + oct.expenseActividades + oct.expenseCajaChica);

  // --- Limpieza -------------------------------------------------------------
  for (const id of creados.expenses)  await DEL('/expenses/' + id);
  for (const id of creados.discounts) await DEL('/discounts/' + id);
  const despues = await dash();
  eq('Tras eliminar lo creado, los saldos vuelven a los de partida',
    despues.funds.map((f) => f.balance), antes.funds.map((f) => f.balance));
  record(true, 'Limpieza de la suite de fondos completada');
}

module.exports = { suiteFondos };
