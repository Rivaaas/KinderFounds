import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import { formatCLP } from '../utils/formatters';
import { FUNDS, fundByKey, normalizeFund } from '../config/funds';
import FundPicker from '../components/UI/FundPicker';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';

const CATEGORIES = {
  compra:      'Compra',
  convivencia: 'Convivencia',
  materiales:  'Materiales',
  decoracion:  'Decoración',
  otro:        'Otro',
};

const INITIAL = { description: '', amount: '', source: 'cuotas', category: 'otro' };

export default function Discounts() {
  const { canWrite } = useAuth();
  const [discounts,  setDiscounts]  = useState([]);
  const [totals,     setTotals]     = useState({ total: 0, byFund: {} });
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(null);
  const [selected,   setSelected]   = useState(null);
  const [form,       setForm]       = useState(INITIAL);
  const [saving,     setSaving]     = useState(false);
  const [confirmId,  setConfirmId]  = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [filterSrc,  setFilterSrc]  = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = filterSrc ? `?source=${filterSrc}` : '';
      const { data } = await api.get(`/discounts${q}`);
      setDiscounts(data.discounts);
      setTotals({ total: data.total, byFund: data.byFund || {} });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterSrc]);

  const openCreate = () => { setForm(INITIAL); setModal('create'); };
  const openEdit   = (d)  => { setSelected(d); setForm({ description: d.description, amount: d.amount, source: normalizeFund(d.source), category: d.category }); setModal('edit'); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) { toast.error('La descripción es requerida.'); return; }
    if (!form.amount || Number(form.amount) <= 0) { toast.error('Ingresa un monto válido.'); return; }

    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/discounts', form);
        toast.success('Descuento registrado.');
      } else {
        await api.put(`/discounts/${selected._id}`, form);
        toast.success('Descuento actualizado.');
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
      await api.delete(`/discounts/${confirmId}`);
      toast.success('Descuento eliminado.');
      setConfirmId(null);
      load();
    } catch { toast.error('Error.'); } finally { setDeleting(false); }
  };

  const columns = [
    { key: 'description', label: 'Descripción' },
    { key: 'category', label: 'Categoría', render: (v) => CATEGORIES[v] || v },
    { key: 'amount', label: 'Monto', render: (v) => (
      <span className="font-semibold text-rose-400">{formatCLP(v)}</span>
    )},
    { key: 'source', label: 'Se descuenta de', render: (v) => {
      const f = fundByKey(v);
      return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${f.badge}`}>{f.emoji} {f.label}</span>;
    }},
    ...(canWrite ? [{ key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg"><Pencil size={14} /></button>
        <button onClick={() => setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={14} /></button>
      </div>
    )}] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass p-4 sm:p-5 bg-gradient-to-br from-rose-900/30 to-rose-800/10 min-w-0">
          <div className="text-xs text-white/50 mb-1">Total Descontado</div>
          <div className="text-xl sm:text-2xl font-bold text-rose-400 tabular-nums break-words">{formatCLP(totals.total)}</div>
        </div>
        {FUNDS.map((f) => (
          <div key={f.key} className="glass p-4 sm:p-5 min-w-0 border-t-4" style={{ borderTopColor: f.color }}>
            <div className="text-xs text-white/50 mb-1">{f.emoji} De {f.label}</div>
            <div className={`text-xl sm:text-2xl font-bold tabular-nums break-words ${f.text}`}>{formatCLP(totals.byFund[f.key] || 0)}</div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="glass p-4 bg-amber-500/5 border border-amber-500/20 text-sm text-amber-300/80 flex gap-2 items-start">
        <Tag size={15} className="mt-0.5 shrink-0 text-amber-400" />
        <span>Cada descuento reduce el saldo del fondo que elijas: <strong>Cuotas Mensuales</strong>, <strong>Actividades</strong> o <strong>Caja Chica</strong>. El dashboard muestra el total de descuentos y el detalle por fondo.</span>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3">
        <select value={filterSrc} onChange={e => setFilterSrc(e.target.value)} className="select-field w-full sm:w-auto">
          <option value="">Todos los fondos</option>
          {FUNDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto sm:ml-auto">
            <Plus size={16} /> Nuevo Descuento
          </button>
        )}
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : (
        <Table columns={columns} data={discounts} emptyMessage="No hay descuentos registrados." />
      )}

      {/* Modal crear / editar */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nuevo Descuento' : 'Editar Descuento'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-white/60 mb-1">Descripción *</label>
            <input
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              className="input-field"
              placeholder="Ej: Compra para convivencia de fin de año"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Categoría</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="select-field">
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1">Monto (CLP) *</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="input-field text-lg font-semibold"
              placeholder="0"
            />
          </div>

          {/* Selector de fondo: muestra el saldo de cada uno antes de elegir. */}
          <FundPicker value={form.source} onChange={(source) => setForm({ ...form, source })} amount={form.amount} />

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

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message="¿Eliminar este descuento? El monto volverá a sumarse al saldo del fondo correspondiente."
      />
    </div>
  );
}
