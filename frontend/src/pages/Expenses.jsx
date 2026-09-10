import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import { formatCLP, formatDate, EXPENSE_CATEGORY_LABELS, FUND_LABELS, todayISO } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const PAYMENT_METHODS = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito', otro: 'Otro' };
const INITIAL = { category: 'compra_actividad', amount: '', date: todayISO(), description: '', paymentMethod: 'efectivo', fund: 'general' };

export default function Expenses() {
  const { canWrite } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [form,     setForm]     = useState(INITIAL);
  const [saving,   setSaving]   = useState(false);
  const [confirmId,setConfirmId]= useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filterFund, setFilterFund] = useState('');
  const [filterCat,  setFilterCat]  = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterFund) q.set('fund', filterFund);
      if (filterCat)  q.set('category', filterCat);
      const { data } = await api.get(`/expenses${q.toString() ? '?' + q : ''}`);
      setExpenses(data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterFund, filterCat]);

  const openCreate = () => { setForm({ ...INITIAL, date: todayISO() }); setModal('create'); };
  const openEdit   = (e)  => { setSelected(e); setForm({ ...e, date: e.date?.slice(0,10) }); setModal('edit'); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.category || !form.amount || !form.description) { toast.error('Categoría, monto y descripción son requeridos.'); return; }
    if (Number(form.amount) < 0) { toast.error('El monto no puede ser negativo.'); return; }
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/expenses', form);
        toast.success('Gasto registrado.');
      } else {
        await api.put(`/expenses/${selected._id}`, form);
        toast.success('Gasto actualizado.');
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
      await api.delete(`/expenses/${confirmId}`);
      toast.success('Gasto eliminado.');
      setConfirmId(null);
      load();
    } catch { toast.error('Error.'); } finally { setDeleting(false); }
  };

  const totalGeneral = expenses.filter(e=>e.fund==='general').reduce((s,e)=>s+e.amount, 0);
  const totalPettyCash = expenses.filter(e=>e.fund==='caja_chica').reduce((s,e)=>s+e.amount, 0);

  const columns = [
    { key: 'description', label: 'Descripción' },
    { key: 'category', label: 'Categoría', render: (v) => EXPENSE_CATEGORY_LABELS[v] || v },
    { key: 'amount', label: 'Monto', render: (v) => <span className="text-rose-400 font-medium">{formatCLP(v)}</span> },
    { key: 'date', label: 'Fecha', render: (v) => formatDate(v) },
    { key: 'fund', label: 'Fondo', render: (v) => (
      <span className={v==='general'?'badge-paid':'badge-pending'}>{FUND_LABELS[v]}</span>
    )},
    { key: 'paymentMethod', label: 'Medio', render: (v) => PAYMENT_METHODS[v] || v },
    ...(canWrite ? [{ key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={()=>openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg"><Pencil size={14} /></button>
        <button onClick={()=>setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={14} /></button>
      </div>
    )}] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <select value={filterFund} onChange={(e)=>setFilterFund(e.target.value)} className="select-field w-auto">
          <option value="">Todos los fondos</option>
          <option value="general">Fondo General</option>
          <option value="caja_chica">Caja Chica</option>
        </select>
        <select value={filterCat} onChange={(e)=>setFilterCat(e.target.value)} className="select-field w-auto">
          <option value="">Todas las categorías</option>
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
        </select>
        {canWrite && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 ml-auto">
            <Plus size={16} /> Nuevo Gasto
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Gastos', value: formatCLP(totalGeneral + totalPettyCash), color: 'text-rose-400' },
          { label: 'Fondo General', value: formatCLP(totalGeneral), color: 'text-purple-400' },
          { label: 'Caja Chica', value: formatCLP(totalPettyCash), color: 'text-pink-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass p-4 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-white/50 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : (
        <Table columns={columns} data={expenses} emptyMessage="No hay gastos registrados." />
      )}

      <Modal open={modal==='create'||modal==='edit'} onClose={()=>setModal(null)}
        title={modal==='create'?'Nuevo Gasto':'Editar Gasto'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">Categoría *</label>
              <select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="select-field">
                {Object.entries(EXPENSE_CATEGORY_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Monto (CLP) *</label>
              <input type="number" min="0" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} className="input-field" placeholder="10000" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Fecha</label>
              <input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})} className="input-field" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Medio de Pago</label>
              <select value={form.paymentMethod} onChange={(e)=>setForm({...form,paymentMethod:e.target.value})} className="select-field">
                {Object.entries(PAYMENT_METHODS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Descontar de</label>
              <select value={form.fund} onChange={(e)=>setForm({...form,fund:e.target.value})} className="select-field">
                <option value="general">Fondo General</option>
                <option value="caja_chica">Caja Chica</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Descripción *</label>
            <input value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="input-field" placeholder="Describe el gasto..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={()=>setModal(null)} className="flex-1 btn-ghost border border-white/20">Cancelar</button>
            <button type="submit" className="flex-1 btn-primary" disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmId} onClose={()=>setConfirmId(null)} onConfirm={handleDelete} loading={deleting} message="¿Eliminar este gasto?" />
    </div>
  );
}
