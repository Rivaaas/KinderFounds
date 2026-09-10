import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/formatters';
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck, Eye } from 'lucide-react';

const INITIAL = { username: '', password: '', name: '', role: 'viewer' };

export default function Users() {
  const { user: current } = useAuth();
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // 'create' | 'edit' | 'password'
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(INITIAL);
  const [password,  setPassword]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al cargar usuarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate   = () => { setForm(INITIAL); setModal('create'); };
  const openEdit     = (u) => { setSelected(u); setForm({ ...INITIAL, name: u.name, role: u.role }); setModal('edit'); };
  const openPassword = (u) => { setSelected(u); setPassword(''); setModal('password'); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('El nombre es requerido.'); return; }
    if (modal === 'create') {
      if (!form.username.trim())    { toast.error('El usuario es requerido.'); return; }
      if (form.password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres.'); return; }
    }
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/users', form);
        toast.success('Perfil creado.');
      } else {
        await api.put(`/users/${selected._id}`, { name: form.name, role: form.role });
        toast.success('Perfil actualizado.');
      }
      setModal(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handlePassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres.'); return; }
    setSaving(true);
    try {
      const { data } = await api.put(`/users/${selected._id}/password`, { password });
      toast.success(data.message);
      setModal(null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u) => {
    try {
      await api.put(`/users/${u._id}`, { active: !u.active });
      toast.success(u.active ? 'Perfil desactivado.' : 'Perfil activado.');
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al cambiar el estado.');
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/users/${confirmId}`);
      toast.success('Perfil eliminado.');
      setConfirmId(null);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Error al eliminar.');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'username', label: 'Usuario', render: (v) => <span className="text-white/60">{v}</span> },
    { key: 'role', label: 'Permisos', render: (v) => (
      <span className={`flex items-center gap-1 text-xs font-semibold ${v === 'admin' ? 'text-purple-400' : 'text-cyan-400'}`}>
        {v === 'admin' ? <ShieldCheck size={12} /> : <Eye size={12} />}
        {v === 'admin' ? 'Administrador' : 'Solo lectura'}
      </span>
    )},
    { key: 'active', label: 'Estado', render: (v, row) => (
      <button
        onClick={() => toggleActive(row)}
        className={v ? 'badge-paid' : 'badge-cancelled'}
        title={v ? 'Desactivar acceso' : 'Activar acceso'}
      >
        {v ? 'Activo' : 'Desactivado'}
      </button>
    )},
    { key: 'createdAt', label: 'Creado', render: (v) => formatDate(v) },
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg" title="Editar"><Pencil size={14} /></button>
        <button onClick={() => openPassword(row)} className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded-lg" title="Cambiar contraseña"><KeyRound size={14} /></button>
        {row._id !== current?.id && (
          <button onClick={() => setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg" title="Eliminar"><Trash2 size={14} /></button>
        )}
      </div>
    )},
  ];

  const isCreate = modal === 'create';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-white/50">
          Los perfiles de <span className="text-cyan-400 font-medium">solo lectura</span> ven toda la información
          pero no pueden crear, editar ni eliminar nada.
        </p>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 ml-auto">
          <Plus size={16} /> Nuevo Perfil
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: users.length, color: 'text-white' },
          { label: 'Administradores', value: users.filter(u => u.role === 'admin').length, color: 'text-purple-400' },
          { label: 'Solo lectura', value: users.filter(u => u.role === 'viewer').length, color: 'text-cyan-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass p-3 text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-white/50">{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : (
        <Table columns={columns} data={users} emptyMessage="No hay perfiles registrados." />
      )}

      {/* Crear / Editar */}
      <Modal
        open={isCreate || modal === 'edit'}
        onClose={() => setModal(null)}
        title={isCreate ? 'Nuevo Perfil' : 'Editar Perfil'}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Nombre *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              placeholder="María González"
              autoFocus
            />
          </div>

          {isCreate && (
            <>
              <div>
                <label className="block text-xs text-white/60 mb-1">Usuario *</label>
                <input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input-field"
                  placeholder="maria"
                />
                <p className="text-xs text-white/30 mt-1">Con este nombre inicia sesión. Sin espacios ni mayúsculas.</p>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Contraseña *</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field"
                  placeholder="Mínimo 6 caracteres"
                />
                <p className="text-xs text-white/30 mt-1">Anótala antes de guardar: después solo se puede reemplazar, no consultar.</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs text-white/60 mb-1">Permisos</label>
            <div className="flex gap-3">
              {[
                { value: 'viewer', label: '👁️ Solo lectura', active: 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300' },
                { value: 'admin',  label: '🛡️ Administrador', active: 'bg-purple-500/20 border-purple-500/60 text-purple-300' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, role: opt.value })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200
                    ${form.role === opt.value ? opt.active : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/30 mt-2">
              {form.role === 'admin'
                ? 'Puede registrar pagos, gastos y modificar todo, igual que tú.'
                : 'Solo consulta: verá los saldos y reportes sin poder modificarlos.'}
            </p>
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

      {/* Cambiar contraseña */}
      <Modal open={modal === 'password'} onClose={() => setModal(null)} title="Cambiar Contraseña" size="sm">
        <form onSubmit={handlePassword} className="space-y-4">
          <p className="text-sm text-white/60">
            Nueva contraseña para <span className="text-white font-medium">{selected?.name}</span> ({selected?.username}).
          </p>
          <div>
            <label className="block text-xs text-white/60 mb-1">Contraseña *</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="Mínimo 6 caracteres"
              autoFocus
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setModal(null)} className="flex-1 btn-ghost border border-white/20">
              Cancelar
            </button>
            <button type="submit" className="flex-1 btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Cambiar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message="¿Eliminar este perfil? La persona perderá el acceso a la app."
      />
    </div>
  );
}
