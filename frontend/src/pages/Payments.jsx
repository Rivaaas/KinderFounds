import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import { formatCLP, formatDate, formatMonth, currentMonth, PAYMENT_TYPE_LABELS, STATUS_LABELS } from '../utils/formatters';
import { Plus, Trash2, Pencil, CalendarClock, RefreshCw } from 'lucide-react';

const INITIAL = { type: 'cuota_mensual', amount: '', date: new Date().toISOString().slice(0,10), student: '', description: '', status: 'pending', month: currentMonth() };

export default function Payments() {
  const [payments,  setPayments]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(INITIAL);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [genModal, setGenModal]   = useState(false);
  const [genForm,  setGenForm]    = useState({ month: currentMonth(), amount: '', description: '' });
  const [genLoading, setGenLoading] = useState(false);
  const [monthSummary, setMonthSummary] = useState(null);

  const buildQuery = () => {
    const q = new URLSearchParams();
    if (filterMonth)  q.set('month', filterMonth);
    if (filterStatus) q.set('status', filterStatus);
    if (filterType)   q.set('type', filterType);
    return q.toString();
  };

  const load = async () => {
    setLoading(true);
    const q = buildQuery();
    const { data } = await api.get(`/payments${q ? '?' + q : ''}`);
    setPayments(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterMonth, filterStatus, filterType]);
  useEffect(() => { api.get('/students?status=active').then(r => setStudents(r.data)); }, []);

  useEffect(() => {
    if (filterMonth) {
      api.get(`/payments/month-summary/${filterMonth}`).then(r => setMonthSummary(r.data)).catch(() => setMonthSummary(null));
    } else {
      setMonthSummary(null);
    }
  }, [filterMonth]);

  const openCreate = () => { setForm(INITIAL); setModal('create'); };
  const openEdit   = (p)  => { setSelected(p); setForm({ ...p, student: p.student?._id || '', date: p.date?.slice(0,10) }); setModal('edit'); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.type || !form.amount) { toast.error('Tipo y monto son requeridos.'); return; }
    if (Number(form.amount) < 0) { toast.error('El monto no puede ser negativo.'); return; }
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/payments', form);
        toast.success('Pago registrado.');
      } else {
        await api.put(`/payments/${selected._id}`, form);
        toast.success('Pago actualizado.');
      }
      setModal(null);
      load();
      if (filterMonth) {
        const r = await api.get(`/payments/month-summary/${filterMonth}`);
        setMonthSummary(r.data);
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/payments/${confirmId}`);
      toast.success('Pago eliminado.');
      setConfirmId(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error.');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genForm.month || !genForm.amount) { toast.error('Mes y monto requeridos.'); return; }
    setGenLoading(true);
    try {
      const { data } = await api.post('/payments/generate-monthly', genForm);
      toast.success(data.message);
      setGenModal(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error.');
    } finally {
      setGenLoading(false);
    }
  };

  const quickPay = async (id) => {
    try {
      await api.put(`/payments/${id}`, { status: 'paid', date: new Date().toISOString().slice(0,10) });
      toast.success('Marcado como pagado.');
      load();
      if (filterMonth) {
        const r = await api.get(`/payments/month-summary/${filterMonth}`);
        setMonthSummary(r.data);
      }
    } catch { toast.error('Error al actualizar.'); }
  };

  const columns = [
    { key: 'student', label: 'Estudiante', render: (v) => v?.name || '—' },
    { key: 'type', label: 'Tipo', render: (v) => PAYMENT_TYPE_LABELS[v] || v },
    { key: 'month', label: 'Mes', render: (v) => v ? formatMonth(v) : '—' },
    { key: 'amount', label: 'Monto', render: (v) => formatCLP(v) },
    { key: 'date', label: 'Fecha', render: (v) => formatDate(v) },
    { key: 'status', label: 'Estado', render: (v) => (
      <span className={v==='paid'?'badge-paid':v==='pending'?'badge-pending':'badge-cancelled'}>
        {STATUS_LABELS[v]}
      </span>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1">
        {row.status === 'pending' && (
          <button onClick={() => quickPay(row._id)} className="px-2 py-1 text-xs text-green-400 hover:bg-green-400/10 rounded-lg border border-green-400/30">✓ Pagar</button>
        )}
        <button onClick={() => openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg"><Pencil size={14} /></button>
        <button onClick={() => setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={14} /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <input type="month" value={filterMonth} onChange={(e)=>setFilterMonth(e.target.value)} className="input-field w-auto" />
        <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="select-field w-auto">
          <option value="">Todos los estados</option>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
          <option value="cancelled">Anulado</option>
        </select>
        <select value={filterType} onChange={(e)=>setFilterType(e.target.value)} className="select-field w-auto">
          <option value="">Todos los tipos</option>
          {Object.entries(PAYMENT_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setGenModal(true)} className="btn-ghost border border-white/20 flex items-center gap-2">
          <RefreshCw size={15} /> Generar Cuotas
        </button>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 ml-auto">
          <Plus size={16} /> Nuevo Pago
        </button>
      </div>

      {/* Month summary */}
      {monthSummary && (
        <div className="glass p-5 bg-gradient-to-r from-purple-900/20 to-cyan-900/20">
          <h3 className="text-sm font-semibold text-white/70 mb-3">
            Resumen {formatMonth(monthSummary.month)}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Esperado', value: formatCLP(monthSummary.totalExpected), color: 'text-white' },
              { label: 'Total Pagado',   value: formatCLP(monthSummary.totalPaid),     color: 'text-green-400' },
              { label: 'Total Pendiente',value: formatCLP(monthSummary.totalPending),  color: 'text-yellow-400' },
              { label: 'Pagados/Total',  value: `${monthSummary.paid.length}/${monthSummary.paid.length + monthSummary.pending.length}`, color: 'text-cyan-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-xs text-white/40 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : (
        <Table columns={columns} data={payments} emptyMessage="No hay pagos con esos filtros." />
      )}

      {/* Create / Edit modal */}
      <Modal open={modal==='create'||modal==='edit'} onClose={()=>setModal(null)}
        title={modal==='create'?'Nuevo Pago':'Editar Pago'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Tipo *</label>
              <select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})} className="select-field">
                {Object.entries(PAYMENT_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Monto (CLP) *</label>
              <input type="number" min="0" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} className="input-field" placeholder="5000" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Fecha</label>
              <input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Estado</label>
              <select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} className="select-field">
                <option value="pending">Pendiente</option>
                <option value="paid">Pagado</option>
                <option value="cancelled">Anulado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Estudiante</label>
              <select value={form.student} onChange={(e)=>setForm({...form,student:e.target.value})} className="select-field">
                <option value="">Sin asociar</option>
                {students.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            {form.type === 'cuota_mensual' && (
              <div>
                <label className="block text-xs text-white/60 mb-1">Mes</label>
                <input type="month" value={form.month} onChange={(e)=>setForm({...form,month:e.target.value})} className="input-field" />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Descripción</label>
            <input value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="input-field" placeholder="Descripción opcional" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={()=>setModal(null)} className="flex-1 btn-ghost border border-white/20">Cancelar</button>
            <button type="submit" className="flex-1 btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {/* Generate monthly fees modal */}
      <Modal open={genModal} onClose={()=>setGenModal(false)} title="Generar Cuotas Mensuales" size="sm">
        <form onSubmit={handleGenerate} className="space-y-4">
          <p className="text-sm text-white/60">Se crearán cuotas pendientes para todos los estudiantes activos del mes seleccionado.</p>
          <div>
            <label className="block text-xs text-white/60 mb-1">Mes *</label>
            <input type="month" value={genForm.month} onChange={(e)=>setGenForm({...genForm,month:e.target.value})} className="input-field" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Monto por estudiante (CLP) *</label>
            <input type="number" min="1" value={genForm.amount} onChange={(e)=>setGenForm({...genForm,amount:e.target.value})} className="input-field" placeholder="5000" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Descripción</label>
            <input value={genForm.description} onChange={(e)=>setGenForm({...genForm,description:e.target.value})} className="input-field" placeholder="Cuota mensual..." />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={()=>setGenModal(false)} className="flex-1 btn-ghost border border-white/20">Cancelar</button>
            <button type="submit" className="flex-1 btn-primary" disabled={genLoading}>{genLoading?'Generando...':'Generar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmId} onClose={()=>setConfirmId(null)} onConfirm={handleDelete} loading={deleting} message="¿Eliminar este pago?" />
    </div>
  );
}
