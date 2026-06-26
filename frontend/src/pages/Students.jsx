import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import { Plus, Pencil, Trash2, Eye, Search } from 'lucide-react';

const INITIAL = { name: '', status: 'active' };

export default function Students() {
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('');
  const [modal,     setModal]     = useState(null);
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(INITIAL);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting,  setDeleting]  = useState(false);
  const [detail,    setDetail]    = useState(null);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/students' + (filter ? `?status=${filter}` : ''));
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const openCreate = () => { setForm(INITIAL); setModal('create'); };
  const openEdit   = (s)  => { setSelected(s); setForm({ name: s.name, status: s.status }); setModal('edit'); };
  const openView   = async (s) => {
    const { data } = await api.get(`/students/${s._id}`);
    setDetail(data);
    setModal('view');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es requerido.'); return; }
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/students', form);
        toast.success('Alumno agregado.');
      } else {
        await api.put(`/students/${selected._id}`, form);
        toast.success('Alumno actualizado.');
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
      await api.delete(`/students/${confirmId}`);
      toast.success('Alumno eliminado.');
      setConfirmId(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { key: 'name', label: 'Nombre del Alumno' },
    { key: 'status', label: 'Estado', render: (v) => (
      <span className={v === 'active' ? 'badge-paid' : 'badge-cancelled'}>
        {v === 'active' ? 'Activo' : 'Inactivo'}
      </span>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => openView(row)} className="p-1.5 text-cyan-400 hover:bg-cyan-400/10 rounded-lg"><Eye size={15} /></button>
        <button onClick={() => openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg"><Pencil size={15} /></button>
        <button onClick={() => setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={15} /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            placeholder="Buscar alumno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="select-field w-auto">
          <option value="">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Agregar Alumno
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: students.length, color: 'text-purple-400' },
          { label: 'Activos', value: students.filter(s => s.status === 'active').length, color: 'text-green-400' },
          { label: 'Inactivos', value: students.filter(s => s.status === 'inactive').length, color: 'text-rose-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass p-3 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-white/50">{label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : (
        <Table columns={columns} data={filtered} emptyMessage="No se encontraron alumnos." />
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Agregar Alumno' : 'Editar Alumno'}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Nombre del Alumno *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="Juan Pérez"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Estado</label>
            <div className="flex gap-3">
              {[
                { value: 'active',   label: '✅ Activo' },
                { value: 'inactive', label: '❌ Inactivo' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, status: opt.value })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200
                    ${form.status === opt.value
                      ? opt.value === 'active'
                        ? 'bg-green-500/20 border-green-500/60 text-green-300'
                        : 'bg-rose-500/20 border-rose-500/60 text-rose-300'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModal(null)} className="flex-1 btn-ghost border border-white/20">
              Cancelar
            </button>
            <button type="submit" className="flex-1 btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Modal */}
      <Modal open={modal === 'view'} onClose={() => setModal(null)} title="Detalle del Alumno" size="sm">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-2xl font-bold">
                {detail.student.name[0].toUpperCase()}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">{detail.student.name}</div>
                <span className={detail.student.status === 'active' ? 'badge-paid' : 'badge-cancelled'}>
                  {detail.student.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-xs text-white/60 mb-2 font-medium">Historial de Pagos ({detail.payments.length})</div>
              {detail.payments.length === 0 ? (
                <p className="text-sm text-white/30">Sin pagos registrados.</p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {detail.payments.map((p) => (
                    <div key={p._id} className="flex justify-between items-center bg-white/5 rounded-xl px-3 py-2 text-sm">
                      <span className="text-white/70">{p.description || p.type}</span>
                      <span className="text-green-400 font-medium">${p.amount.toLocaleString('es-CL')}</span>
                      <span className={p.status === 'paid' ? 'badge-paid' : p.status === 'pending' ? 'badge-pending' : 'badge-cancelled'}>
                        {p.status === 'paid' ? 'Pagado' : p.status === 'pending' ? 'Pendiente' : 'Anulado'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message="¿Eliminar este alumno? Se perderá todo su historial de pagos."
      />
    </div>
  );
}
