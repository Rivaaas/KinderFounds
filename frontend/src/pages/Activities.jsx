import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import { formatCLP, formatDate, ACTIVITY_TYPE_LABELS } from '../utils/formatters';
import { Plus, Pencil, Trash2, Eye, Zap } from 'lucide-react';

const STATUSES = { planned: 'Planificada', active: 'En Curso', completed: 'Completada' };
const INITIAL = { name: '', type: 'otro', date: new Date().toISOString().slice(0,10), description: '', observations: '', status: 'planned', students: [] };

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [form,       setForm]       = useState(INITIAL);
  const [saving,     setSaving]     = useState(false);
  const [confirmId,  setConfirmId]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [detail,     setDetail]     = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/activities');
    setActivities(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { api.get('/students?status=active').then(r => setStudents(r.data)); }, []);

  const openCreate = () => { setForm(INITIAL); setModal('create'); };
  const openEdit   = (a)  => { setSelected(a); setForm({ ...a, date: a.date?.slice(0,10), students: a.students?.map(s=>s._id||s) || [] }); setModal('edit'); };
  const openView   = async (a) => {
    const { data } = await api.get(`/activities/${a._id}`);
    setDetail(data);
    setModal('view');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.date) { toast.error('Nombre y fecha son requeridos.'); return; }
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/activities', form);
        toast.success('Actividad creada.');
      } else {
        await api.put(`/activities/${selected._id}`, form);
        toast.success('Actividad actualizada.');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error.');
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
      load();
    } catch { toast.error('Error.'); } finally { setDeleting(false); }
  };

  const toggleStudent = (id) => {
    setForm(f => ({
      ...f,
      students: f.students.includes(id) ? f.students.filter(s=>s!==id) : [...f.students, id]
    }));
  };

  const statusColors = { planned: 'badge-pending', active: 'badge-paid', completed: 'text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded-full text-xs font-semibold' };

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nueva Actividad
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <Zap size={40} className="mx-auto mb-3 opacity-30" />
          <p>No hay actividades registradas.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activities.map((a) => (
            <div key={a._id} className="glass p-5 hover:border-purple-500/40 transition-all duration-200">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-white">{a.name}</div>
                  <div className="text-xs text-white/40 mt-0.5">{ACTIVITY_TYPE_LABELS[a.type]} • {formatDate(a.date)}</div>
                </div>
                <span className={statusColors[a.status] || 'badge-pending'}>{STATUSES[a.status]}</span>
              </div>
              {a.description && <p className="text-sm text-white/50 mb-3 line-clamp-2">{a.description}</p>}
              <div className="flex items-center justify-between text-sm border-t border-white/10 pt-3">
                <span className="text-white/40">{a.students?.length || 0} participantes</span>
                <div className="flex gap-1">
                  <button onClick={()=>openView(a)} className="p-1.5 text-cyan-400 hover:bg-cyan-400/10 rounded-lg"><Eye size={14} /></button>
                  <button onClick={()=>openEdit(a)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={()=>setConfirmId(a._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal open={modal==='create'||modal==='edit'} onClose={()=>setModal(null)}
        title={modal==='create'?'Nueva Actividad':'Editar Actividad'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Nombre *</label>
              <input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="input-field" placeholder="Nombre de la actividad" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Tipo</label>
              <select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})} className="select-field">
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Fecha *</label>
              <input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Estado</label>
              <select value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})} className="select-field">
                {Object.entries(STATUSES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Descripción</label>
            <textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="input-field resize-none" rows={2} />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-2">Participantes</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {students.map(s=>(
                <label key={s._id} className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors text-sm
                  ${form.students.includes(s._id) ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}>
                  <input type="checkbox" className="hidden" checked={form.students.includes(s._id)} onChange={()=>toggleStudent(s._id)} />
                  <span className={form.students.includes(s._id)?'text-purple-300':'text-white/70'}>{s.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={()=>setModal(null)} className="flex-1 btn-ghost border border-white/20">Cancelar</button>
            <button type="submit" className="flex-1 btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal open={modal==='view'} onClose={()=>setModal(null)} title="Detalle de Actividad" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Recaudado', value: formatCLP(detail.totalIncome),  color: 'text-green-400' },
                { label: 'Total Gastado',   value: formatCLP(detail.totalExpense), color: 'text-rose-400' },
                { label: 'Saldo Final',     value: formatCLP(detail.balance),      color: detail.balance>=0?'text-cyan-400':'text-yellow-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/5 rounded-xl p-4 text-center">
                  <div className={`text-lg font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-white/40 mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="text-xs text-white/50 mb-2">Participantes ({detail.activity.students?.length || 0})</div>
              {detail.activity.students?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {detail.activity.students.map(s=>(
                    <span key={s._id} className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-300">{s.name}</span>
                  ))}
                </div>
              ) : <p className="text-sm text-white/30">Sin participantes.</p>}
            </div>
            {detail.activity.observations && (
              <div className="bg-white/5 rounded-xl p-3">
                <div className="text-xs text-white/40">Observaciones</div>
                <div className="text-sm text-white/80 mt-0.5">{detail.activity.observations}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmId} onClose={()=>setConfirmId(null)} onConfirm={handleDelete} loading={deleting} message="¿Eliminar esta actividad?" />
    </div>
  );
}
