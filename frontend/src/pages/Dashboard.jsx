import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatCLP } from '../utils/formatters';
import { FUNDS, fundByKey } from '../config/funds';
import { useTheme } from '../context/ThemeContext';
import {
  Wallet, TrendingUp, TrendingDown, Tag, UserCheck, UserX, Users, ArrowRight, PiggyBank, AlertTriangle,
} from 'lucide-react';

// Pantalla de cada fondo, para saltar desde su tarjeta.
const FUND_ROUTES = { cuotas: '/payments', actividades: '/activities', caja_chica: '/petty-cash' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-3 text-sm">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-white/80">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          {p.name}: <span className="tabular-nums">{formatCLP(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

// Importe grande que no desborda en pantallas angostas.
const Money = ({ value, className = '' }) => (
  <span className={`tabular-nums break-words leading-tight ${className}`}>{formatCLP(value)}</span>
);

function FundCard({ fund }) {
  const cfg = fundByKey(fund.key);
  const salidas = fund.expenses + fund.discounts;
  const base = (fund.initialBalance || 0) + fund.income;
  const usado = base > 0 ? Math.min(100, Math.round((salidas / base) * 100)) : 0;
  const negativo = fund.balance < 0;

  return (
    <section
      className="glass p-4 sm:p-5 flex flex-col gap-3 border-t-4 min-w-0"
      style={{ borderTopColor: cfg.color }}
      aria-label={`Fondo ${cfg.label}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-200">
            <span aria-hidden="true">{cfg.emoji}</span>
            <span className="truncate">{cfg.label}</span>
          </div>
          <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{cfg.hint}</div>
        </div>
        <Link to={FUND_ROUTES[fund.key]} className="shrink-0 text-xs font-medium text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200 flex items-center gap-1">
          Ver <ArrowRight size={12} />
        </Link>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">Saldo disponible</div>
        <div className={`text-2xl sm:text-3xl font-extrabold ${negativo ? 'text-kinder-coral' : cfg.text}`}>
          <Money value={fund.balance} />
        </div>
      </div>

      {/* Barra: qué parte de lo reunido ya salió */}
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden" role="img" aria-label={`${usado}% de lo reunido ya se usó`}>
        <div className="h-full rounded-full" style={{ width: `${usado}%`, background: cfg.color }} />
      </div>

      <dl className="text-sm space-y-1.5">
        {fund.initialBalance > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500 dark:text-slate-400">Saldo inicial</dt>
            <dd className="tabular-nums font-medium text-gray-700 dark:text-slate-200">{formatCLP(fund.initialBalance)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500 dark:text-slate-400 flex items-center gap-1"><TrendingUp size={13} className="text-kinder-green" /> Reunido</dt>
          <dd className="tabular-nums font-medium text-gray-700 dark:text-slate-200">{formatCLP(fund.income)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500 dark:text-slate-400 flex items-center gap-1"><TrendingDown size={13} className="text-kinder-coral" /> {fund.movementsOut ? 'Gastos y egresos' : 'Gastos'}</dt>
          <dd className="tabular-nums font-medium text-gray-700 dark:text-slate-200">− {formatCLP(fund.expenses)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-gray-500 dark:text-slate-400 flex items-center gap-1"><Tag size={13} className="text-amber-500" /> Descuentos</dt>
          <dd className="tabular-nums font-medium text-gray-700 dark:text-slate-200">− {formatCLP(fund.discounts)}</dd>
        </div>
      </dl>
    </section>
  );
}

function BreakdownCard({ title, icon: Icon, iconClass, total, byFund, to, note }) {
  return (
    <section className="glass p-4 sm:p-5 min-w-0">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconClass}`}><Icon size={18} /></div>
          <div>
            <div className="text-sm font-semibold text-gray-700 dark:text-slate-200">{title}</div>
            {note && <div className="text-[11px] text-gray-400 dark:text-slate-500">{note}</div>}
          </div>
        </div>
        <Link to={to} className="shrink-0 text-xs font-medium text-gray-400 hover:text-gray-700 dark:text-slate-500 dark:hover:text-slate-200 flex items-center gap-1">
          Ver <ArrowRight size={12} />
        </Link>
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-gray-800 dark:text-white"><Money value={total} /></div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {FUNDS.map((f) => (
          <li key={f.key} className={`px-2.5 py-1 rounded-full text-xs font-semibold ${f.badge} tabular-nums`}>
            {f.emoji} {f.short}: {formatCLP(byFund[f.key] || 0)}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Dashboard() {
  const { dark } = useTheme();
  const [summary, setSummary] = useState(null);
  const [chart, setChart]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/chart/monthly'),
    ]).then(([s, c]) => {
      setSummary(s.data);
      setChart(c.data);
    }).catch((err) => {
      toast.error(err?.response?.data?.message || 'No se pudo cargar el dashboard.');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-white/40">Cargando dashboard...</div>;
  if (!summary) return null;

  const { students, income, expenses, balance, discounts = {}, funds = [], fines = {} } = summary;

  const saldoPorFondo = funds
    .map((f) => ({ name: fundByKey(f.key).label, value: f.balance, color: fundByKey(f.key).color }))
    .filter((d) => d.value > 0);

  const tick = { fill: dark ? 'rgba(255,255,255,0.45)' : '#6B7280', fontSize: 11 };
  const grid = dark ? 'rgba(255,255,255,0.06)' : '#E5E7EB';

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Resumen principal: dinero total + alumnos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="glass p-4 sm:p-5 lg:col-span-2 bg-gradient-to-br from-purple-900/20 to-cyan-900/20 min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-slate-300">
            <Wallet size={16} /> Dinero total del curso
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-gray-800 dark:text-white mt-1">
            <Money value={balance.total} />
          </div>
          <div className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Suma de los tres fondos, después de gastos y descuentos.
          </div>
          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {funds.map((f) => {
              const cfg = fundByKey(f.key);
              return (
                <li key={f.key} className="flex items-center justify-between sm:block gap-2 rounded-xl bg-white/5 px-3 py-2 min-w-0">
                  <span className="text-xs text-gray-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} aria-hidden="true" />
                    {cfg.label}
                  </span>
                  <span className={`block text-sm sm:text-base font-bold tabular-nums ${f.balance < 0 ? 'text-kinder-coral' : cfg.text}`}>
                    {formatCLP(f.balance)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="grid grid-cols-3 lg:grid-cols-1 gap-3">
          {[
            { label: 'Al día',     sub: 'Mes actual', value: students.upToDate, icon: UserCheck, cls: 'bg-green-100 text-kinder-green dark:bg-green-900/40' },
            { label: 'Con deuda',  sub: 'Mes actual', value: students.debt,     icon: UserX,     cls: 'bg-yellow-100 text-yellow-500 dark:bg-yellow-900/40' },
            { label: 'Activos',    sub: 'Alumnos',    value: students.active,   icon: Users,     cls: 'bg-blue-100 text-kinder-blue dark:bg-blue-900/40' },
          ].map(({ label, sub, value, icon: Icon, cls }) => (
            <div key={label} className="glass p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cls}`}><Icon size={18} /></div>
              <div className="min-w-0">
                <div className="text-xl sm:text-2xl font-extrabold text-gray-800 dark:text-white tabular-nums">{value}</div>
                <div className="text-[11px] sm:text-xs text-gray-500 dark:text-slate-400 leading-tight">
                  <span className="font-medium">{label}</span>
                  <span className="block lg:inline lg:before:content-['_·_']">{sub}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Un bloque por fondo */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">Fondos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {funds.map((f) => <FundCard key={f.key} fund={f} />)}
        </div>
      </div>

      {/* Descuentos, gastos y multas, todos juntos y con su desglose por fondo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <BreakdownCard
          title="Descuentos" note="Todos los fondos juntos" to="/discounts"
          icon={Tag} iconClass="bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
          total={discounts.total ?? 0}
          byFund={{ cuotas: discounts.cuotas, actividades: discounts.actividades, caja_chica: discounts.pettyCash }}
        />
        <BreakdownCard
          title="Gastos" note="Todos los fondos juntos" to="/expenses"
          icon={TrendingDown} iconClass="bg-red-100 text-kinder-coral dark:bg-red-900/40"
          total={expenses.total ?? 0}
          byFund={{ cuotas: expenses.cuotas, actividades: expenses.actividades, caja_chica: expenses.pettyCash }}
        />
        <BreakdownCard
          title="Multas cobradas" note={`Por cobrar: ${formatCLP(fines.pending || 0)} (${fines.pendingCount || 0})`} to="/fines"
          icon={AlertTriangle} iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400"
          total={fines.paid || 0}
          byFund={fines.byFund || {}}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="glass p-4 sm:p-5 lg:col-span-2 min-w-0">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">Ingresos vs Gastos por mes</h2>
          <div className="h-52 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="kfIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6BCB77" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6BCB77" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="kfExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="income"  name="Ingresos" stroke="#6BCB77" fill="url(#kfIncome)"  strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Gastos"   stroke="#FF6B6B" fill="url(#kfExpense)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="glass p-4 sm:p-5 min-w-0">
          <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3">Saldo por fondo</h2>
          {saldoPorFondo.length > 0 ? (
            <div className="h-52 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={saldoPorFondo} cx="50%" cy="45%" innerRadius="50%" outerRadius="75%" paddingAngle={3} dataKey="value" stroke="none">
                    {saldoPorFondo.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCLP(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 sm:h-64 flex items-center justify-center text-white/30 text-sm text-center px-4">
              Ningún fondo tiene saldo positivo todavía.
            </div>
          )}
        </section>
      </div>

      {/* Tabla resumen: la misma información en formato accesible */}
      <section className="glass p-4 sm:p-5 min-w-0">
        <h2 className="text-sm font-semibold text-gray-600 dark:text-slate-300 mb-3 flex items-center gap-2">
          <PiggyBank size={16} /> Resumen por fondo
        </h2>
        {/* En pantallas angostas la tabla se apila por fondo; desde sm es una tabla normal. */}
        <ul className="sm:hidden divide-y divide-gray-50 dark:divide-kinder-border">
          {funds.map((f) => {
            const cfg = fundByKey(f.key);
            return (
              <li key={f.key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-sm font-semibold text-gray-700 dark:text-slate-200 flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} aria-hidden="true" />{cfg.label}
                  </span>
                  <span className={`text-sm font-bold tabular-nums ${f.balance < 0 ? 'text-kinder-coral' : 'text-gray-800 dark:text-white'}`}>{formatCLP(f.balance)}</span>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  {[['Reunido', f.income], ['Gastos', f.expenses], ['Descuentos', f.discounts]].map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-white/5 px-2 py-1.5 min-w-0">
                      <dt className="text-gray-400 dark:text-slate-500">{k}</dt>
                      <dd className="tabular-nums font-medium text-gray-700 dark:text-slate-200 break-words">{formatCLP(v)}</dd>
                    </div>
                  ))}
                </dl>
                {f.initialBalance > 0 && <div className="text-[11px] text-gray-400 dark:text-slate-500 mt-1">Incluye saldo inicial de {formatCLP(f.initialBalance)}</div>}
              </li>
            );
          })}
          <li className="pt-3 flex items-center justify-between text-sm font-semibold text-gray-800 dark:text-white">
            <span>Total</span><span className="tabular-nums">{formatCLP(balance.total)}</span>
          </li>
        </ul>
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 border-b border-gray-100 dark:border-kinder-border">
                <th className="py-2 pr-3 font-semibold">Fondo</th>
                <th className="py-2 px-3 font-semibold text-right">Reunido</th>
                <th className="py-2 px-3 font-semibold text-right">Gastos</th>
                <th className="py-2 px-3 font-semibold text-right">Descuentos</th>
                <th className="py-2 pl-3 font-semibold text-right">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-kinder-border">
              {funds.map((f) => {
                const cfg = fundByKey(f.key);
                return (
                  <tr key={f.key}>
                    <td className="py-2.5 pr-3 text-gray-700 dark:text-slate-200 whitespace-nowrap">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: cfg.color }} aria-hidden="true" />
                      {cfg.label}
                      {f.initialBalance > 0 && <span className="text-xs text-gray-400 dark:text-slate-500"> (incluye saldo inicial {formatCLP(f.initialBalance)})</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-slate-200">{formatCLP(f.income)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-slate-200">{formatCLP(f.expenses)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700 dark:text-slate-200">{formatCLP(f.discounts)}</td>
                    <td className={`py-2.5 pl-3 text-right tabular-nums font-bold ${f.balance < 0 ? 'text-kinder-coral' : 'text-gray-800 dark:text-white'}`}>{formatCLP(f.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-100 dark:border-kinder-border font-semibold text-gray-800 dark:text-white">
                <td className="py-2.5 pr-3">Total</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatCLP(income.total + (income.pettyCash || 0))}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatCLP(expenses.total)}</td>
                <td className="py-2.5 px-3 text-right tabular-nums">{formatCLP(discounts.total)}</td>
                <td className="py-2.5 pl-3 text-right tabular-nums">{formatCLP(balance.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
