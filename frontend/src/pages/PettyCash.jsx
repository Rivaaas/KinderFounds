import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Modal from '../components/UI/Modal';
import ConfirmDialog from '../components/UI/ConfirmDialog';
import Table from '../components/UI/Table';
import { formatCLP, formatDate } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';

const INITIAL_INCOME  = { type: 'income',  amount: '', student: '' };
const INITIAL_EXPENSE = { type: 'expense', amount: '' };

// De qué pantalla viene cada movimiento. Solo los propios se editan aquí;
// el resto se modifica donde se registraron.
const ORIGIN_LABELS = {
  movement: 'Caja Chica',
  payment:  'Pagos',
  expense:  'Gastos',
  discount: 'Descuentos',
};

export default function PettyCash() {
  const { canWrite } = useAuth();
  const [movements, setMovements] = useState([]);
  const [balance,   setBalance]   = useState(0);
  const [totals,    setTotals]    = useState({ income: 0, expense: 0 });
  // El saldo inicial es lo único que se guarda; el disponible siempre llega
  // calculado por el backend a partir de él más los movimientos.
  const [initial,   setInitial]   = useState(0);
  const [count,     setCount]     = useState(0);
  const [initModal, setInitModal] = useState(false);
  const [initForm,  setInitForm]  = useState('');
  const [savingInit, setSavingInit] = useState(false);
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
    try {
      const { data } = await api.get('/petty-cash');
      setMovements(data.movements);
      setBalance(data.currentBalance ?? data.balance);
      setInitial(data.initialBalance ?? 0);
      setCount(data.movementCount ?? data.movements.length);
      setTotals({ income: data.totalIncome, expense: data.totalExpense });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
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

  const handleSaveInitial = async (e) => {
    e.preventDefault();
    const monto = Number(initForm);
    if (initForm === '' || Number.isNaN(monto) || monto < 0) {
      toast.error('Ingresa un saldo inicial válido (0 o mayor).');
      return;
    }
    setSavingInit(true);
    try {
      await api.put('/petty-cash/initial-balance', { amount: monto });
      toast.success('Saldo inicial actualizado.');
      setInitModal(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No se pudo guardar el saldo inicial.');
    } finally {
      setSavingInit(false);
    }
  };

  const { income: totalIncome, expense: totalExpense } = totals;

  const columns = [
    { key: 'type', label: 'Tipo', render: (v) => (
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold tracking-wide px-2 py-0.5 rounded-full
        ${v === 'income'
          ? 'text-green-500 bg-green-500/10 dark:text-green-400'
          : 'text-rose-500 bg-rose-500/10 dark:text-rose-400'}`}>
        {v === 'income' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
        {v === 'income' ? 'INGRESO' : 'GASTO'}
      </span>
    )},
    { key: 'description', label: 'Detalle', render: (v) => v || <span className="text-white/30">—</span> },
    { key: 'student', label: 'Alumno', render: (v) => v?.name || <span className="text-white/30">—</span> },
    { key: 'date', label: 'Fecha', render: (v) => formatDate(v) },
    { key: 'origin', label: 'Origen', render: (v) => (
      <span className="text-xs text-white/50">{ORIGIN_LABELS[v] || v}</span>
    )},
    { key: 'amount', label: 'Monto', render: (v, row) => (
      <span className={`font-semibold ${row.type === 'income' ? 'text-green-400' : 'text-rose-400'}`}>
        {row.type === 'income' ? '+' : '−'}{formatCLP(v)}
      </span>
    )},
    // Saldo tras aplicar el movimiento: permite auditar la caja fila por fila.
    { key: 'balanceAfter', label: 'Saldo resultante', render: (v) => (
      v === undefined || v === null
        ? <span className="text-gray-300 dark:text-white/30">—</span>
        : <span className={`font-semibold tabular-nums ${v < 0 ? 'text-rose-400' : 'text-gray-700 dark:text-slate-200'}`}>
            {formatCLP(v)}
          </span>
    )},
    ...(canWrite ? [{ key: 'actions', label: '', render: (_, row) => (
      row.editable ? (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row)} className="p-1.5 text-purple-400 hover:bg-purple-400/10 rounded-lg"><Pencil size={14} /></button>
          <button onClick={() => setConfirmId(row._id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded-lg"><Trash2 size={14} /></button>
        </div>
      ) : (
        <span className="text-xs text-white/30">Editar en {ORIGIN_LABELS[row.origin] || row.origin}</span>
      )
    )}] : []),
  ];

  const isEdit = modal === 'edit';
  const isIncome = form.type === 'income';

  return (
    <div className="space-y-5">
      {/* Resumen de caja chica: el saldo se explica con la fórmula, no es un dato suelto */}
      <div className="glass p-6 bg-gradient-to-r from-pink-900/30 to-purple-900/30">
        <div className="flex items-center justify-center gap-2 mb-4">
          <PiggyBank size={22} className="text-pink-400" />
          <h2 className="font-bold text-gray-800 dark:text-white">Caja Chica</h2>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-gray-500 dark:text-white/50">Saldo inicial</dt>
            <dd className="text-lg font-bold text-gray-700 dark:text-slate-200">{formatCLP(initial)}</dd>
            {canWrite && (
              <button
                onClick={() => { setInitForm(String(initial)); setInitModal(true); }}
                className="mt-0.5 text-[11px] text-kinder-blue hover:underline"
              >
                Ajustar
              </button>
            )}
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-white/50">Ingresos</dt>
            <dd className="text-lg font-bold text-green-400">+{formatCLP(totalIncome)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500 dark:text-white/50">Gastos</dt>
            <dd className="text-lg font-bold text-rose-400">−{formatCLP(totalExpense)}</dd>
          </div>
        </dl>

        <div className="mt-5 pt-5 border-t border-gray-200/60 dark:border-white/10 text-center">
          <div className={`text-4xl font-extrabold ${balance >= 0 ? 'text-green-400' : 'text-rose-400'}`}>
            {formatCLP(balance)}
          </div>
          <div className="text-gray-500 dark:text-white/50 text-sm mt-1">Saldo disponible</div>
          <p className="mt-2 text-xs text-gray-400 dark:text-white/40">
            {formatCLP(initial)} inicial + {formatCLP(totalIncome)} ingresos − {formatCLP(totalExpense)} gastos
            {' · '}{count} {count === 1 ? 'movimiento' : 'movimientos'}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      {canWrite && <div className="flex gap-3">
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
      </div>}

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

      {/* Saldo inicial: el único valor que se guarda a mano */}
      <Modal open={initModal} onClose={() => setInitModal(false)} title="Saldo inicial de caja chica" size="sm">
        <form onSubmit={handleSaveInitial} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-white/60">
            Dinero con el que parte la caja y que no corresponde a ningún movimiento registrado
            (por ejemplo, un remanente del año anterior). El saldo disponible se recalcula solo:
            saldo inicial + ingresos − gastos.
          </p>
          <div>
            <label className="block text-xs text-gray-500 dark:text-white/60 mb-1">Saldo inicial (CLP)</label>
            <input
              type="number" min="0" step="1" value={initForm}
              onChange={(e) => setInitForm(e.target.value)}
              className="input-field" placeholder="0"
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setInitModal(false)} className="flex-1 btn-ghost border border-gray-200 dark:border-white/20">
              Cancelar
            </button>
            <button type="submit" className="flex-1 btn-primary" disabled={savingInit}>
              {savingInit ? 'Guardando...' : 'Guardar'}
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
