import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import { formatCLP } from '../utils/formatters';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

const INITIAL_INCOME  = { type: 'income',  amount: '', student: '' };
const INITIAL_EXPENSE = { type: 'expense', amount: '' };

export default function PettyCash() {
  const [movements, setMovements] = useState([]);
  const [balance,   setBalance]   = useState(0);
  const [students,  setStudents]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modal,     setModal]     = useState(null); // 'income' | 'expense' | 'edit'
  const [selected,  setSelected]  = useState(null);
  const [form,      setForm]      = useState(INITIAL_INCOME);
  const [saving,    setSaving]    = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [deleting,  setDeleting]  = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await api.get('/petty-cash');
    setMovements(data.movements);
    setBalance(data.balance);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get('/students?status=active').then(r => setStudents(r.data));
  }, []);

  const openIncome  = () => { setForm(INITIAL_INCOME);  setModal('income'); };
  const openExpense = () => { setForm(INITIAL_EXPENSE); setModal('expense'); };
  const openEdit    = (m) => {
    setSelected(m);
    setForm({ type: m.type, amount: m.amount, student: m.student?._id || '' });
    setModal('edit');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error('Ingresa un monto válido.');
      return;
    }
    if (form.type === 'income' && !form.student) {
      toast.error('Selecciona el alumno que realizó el pago.');
      return;
    }
    setSaving(true);
    try {
      if (modal === 'edit') {
        await api.put(`/petty-cash/${selected._id}`, form);
        toast.success('Movimiento actualizado.');
      } else {
        await api.post('/petty-cash', form);
        toast.success(form.type === 'income' ? 'Pago registrado.' : 'Egreso registrado.');
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
      await api.delete(`/petty-cash/${confirmId}`);
      toast.success('Movimiento eliminado.');
      setConfirmId(null);
      load();
    } catch { toast.error('Error.'); } finally { setDeleting(false); }
  };

  const totalIncome  = movements.filter(m => m.type === 'income').reduce((s, m) => s + m.amount, 0);
  const totalExpense = movements.filter(m => m.type === 'expense').reduce((s, m) => s + m.amount, 0);

  const columns = [
    { key: 'type', label: 'Tipo', render: (v) => (
      <span className={`flex items-center gap-1 text-xs font-semibold ${v === 'income' ? 'text-green-400' : 'text-rose-400'}`}>
        {v === 'income' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {v === 'income' ? 'Pago' : 'Egreso'}
      </span>
    )},
    { key: 'student', label: 'Alumno', render: (v) => v?.name || <span className="text-white/30">—</span> },
    { key: 'amount', label: 'Monto', render: (v, row) => (
      <span className={`font-semibold ${row.type === 'income' ? 'text-green-400' : 'text-rose-400'}`}>
        {row.type === 'income' ? '+' : '-'}{formatCLP(v)}
      </span>
    )},
    { key: 'actions', label: '', render: (_, row) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg"><Pencil size={14} /></button>
        <button onClick={() => setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={14} /></button>
      </div>
    )},
  ];

  const isEdit = modal === 'edit';
  const isIncome = form.type === 'income';

  return (
    <div className="space-y-5">
      {/* Balance card */}
      <div className="glass p-6 bg-gradient-to-r from-pink-900/30 to-purple-900/30 text-center">
        <PiggyBank size={36} className="mx-auto mb-3 text-pink-400" />
        <div className={`text-4xl font-bold ${balance >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
          {formatCLP(balance)}
        </div>
        <div className="text-white/50 text-sm mt-1">Saldo Actual de Caja Chica</div>
        <div className="flex justify-center gap-6 mt-4 text-sm">
          <span className="text-green-400">↑ {formatCLP(totalIncome)} recaudado</span>
          <span className="text-rose-400">↓ {formatCLP(totalExpense)} egresado</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={openIncome}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-green-600 to-teal-500 hover:from-green-500 hover:to-teal-400
            text-white shadow-lg transition-all duration-200 active:scale-95"
        >
          <TrendingUp size={16} /> Registrar Pago
        </button>
        <button
          onClick={openExpense}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-rose-600 to-pink-500 hover:from-rose-500 hover:to-pink-400
            text-white shadow-lg transition-all duration-200 active:scale-95"
        >
          <TrendingDown size={16} /> Registrar Egreso
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-white/40">Cargando...</div>
      ) : (
        <Table columns={columns} data={movements} emptyMessage="No hay movimientos en caja chica." />
      )}

      {/* Modal income / expense / edit */}
      <Modal
        open={modal === 'income' || modal === 'expense' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={isEdit ? 'Editar Movimiento' : isIncome ? 'Registrar Pago de Alumno' : 'Registrar Egreso'}
        size="sm"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Solo en edición mostramos selector de tipo */}
          {isEdit && (
            <div className="flex gap-3">
              {[
                { value: 'income',  label: '↑ Pago',   cls: 'from-green-600 to-teal-500' },
                { value: 'expense', label: '↓ Egreso',  cls: 'from-rose-600 to-pink-500' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: opt.value })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all
                    ${form.type === opt.value
                      ? `bg-gradient-to-r ${opt.cls} text-white border-transparent`
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Selector de alumno (solo en pagos) */}
          {isIncome && (
            <div>
              <label className="block text-xs text-white/60 mb-1">Alumno que pagó *</label>
              <select
                value={form.student}
                onChange={(e) => setForm({ ...form, student: e.target.value })}
                className="select-field"
                autoFocus
              >
                <option value="">Selecciona un alumno...</option>
                {students.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Monto */}
          <div>
            <label className="block text-xs text-white/60 mb-1">Monto (CLP) *</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input-field text-lg font-semibold"
              placeholder="0"
              autoFocus={!isIncome}
            />
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

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message="¿Eliminar este movimiento de caja chica?"
      />
    </div>
  );
}
