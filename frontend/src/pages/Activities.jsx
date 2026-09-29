import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { formatCLP, formatDate, ACTIVITY_TYPE_LABELS, todayISO } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Pencil, Trash2, Zap, ArrowLeft, Check, Undo2, Eye, EyeOff,
  Users, Coins, Search, RotateCcw,
} from 'lucide-react';

// Actividades y Cuotas.
//
// Cada actividad (stand, paseo, regalo, rifa...) puede tener una cuota por alumno.
// Desde aquí se marca quién pagó y quién no; cada marca crea o actualiza un pago
// de tipo 'actividad' asociado al alumno, que se suma en su estado de cuenta y
// en la consulta pública del curso.

const STATUSES = { planned: 'Planificada', active: 'En curso', completed: 'Completada' };
const STATUS_BADGE = {
  planned:   'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  active:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  completed: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};
const PAGO_BADGE = {
  paid:      'badge-paid',
  pending:   'badge-pending',
  cancelled: 'badge-cancelled',
};
const PAGO_LABEL = { paid: 'Pagado', pending: 'Pendiente', cancelled: 'Anulado' };

const INITIAL = {
  name: '', type: 'otro', date: todayISO(), description: '', observations: '',
  status: 'active', students: [], amountPerStudent: '', publicVisible: true,
};

function Progreso({ pagados, total, color = 'bg-kinder-green' }) {
  const pct = total > 0 ? Math.round((pagados / total) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Activities() {
  const { canWrite } = useAuth();
  const [activities, setActivities] = useState([]);
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [form,       setForm]       = useState(INITIAL);
  const [saving,     setSaving]     = useState(false);
  const [confirmId,  setConfirmId]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);

  // Detalle abierto (nómina de participantes)
  const [detail,     setDetail]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filtro,     setFiltro]     = useState('');
  const [soloPend,   setSoloPend]   = useState(false);
  const [ocupado,    setOcupado]    = useState(null); // studentId con acción en curso
  const [ajuste,     setAjuste]     = useState(null); // fila en edición de monto/fecha

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/activities');
      setActivities(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id, silencioso = false) => {
    if (!silencioso) setDetailLoading(true);
    try {
      const { data } = await api.get(`/activities/${id}`);
      setDetail(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo cargar la actividad.');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { api.get('/students?status=active').then(r => setStudents(r.data)).catch(() => {}); }, []);

  // Al crear, todos los alumnos activos quedan marcados: lo habitual es que la
  // cuota sea para el curso completo y se desmarquen las excepciones.
  const openCreate = () => {
    setForm({ ...INITIAL, date: todayISO(), students: students.map(s => s._id) });
    setModal('create');
  };
  const openEdit = (a) => {
    setSelected(a);
    setForm({
      ...INITIAL, ...a,
      date: a.date?.slice(0, 10),
      students: a.students?.map(s => s._id || s) || [],
      amountPerStudent: a.amountPerStudent || '',
      publicVisible: a.publicVisible !== false,
    });
    setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.date) { toast.error('Nombre y fecha son requeridos.'); return; }
    const cuota = form.amountPerStudent === '' ? 0 : Number(form.amountPerStudent);
    if (Number.isNaN(cuota) || cuota < 0) { toast.error('La cuota por alumno no es válida.'); return; }
    setSaving(true);
    try {
      const payload = { ...form, amountPerStudent: cuota };
      if (modal === 'create') {
        await api.post('/activities', payload);
        toast.success('Actividad creada.');
      } else {
        await api.put(`/activities/${selected._id}`, payload);
        toast.success('Actividad actualizada.');
        if (detail?.activity?._id === selected._id) loadDetail(selected._id, true);
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/activities/${confirmId}`);
      toast.success('Actividad eliminada.');
      setConfirmId(null);
      if (detail?.activity?._id === confirmId) setDetail(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const toggleStudent = (id) => {
    setForm(f => ({
      ...f,
      students: f.students.includes(id) ? f.students.filter(s => s !== id) : [...f.students, id],
    }));
  };

  // --- Cuotas por alumno -------------------------------------------------
  const marcar = async (fila, status, extra = {}) => {
    const actId = detail.activity._id;
    setOcupado(fila.student._id);
    try {
      await api.put(`/activities/${actId}/students/${fila.student._id}/payment`, { status, ...extra });
      toast.success(status === 'paid' ? `${fila.student.name}: pagado.` : `${fila.student.name}: ${PAGO_LABEL[status].toLowerCase()}.`);
      await loadDetail(actId, true);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo registrar.');
    } finally {
      setOcupado(null);
    }
  };

  const quitarRegistro = async (fila) => {
    const actId = detail.activity._id;
    setOcupado(fila.student._id);
    try {
      await api.delete(`/activities/${actId}/students/${fila.student._id}/payment`);
      toast.success('Registro eliminado.');
      await loadDetail(actId, true);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo eliminar.');
    } finally {
      setOcupado(null);
    }
  };

  const guardarAjuste = async (e) => {
    e.preventDefault();
    const monto = Number(ajuste.amount);
    if (!monto || monto <= 0) { toast.error('Indica un monto mayor a 0.'); return; }
    await marcar(ajuste.fila, ajuste.status, { amount: monto, date: ajuste.date || undefined });
    setAjuste(null);
  };

  // --- Vista de detalle --------------------------------------------------
  if (detail || detailLoading) {
    const a = detail?.activity;
    const t = detail?.totals || { paidCount: 0, pendingCount: 0, collected: 0, expected: 0 };
    const roster = (detail?.roster || []).filter((f) =>
      (!soloPend || f.status === 'pending') &&
      (!filtro || f.student.name.toLowerCase().includes(filtro.toLowerCase()))
    );
    const sinCuota = !a?.amountPerStudent;

    return (
      <div className="space-y-5">
        <button onClick={() => { setDetail(null); setFiltro(''); setSoloPend(false); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-kinder-blue transition-colors">
          <ArrowLeft size={15} /> Volver a actividades
        </button>

        {detailLoading || !a ? (
          <div className="text-center py-12 text-gray-400 dark:text-slate-500">Cargando...</div>
        ) : (
          <>
            <div className="glass p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-extrabold text-gray-800 dark:text-white">{a.name}</h2>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[a.status]}`}>{STATUSES[a.status]}</span>
                    {a.publicVisible === false && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <EyeOff size={11} /> Oculta al público
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {ACTIVITY_TYPE_LABELS[a.type]} · {formatDate(a.date)}
                    {a.amountPerStudent > 0 && <> · Cuota <strong className="text-gray-700 dark:text-slate-200">{formatCLP(a.amountPerStudent)}</strong> por alumno</>}
                  </div>
                  {a.description && <p className="text-sm text-gray-600 dark:text-slate-300 mt-2">{a.description}</p>}
                </div>
                {canWrite && (
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(a)} className="btn-ghost border border-gray-200 dark:border-kinder-border flex items-center gap-1.5 text-sm">
                      <Pencil size={14} /> Editar
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {[
                  { label: 'Pagaron',   value: `${t.paidCount} de ${t.paidCount + t.pendingCount}`, color: 'text-kinder-green' },
                  { label: 'Pendientes', value: t.pendingCount, color: t.pendingCount > 0 ? 'text-kinder-coral' : 'text-kinder-green' },
                  { label: 'Recaudado', value: formatCLP(t.collected), color: 'text-kinder-blue' },
                  { label: 'Por recaudar', value: formatCLP(t.expected - t.collected), color: 'text-gray-700 dark:text-slate-200' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 text-center">
                    <div className={`text-lg font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4"><Progreso pagados={t.paidCount} total={t.paidCount + t.pendingCount} /></div>

              {(detail.totalExpense > 0) && (
                <p className="mt-3 text-xs text-gray-500 dark:text-slate-400">
                  Gastos asociados: {formatCLP(detail.totalExpense)} · Saldo de la actividad: <strong>{formatCLP(detail.balance)}</strong>
                </p>
              )}
            </div>

            {sinCuota && canWrite && (
              <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Esta actividad no tiene cuota por alumno. Edítala y define el monto para poder marcar pagos con un clic
                (o usa "Otro monto" en cada alumno).
              </div>
            )}

            {/* Nómina */}
            <div className="glass overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-kinder-border flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 mr-auto">
                  <Users size={16} className="text-kinder-lavender" /> Participantes ({detail.roster.length})
                </h3>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 cursor-pointer">
                  <input type="checkbox" checked={soloPend} onChange={(e) => setSoloPend(e.target.checked)} /> Solo pendientes
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar alumno"
                    className="input-field pl-8 py-1.5 text-sm w-44" />
                </div>
              </div>

              {roster.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400 dark:text-slate-500">
                  {detail.roster.length === 0 ? 'Sin participantes. Edita la actividad para agregarlos.' : 'Nadie coincide con el filtro.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-50 dark:divide-kinder-border">
                  {roster.map((f) => {
                    const busy = ocupado === f.student._id;
                    return (
                      <li key={f.student._id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${f.status === 'paid' ? 'bg-kinder-green' : f.status === 'pending' ? 'bg-kinder-coral' : 'bg-gray-300 dark:bg-slate-600'}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-gray-800 dark:text-white truncate">{f.student.name}</span>
                          <span className="block text-xs text-gray-400 dark:text-slate-500">
                            {formatCLP(f.amount)}{f.date ? ` · ${formatDate(f.date)}` : ''}
                          </span>
                        </span>
                        <span className={`${PAGO_BADGE[f.status]} shrink-0`}>{PAGO_LABEL[f.status]}</span>
                        {canWrite && (
                          <span className="flex items-center gap-1 shrink-0">
                            {f.status !== 'paid' && (
                              <button disabled={busy || sinCuota} onClick={() => marcar(f, 'paid')}
                                title={sinCuota ? 'Define la cuota de la actividad' : 'Marcar como pagado'}
                                className="px-2 py-1 text-xs font-semibold rounded-lg text-green-700 bg-green-50 hover:bg-green-100 border border-green-200
                                           dark:text-green-300 dark:bg-green-900/30 dark:border-green-800 disabled:opacity-40 flex items-center gap-1">
                                <Check size={13} /> Pagó
                              </button>
                            )}
                            {f.status === 'paid' && (
                              <button disabled={busy} onClick={() => marcar(f, 'pending')} title="Volver a pendiente"
                                className="px-2 py-1 text-xs rounded-lg text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 flex items-center gap-1">
                                <Undo2 size={13} /> Deshacer
                              </button>
                            )}
                            <button disabled={busy} title="Otro monto o fecha"
                              onClick={() => setAjuste({ fila: f, amount: f.amount || a.amountPerStudent || '', date: f.date ? f.date.slice(0, 10) : todayISO(), status: 'paid' })}
                              className="p-1.5 rounded-lg text-kinder-blue hover:bg-blue-50 dark:hover:bg-blue-900/30">
                              <Coins size={14} />
                            </button>
                            {f.paymentId && (
                              <button disabled={busy} title="Quitar registro" onClick={() => quitarRegistro(f)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-kinder-coral hover:bg-red-50 dark:hover:bg-red-900/20">
                                <RotateCcw size={14} />
                              </button>
                            )}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}

        {/* Ajuste de monto/fecha */}
        <Modal open={!!ajuste} onClose={() => setAjuste(null)} title={`Registrar pago · ${ajuste?.fila.student.name || ''}`} size="sm">
          {ajuste && (
            <form onSubmit={guardarAjuste} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Monto (CLP) *</label>
                <input type="number" min="1" value={ajuste.amount} onChange={(e) => setAjuste({ ...ajuste, amount: e.target.value })} className="input-field" autoFocus />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Fecha</label>
                <input type="date" value={ajuste.date} onChange={(e) => setAjuste({ ...ajuste, date: e.target.value })} className="input-field" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Estado</label>
                <select value={ajuste.status} onChange={(e) => setAjuste({ ...ajuste, status: e.target.value })} className="select-field">
                  <option value="paid">Pagado</option>
                  <option value="pending">Pendiente</option>
                  <option value="cancelled">Anulado (no se cobra)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAjuste(null)} className="flex-1 btn-ghost border border-gray-200 dark:border-kinder-border">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary" disabled={ocupado !== null}>Guardar</button>
              </div>
            </form>
          )}
        </Modal>

        {renderFormModal()}
        <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={handleDelete} loading={deleting} message="¿Eliminar esta actividad?" />
      </div>
    );
  }

  // --- Listado -----------------------------------------------------------
  function renderFormModal() {
    return (
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nueva actividad o cuota' : 'Editar actividad'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Nombre *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="Ej: Stand Kermesse, Regalo de Navidad, Paseo de fin de año" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Cuota por alumno (CLP)</label>
              <input type="number" min="0" value={form.amountPerStudent} onChange={(e) => setForm({ ...form, amountPerStudent: e.target.value })} className="input-field" placeholder="0 = sin cobro" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Tipo</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="select-field">
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Fecha *</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="select-field">
                {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">Descripción (la ven los apoderados)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-field resize-none" rows={2} />
          </div>
          <label className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={form.publicVisible} onChange={(e) => setForm({ ...form, publicVisible: e.target.checked })} />
            <span>
              <span className="font-medium flex items-center gap-1.5"><Eye size={14} /> Visible en la consulta pública</span>
              <span className="block text-xs text-gray-500 dark:text-slate-400">Los apoderados verán quiénes pagaron y quiénes no en "Actividades del curso".</span>
            </span>
          </label>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-600 dark:text-slate-400">Participantes ({form.students.length})</label>
              <span className="flex gap-2 text-xs">
                <button type="button" onClick={() => setForm({ ...form, students: students.map(s => s._id) })} className="text-kinder-blue hover:underline">Todos</button>
                <button type="button" onClick={() => setForm({ ...form, students: [] })} className="text-gray-400 hover:underline">Ninguno</button>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto">
              {students.map(s => {
                const on = form.students.includes(s._id);
                return (
                  <label key={s._id} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors text-sm border
                    ${on ? 'bg-purple-50 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700'}`}>
                    <input type="checkbox" className="hidden" checked={on} onChange={() => toggleStudent(s._id)} />
                    <span className={on ? 'text-purple-700 dark:text-purple-200' : 'text-gray-600 dark:text-slate-300'}>{s.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(null)} className="flex-1 btn-ghost border border-gray-200 dark:border-kinder-border">Cancelar</button>
            <button type="submit" className="flex-1 btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-500 dark:text-slate-400 mr-auto">
          Cuotas extra, actividades y planes del curso. Entra a una para marcar quién pagó.
        </p>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nueva actividad
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500">Cargando...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-500">
          <Zap size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay actividades registradas.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activities.map((a) => {
            const t = a.totals || { paidCount: 0, pendingCount: 0, collected: 0, expected: 0 };
            const total = t.paidCount + t.pendingCount;
            return (
              <div key={a._id} role="button" tabIndex={0}
                onClick={() => loadDetail(a._id)}
                onKeyDown={(e) => e.key === 'Enter' && loadDetail(a._id)}
                className="glass p-5 hover:border-kinder-blue/50 transition-all duration-200 cursor-pointer text-left">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 dark:text-white truncate">{a.name}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{ACTIVITY_TYPE_LABELS[a.type]} · {formatDate(a.date)}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_BADGE[a.status]}`}>{STATUSES[a.status]}</span>
                </div>

                {a.amountPerStudent > 0 ? (
                  <>
                    <div className="flex items-baseline justify-between text-sm mb-1.5">
                      <span className="text-gray-600 dark:text-slate-300"><strong className="text-gray-800 dark:text-white">{t.paidCount}</strong> de {total} pagaron</span>
                      <span className="text-kinder-green font-semibold">{formatCLP(t.collected)}</span>
                    </div>
                    <Progreso pagados={t.paidCount} total={total} />
                    <div className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                      Cuota {formatCLP(a.amountPerStudent)} · faltan {formatCLP(t.expected - t.collected)}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-gray-400 dark:text-slate-500">{a.students?.length || 0} participantes · sin cuota</div>
                )}

                <div className="flex items-center justify-between border-t border-gray-100 dark:border-kinder-border pt-3 mt-3">
                  <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
                    {a.publicVisible === false ? <><EyeOff size={12} /> Oculta al público</> : <><Eye size={12} /> Visible al público</>}
                  </span>
                  {canWrite && (
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openEdit(a)} className="p-1.5 text-kinder-lavender hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg" title="Editar"><Pencil size={14} /></button>
                      <button onClick={() => setConfirmId(a._id)} className="p-1.5 text-kinder-coral hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Eliminar"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderFormModal()}
      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={handleDelete} loading={deleting} message="¿Eliminar esta actividad?" />
    </div>
  );
}
