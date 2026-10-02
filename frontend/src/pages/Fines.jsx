import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import FundPicker from '../components/UI/FundPicker';
import { formatCLP, formatDate, todayISO, FINE_REASON_LABELS } from '../utils/formatters';
import { FUNDS, fundByKey } from '../config/funds';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Undo2, Ban, RotateCcw } from 'lucide-react';

const ESTADOS = {
  pending:   { label: 'Pendiente', cls: 'badge-pending' },
  paid:      { label: 'Pagada',    cls: 'badge-paid' },
  cancelled: { label: 'Anulada',   cls: 'badge-cancelled' },
};

const INITIAL = { student: '', reason: 'inasistencia_actividad', description: '', amount: '', date: todayISO() };

export default function Fines() {
  const { canWrite } = useAuth();
  const [fines,     setFines]     = useState([]);
  const [totals,    setTotals]    = useState({ pending: 0, paid: 0, pendingCount: 0, paidCount: 0, byFund: {} });
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null);   // 'create' | 'edit' | 'pay'
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(INITIAL);
  const [payForm,   setPayForm]   = useState({ fund: 'caja_chica', date: todayISO() });
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [filterStatus,  setFilterStatus]  = useState('pending');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterReason,  setFilterReason]  = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterStatus)  q.set('status', filterStatus);
      if (filterStudent) q.set('student', filterStudent);
      if (filterReason)  q.set('reason', filterReason);
      const { data } = await api.get(`/fines${q.toString() ? '?' + q : ''}`);
      setFines(data.fines);
      setTotals(data.totals);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar las multas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus, filterStudent, filterReason]);
  // Para el selector del formulario se cargan todos los alumnos: una multa
  // puede corresponder a alguien que ya no está activo.
  useEffect(() => { api.get('/students').then((r) => setStudents(r.data)).catch(() => {}); }, []);

  const openCreate = () => { setForm({ ...INITIAL, date: todayISO() }); setModal('create'); };
  const openEdit   = (f) => {
    setSelected(f);
    setForm({ student: f.student?._id || '', reason: f.reason, description: f.description || '', amount: f.amount, date: f.date?.slice(0, 10) });
    setModal('edit');
  };
  const openPay = (f) => {
    setSelected(f);
    setPayForm({ fund: f.paidFund || 'caja_chica', date: f.paidAt ? f.paidAt.slice(0, 10) : todayISO() });
    setModal('pay');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.student) { toast.error('Selecciona un alumno.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Ingresa un monto válido.'); return; }
    if (form.reason === 'otro' && !form.description.trim()) { toast.error('Describe el motivo de la multa.'); return; }
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/fines', form);
        toast.success('Multa registrada.');
      } else {
        await api.put(`/fines/${selected._id}`, form);
        toast.success('Multa actualizada.');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/fines/${selected._id}/pay`, payForm);
      toast.success(`Multa cobrada: el dinero entró a ${fundByKey(payForm.fund).label}.`);
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al registrar el pago.');
    } finally {
      setSaving(false);
    }
  };

  const accion = async (f, ruta, body, ok) => {
    try {
      await api.put(`/fines/${f._id}${ruta}`, body);
      toast.success(ok);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/fines/${confirmId}`);
      toast.success('Multa eliminada.');
      setConfirmId(null);
      load();
    } catch { toast.error('Error.'); } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'student', label: 'Alumno', render: (v) => <span className="font-medium">{v?.name || '—'}</span> },
    { key: 'reason', label: 'Motivo', render: (v, row) => (
      <span className="block max-w-[260px] whitespace-normal">
        {FINE_REASON_LABELS[v] || v}
        {row.description && <span className="block text-xs text-white/50">{row.description}</span>}
      </span>
    )},
    { key: 'amount', label: 'Monto', render: (v) => <span className="font-semibold text-rose-400 tabular-nums">{formatCLP(v)}</span> },
    { key: 'date', label: 'Fecha', render: (v) => formatDate(v) },
    { key: 'status', label: 'Estado', render: (v, row) => {
      const e = ESTADOS[v] || ESTADOS.pending;
      const f = row.paidFund ? fundByKey(row.paidFund) : null;
      return (
        <span className="flex flex-col gap-1 items-start">
          <span className={e.cls}>{e.label}</span>
          {v === 'paid' && f && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${f.badge}`} title={row.paidAt ? `Pagada el ${formatDate(row.paidAt)}` : ''}>
              {f.emoji} → {f.label}
            </span>
          )}
        </span>
      );
    }},
    ...(canWrite ? [{ key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1 flex-wrap">
        {row.status === 'pending' && (
          <button onClick={() => openPay(row)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-300 dark:hover:bg-green-500/30" title="Marcar pagada">
            <CheckCircle2 size={13} /> Cobrar
          </button>
        )}
        {row.status === 'paid' && (
          <>
            <button onClick={() => openPay(row)} className="p-1.5 text-cyan-500 hover:bg-cyan-400/10 rounded-lg" title="Cambiar fondo o fecha de pago"><Pencil size={14} /></button>
            <button onClick={() => accion(row, '/unpay', undefined, 'Pago deshecho: la multa vuelve a pendiente.')} className="p-1.5 text-amber-500 hover:bg-amber-400/10 rounded-lg" title="Deshacer pago"><Undo2 size={14} /></button>
          </>
        )}
        {row.status === 'pending' && (
          <>
            <button onClick={() => openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg" title="Editar"><Pencil size={14} /></button>
            <button onClick={() => accion(row, '', { status: 'cancelled' }, 'Multa anulada.')} className="p-1.5 text-gray-400 hover:bg-gray-400/10 rounded-lg" title="Anular"><Ban size={14} /></button>
          </>
        )}
        {row.status === 'cancelled' && (
          <button onClick={() => accion(row, '', { status: 'pending' }, 'Multa reactivada.')} className="p-1.5 text-amber-500 hover:bg-amber-400/10 rounded-lg" title="Reactivar"><RotateCcw size={14} /></button>
        )}
        <button onClick={() => setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg" title="Eliminar"><Trash2 size={14} /></button>
      </div>
    )}] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass p-4 sm:p-5 bg-gradient-to-br from-rose-900/30 to-rose-800/10 min-w-0">
          <div className="text-xs text-white/50 mb-1">Por cobrar</div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 tabular-nums break-words">{formatCLP(totals.pending)}</div>
          <div className="text-[11px] text-white/40 mt-0.5">{totals.pendingCount} multa{totals.pendingCount === 1 ? '' : 's'} pendiente{totals.pendingCount === 1 ? '' : 's'}</div>
        </div>
        <div className="glass p-4 sm:p-5 bg-gradient-to-br from-green-600/30 to-green-800/10 min-w-0">
          <div className="text-xs text-white/50 mb-1">Cobrado</div>
          <div className="text-xl sm:text-2xl font-bold text-green-400 tabular-nums break-words">{formatCLP(totals.paid)}</div>
          <div className="text-[11px] text-white/40 mt-0.5">{totals.paidCount} pagada{totals.paidCount === 1 ? '' : 's'}</div>
        </div>
        <div className="glass p-4 sm:p-5 min-w-0 col-span-2">
          <div className="text-xs text-white/50 mb-2">A qué fondo entró lo cobrado</div>
          <ul className="flex flex-wrap gap-2">
            {FUNDS.map((f) => (
              <li key={f.key} className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums ${f.badge}`}>
                {f.emoji} {f.short}: {formatCLP(totals.byFund?.[f.key] || 0)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Info */}
      <div className="glass p-4 bg-amber-500/5 border border-amber-500/20 text-sm text-amber-300/80 flex gap-2 items-start">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
        <span>Una multa pendiente aparece en el estado de cuenta del apoderado (con monto y motivo) pero no suma a ningún fondo. Al <strong>cobrarla</strong> eliges a qué fondo entra el dinero.</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select-field w-full sm:w-auto">
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="paid">Pagadas</option>
          <option value="cancelled">Anuladas</option>
        </select>
        <select value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)} className="select-field w-full sm:w-auto sm:max-w-[240px]">
          <option value="">Todos los alumnos</option>
          {students.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
        </select>
        <select value={filterReason} onChange={(e) => setFilterReason(e.target.value)} className="select-field w-full sm:w-auto">
          <option value="">Todos los motivos</option>
          {Object.entries(FINE_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto sm:ml-auto">
            <Plus size={16} /> Nueva Multa
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : (
        <Table columns={columns} data={fines} emptyMessage="No hay multas con ese filtro." />
      )}

      {/* Crear / editar */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'create' ? 'Nueva Multa' : 'Editar Multa'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Alumno *</label>
            <select value={form.student} onChange={(e) => setForm({ ...form, student: e.target.value })} className="select-field" autoFocus>
              <option value="">Selecciona un alumno...</option>
              {students.map((s) => <option key={s._id} value={s._id}>{s.name}{s.status !== 'active' ? ' (inactivo)' : ''}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Motivo *</label>
              <select value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="select-field">
                {Object.entries(FINE_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Monto (CLP) *</label>
              <input type="number" min="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field text-lg font-semibold" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Fecha</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Descripción {form.reason === 'otro' ? '*' : '(opcional)'}</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Ej: No asistió al stand del 18 de septiembre" />
            <p className="mt-1 text-[11px] text-white/40">El apoderado verá el motivo y esta descripción en su estado de cuenta.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModal(null)} className="flex-1 btn-ghost border border-white/20">Cancelar</button>
            <button type="submit" className="flex-1 btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {/* Cobrar: elegir fondo destino */}
      <Modal open={modal === 'pay'} onClose={() => setModal(null)} title={selected?.status === 'paid' ? 'Cambiar fondo del pago' : 'Cobrar multa'}>
        {selected && (
          <form onSubmit={handlePay} className="space-y-4">
            <div className="rounded-xl bg-white/5 px-4 py-3 text-sm">
              <div className="font-semibold text-white">{selected.student?.name}</div>
              <div className="text-white/60">{FINE_REASON_LABELS[selected.reason] || selected.reason}{selected.description ? ` · ${selected.description}` : ''}</div>
              <div className="text-lg font-bold text-rose-400 tabular-nums mt-1">{formatCLP(selected.amount)}</div>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Fecha de pago</label>
              <input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} className="input-field" />
            </div>
            <FundPicker value={payForm.fund} onChange={(fund) => setPayForm({ ...payForm, fund })} label="El dinero entra a *" />
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModal(null)} className="flex-1 btn-ghost border border-white/20">Cancelar</button>
              <button type="submit" className="flex-1 btn-primary flex items-center justify-center gap-2" disabled={saving}>
                <CheckCircle2 size={16} /> {saving ? 'Guardando...' : 'Confirmar pago'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={handleDelete} loading={deleting}
        message="¿Eliminar esta multa? Si estaba pagada, el monto saldrá del fondo al que había entrado."
      />
    </div>
  );
}
