import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, onClose, onConfirm, title = '¿Estás seguro?', message, loading }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle size={28} className="text-kinder-coral" />
        </div>
        <p className="text-sm text-gray-600 dark:text-slate-400">
          {message || 'Esta acción no se puede deshacer.'}
        </p>
        <div className="flex gap-3 w-full">
          <button onClick={onClose} className="flex-1 btn-ghost border border-gray-200 dark:border-kinder-border">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 btn-danger" disabled={loading}>
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
