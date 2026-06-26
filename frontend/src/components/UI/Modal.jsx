import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`
        relative w-full ${sizes[size]} animate-fadeIn
        bg-white dark:bg-kinder-card
        border border-gray-100 dark:border-kinder-border
        rounded-2xl shadow-xl dark:shadow-card-dark
      `}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-kinder-border">
          <h2 className="text-base font-bold text-gray-800 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
