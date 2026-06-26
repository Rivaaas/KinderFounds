import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import api from '../services/api';
import { formatCLP } from '../utils/formatters';
import StatCard from '../components/UI/StatCard';
import { Users, TrendingUp, TrendingDown, Wallet, PiggyBank, UserCheck, UserX, GraduationCap, Tag } from 'lucide-react';

const COLORS = ['#a855f7', '#06b6d4', '#22c55e', '#eab308', '#ec4899', '#f97316'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-3 text-sm">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCLP(p.value)}</p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [summary, setSummary]   = useState(null);
  const [chart, setChart]       = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/chart/monthly'),
    ]).then(([s, c]) => {
      setSummary(s.data);
      setChart(c.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-white/40">Cargando dashboard...</div>;
  if (!summary) return null;

  const { students, income, expenses, balance, discounts = {} } = summary;

  const pieData = [
    { name: 'Cuotas', value: income.monthly },
    { name: 'Actividades', value: income.activities },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Saldo General" value={formatCLP(balance.general)} icon={Wallet} color="purple"
          sub="Ingresos - Gastos" />
        <StatCard label="Cuotas Recaudadas" value={formatCLP(income.monthly)} icon={TrendingUp} color="green" />
        <StatCard label="Actividades" value={formatCLP(income.activities)} icon={TrendingUp} color="cyan" />
        <StatCard label="Total Gastos" value={formatCLP(expenses.general)} icon={TrendingDown} color="rose" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Caja Chica" value={formatCLP(balance.pettyCash)} icon={PiggyBank} color="pink" />
        <StatCard label="Total Descuentos" value={formatCLP(discounts.total ?? 0)} icon={Tag} color="orange"
          sub="Aplicados al saldo" />
        <StatCard label="Al Día" value={students.upToDate} icon={UserCheck} color="green"
          sub="Mes actual" />
        <StatCard label="Con Deuda" value={students.debt} icon={UserX} color="yellow"
          sub="Mes actual" />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="glass p-5 md:col-span-2">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Ingresos vs Gastos por Mes</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income"  name="Ingresos" stroke="#a855f7" fill="url(#income)"  strokeWidth={2} />
              <Area type="monotone" dataKey="expense" name="Gastos"   stroke="#f43f5e" fill="url(#expense)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Distribución de Ingresos</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatCLP(v)} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-white/30 text-sm">Sin datos</div>
          )}
        </div>
      </div>

      {/* Quick summary */}
      <div className="glass p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-4">Resumen General</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
          {[
            { label: 'Total Ingresos',  value: formatCLP(income.total),          color: 'text-green-400' },
            { label: 'Total Gastos',    value: formatCLP(expenses.general),       color: 'text-rose-400' },
            { label: 'Total Descuentos',value: formatCLP(discounts.total ?? 0),   color: 'text-amber-400' },
            { label: 'Saldo General',   value: formatCLP(balance.general),        color: 'text-purple-400' },
            { label: 'Caja Chica',      value: formatCLP(balance.pettyCash),      color: 'text-pink-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/5 rounded-xl p-4">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-white/50 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
