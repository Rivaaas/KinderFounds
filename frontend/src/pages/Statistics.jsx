import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import api from '../services/api';
import { formatCLP } from '../utils/formatters';

const COLORS = ['#a855f7', '#06b6d4', '#22c55e', '#eab308', '#ec4899', '#f97316', '#6366f1'];

const TooltipMoney = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-3 text-sm">
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map(p => <p key={p.name} style={{ color: p.color }}>{p.name}: {formatCLP(p.value)}</p>)}
    </div>
  );
};

export default function Statistics() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [chart, setChart] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/dashboard/chart/monthly?year=${year}`),
      api.get('/dashboard/summary'),
      api.get('/expenses'),
      api.get('/payments?status=paid'),
    ]).then(([c, s, e, p]) => {
      setChart(c.data);
      setSummary(s.data);
      setExpenses(e.data);
      setPayments(p.data);
    }).finally(() => setLoading(false));
  }, [year]);

  // Gastos por categoría
  const expenseByCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});
  const expensePieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));

  // Pagos por tipo
  const paymentByType = payments.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] || 0) + p.amount;
    return acc;
  }, {});
  const paymentPieData = Object.entries(paymentByType).map(([name, value]) => ({ name, value }));

  // Pagados vs pendientes mes a mes
  const paidVsPending = chart.map((m, i) => ({
    month: m.month,
    Ingresos: m.income,
    Gastos: m.expense,
  }));

  if (loading) return <div className="text-center py-16 text-white/40">Cargando estadísticas...</div>;

  return (
    <div className="space-y-6">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/60">Año:</span>
        {[new Date().getFullYear()-1, new Date().getFullYear()].map(y => (
          <button key={y} onClick={()=>setYear(y)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${year===y?'btn-primary':'btn-ghost border border-white/20'}`}>
            {y}
          </button>
        ))}
      </div>

      {/* Summary row */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Ingresos', value: formatCLP(summary.income.total), color: 'text-green-400' },
            { label: 'Total Gastos',   value: formatCLP(summary.expenses.general), color: 'text-rose-400' },
            { label: 'Saldo General',  value: formatCLP(summary.balance.general),  color: 'text-purple-400' },
            { label: 'Caja Chica',     value: formatCLP(summary.balance.pettyCash), color: 'text-pink-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass p-4 text-center">
              <div className={`text-xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-white/40 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Monthly bar chart */}
      <div className="glass p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-4">Ingresos vs Gastos mensuales {year}</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={paidVsPending} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<TooltipMoney />} />
            <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
            <Bar dataKey="Ingresos" fill="#a855f7" radius={[4,4,0,0]} />
            <Bar dataKey="Gastos"   fill="#f43f5e" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two pie charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Gastos por Categoría</h2>
          {expensePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={expensePieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {expensePieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v=>formatCLP(v)} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-white/30 py-16 text-sm">Sin gastos registrados.</p>}
        </div>

        <div className="glass p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Ingresos por Tipo</h2>
          {paymentPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={paymentPieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${(percent*100).toFixed(0)}%`} labelLine={false}>
                  {paymentPieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v=>formatCLP(v)} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-white/30 py-16 text-sm">Sin pagos registrados.</p>}
        </div>
      </div>

      {/* Trend line */}
      <div className="glass p-5">
        <h2 className="text-sm font-semibold text-white/70 mb-4">Tendencia de Ingresos {year}</h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<TooltipMoney />} />
            <Line type="monotone" dataKey="income" name="Ingresos" stroke="#06b6d4" strokeWidth={2} dot={{ fill: '#06b6d4', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
