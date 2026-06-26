import { useEffect, useState } from 'react';
import api from '../services/api';
import { formatCLP, formatDate, formatMonth, PAYMENT_TYPE_LABELS, EXPENSE_CATEGORY_LABELS } from '../utils/formatters';
import Table from '../components/UI/Table';
import { FileText, Download } from 'lucide-react';

const tabs = [
  { id: 'general',   label: 'General' },
  { id: 'month',     label: 'Por Mes' },
  { id: 'student',   label: 'Por Estudiante' },
  { id: 'pettycash', label: 'Caja Chica' },
];

export default function Reports() {
  const [activeTab, setActiveTab] = useState('general');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);

  // Filters
  const [fromDate, setFromDate]   = useState('');
  const [toDate,   setToDate]     = useState('');
  const [month,    setMonth]      = useState('');
  const [students, setStudents]   = useState([]);
  const [studentId, setStudentId] = useState('');

  useEffect(() => {
    api.get('/students').then(r => setStudents(r.data));
  }, []);

  const loadReport = async () => {
    setLoading(true);
    setData(null);
    try {
      let res;
      if (activeTab === 'general') {
        const q = new URLSearchParams();
        if (fromDate) q.set('from', fromDate);
        if (toDate)   q.set('to', toDate);
        res = await api.get(`/reports/general?${q}`);
      } else if (activeTab === 'month') {
        if (!month) { setLoading(false); return; }
        res = await api.get(`/reports/month/${month}`);
      } else if (activeTab === 'student') {
        if (!studentId) { setLoading(false); return; }
        res = await api.get(`/reports/student/${studentId}`);
      } else if (activeTab === 'pettycash') {
        const q = new URLSearchParams();
        if (fromDate) q.set('from', fromDate);
        if (toDate)   q.set('to', toDate);
        res = await api.get(`/reports/petty-cash?${q}`);
      }
      setData(res?.data || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    let rows = [];
    if (activeTab === 'general') {
      rows = [
        ['Tipo','Descripción','Monto','Fecha','Estado','Estudiante'],
        ...(data.payments||[]).map(p => ['Ingreso', p.description||p.type, p.amount, formatDate(p.date), p.status, p.student?.name||'']),
        ...(data.expenses||[]).map(e => ['Gasto', e.description, -e.amount, formatDate(e.date), '', '']),
      ];
    } else if (activeTab === 'month') {
      rows = [
        ['Estudiante','Apoderado','Monto','Estado'],
        ...(data.payments||[]).map(p => [p.student?.name||'', p.student?.guardianName||'', p.amount, p.status]),
      ];
    } else if (activeTab === 'pettycash') {
      rows = [
        ['Tipo','Descripción','Categoría','Monto','Fecha'],
        ...(data.movements||[]).map(m => [m.type==='income'?'Ingreso':'Egreso', m.description, m.category||'', m.amount, formatDate(m.date)]),
      ];
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `reporte_${activeTab}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const paymentCols = [
    { key: 'student',     label: 'Estudiante', render: v => v?.name || '—' },
    { key: 'type',        label: 'Tipo',       render: v => PAYMENT_TYPE_LABELS[v] || v },
    { key: 'description', label: 'Descripción' },
    { key: 'amount',      label: 'Monto',      render: v => <span className="text-green-400">{formatCLP(v)}</span> },
    { key: 'date',        label: 'Fecha',      render: v => formatDate(v) },
    { key: 'status',      label: 'Estado',     render: v => <span className={v==='paid'?'badge-paid':v==='pending'?'badge-pending':'badge-cancelled'}>{v==='paid'?'Pagado':v==='pending'?'Pendiente':'Anulado'}</span> },
  ];

  const expenseCols = [
    { key: 'description', label: 'Descripción' },
    { key: 'category',    label: 'Categoría',  render: v => EXPENSE_CATEGORY_LABELS[v] || v },
    { key: 'amount',      label: 'Monto',      render: v => <span className="text-rose-400">{formatCLP(v)}</span> },
    { key: 'date',        label: 'Fecha',      render: v => formatDate(v) },
  ];

  const pettyCols = [
    { key: 'type',        label: 'Tipo',       render: v => <span className={v==='income'?'text-green-400':'text-rose-400'}>{v==='income'?'Ingreso':'Egreso'}</span> },
    { key: 'description', label: 'Descripción' },
    { key: 'amount',      label: 'Monto',      render: (v,r) => <span className={r.type==='income'?'text-green-400':'text-rose-400'}>{r.type==='income'?'+':'-'}{formatCLP(v)}</span> },
    { key: 'date',        label: 'Fecha',      render: v => formatDate(v) },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={()=>{ setActiveTab(t.id); setData(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab===t.id?'btn-primary':'btn-ghost border border-white/20'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="glass p-4 flex flex-wrap gap-3 items-end">
        {(activeTab==='general'||activeTab==='pettycash') && (
          <>
            <div>
              <label className="block text-xs text-white/50 mb-1">Desde</label>
              <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="input-field w-auto" />
            </div>
            <div>
              <label className="block text-xs text-white/50 mb-1">Hasta</label>
              <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="input-field w-auto" />
            </div>
          </>
        )}
        {activeTab==='month' && (
          <div>
            <label className="block text-xs text-white/50 mb-1">Mes</label>
            <input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="input-field w-auto" />
          </div>
        )}
        {activeTab==='student' && (
          <div>
            <label className="block text-xs text-white/50 mb-1">Estudiante</label>
            <select value={studentId} onChange={e=>setStudentId(e.target.value)} className="select-field w-auto">
              <option value="">Selecciona...</option>
              {students.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={loadReport} className="btn-primary flex items-center gap-2">
          <FileText size={15} /> Generar Reporte
        </button>
        {data && (
          <button onClick={exportCSV} className="btn-ghost border border-white/20 flex items-center gap-2">
            <Download size={15} /> Exportar CSV
          </button>
        )}
      </div>

      {/* Results */}
      {loading && <div className="text-center py-12 text-white/40">Generando reporte...</div>}

      {!loading && data && (
        <div className="space-y-5 animate-fadeIn">
          {/* Summary */}
          {(data.totalIncome !== undefined || data.totalPaid !== undefined) && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {data.totalIncome  !== undefined && <div className="glass p-4 text-center"><div className="text-lg font-bold text-green-400">{formatCLP(data.totalIncome)}</div><div className="text-xs text-white/40">Total Ingresos</div></div>}
              {data.totalExpense !== undefined && <div className="glass p-4 text-center"><div className="text-lg font-bold text-rose-400">{formatCLP(data.totalExpense)}</div><div className="text-xs text-white/40">Total Gastos/Egresos</div></div>}
              {data.balance      !== undefined && <div className="glass p-4 text-center"><div className={`text-lg font-bold ${data.balance>=0?'text-cyan-400':'text-yellow-400'}`}>{formatCLP(data.balance)}</div><div className="text-xs text-white/40">Saldo</div></div>}
              {data.totalPaid    !== undefined && <div className="glass p-4 text-center"><div className="text-lg font-bold text-green-400">{formatCLP(data.totalPaid)}</div><div className="text-xs text-white/40">Total Pagado</div></div>}
              {data.totalPending !== undefined && <div className="glass p-4 text-center"><div className="text-lg font-bold text-yellow-400">{formatCLP(data.totalPending)}</div><div className="text-xs text-white/40">Pendiente</div></div>}
            </div>
          )}

          {/* Student report */}
          {activeTab==='student' && data.student && (
            <div className="glass p-4">
              <div className="font-semibold text-white">{data.student.name}</div>
              <div className="text-sm text-white/50">Apoderado: {data.student.guardianName}</div>
            </div>
          )}

          {/* Tables */}
          {(data.payments||data.income) && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2">Ingresos / Pagos ({(data.payments||data.income||[]).length})</h3>
              <Table columns={paymentCols} data={data.payments||data.income||[]} emptyMessage="Sin registros." />
            </div>
          )}
          {data.expenses && activeTab!=='student' && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2">Gastos ({data.expenses.length})</h3>
              <Table columns={expenseCols} data={data.expenses} emptyMessage="Sin gastos." />
            </div>
          )}
          {data.movements && (
            <div>
              <h3 className="text-sm font-medium text-white/60 mb-2">Movimientos de Caja Chica ({data.movements.length})</h3>
              <Table columns={pettyCols} data={data.movements} emptyMessage="Sin movimientos." />
            </div>
          )}
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-16 text-white/30">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecciona los filtros y genera el reporte.</p>
        </div>
      )}
    </div>
  );
}
