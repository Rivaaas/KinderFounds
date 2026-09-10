import { Menu, Sun, Moon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';

const titles = {
  '/dashboard':  { label: 'Dashboard',       emoji: '🏠' },
  '/students':   { label: 'Estudiantes',     emoji: '👨‍👩‍👧' },
  '/payments':   { label: 'Cuotas y Pagos',  emoji: '💳' },
  '/expenses':   { label: 'Gastos',          emoji: '📉' },
  '/discounts':  { label: 'Descuentos',      emoji: '🏷️' },
  '/activities': { label: 'Actividades',     emoji: '⚡' },
  '/petty-cash': { label: 'Caja Chica',      emoji: '🐷' },
  '/statistics': { label: 'Estadísticas',    emoji: '📊' },
  '/reports':    { label: 'Reportes',        emoji: '📄' },
  '/users':      { label: 'Perfiles',         emoji: '🔑' },
};

export default function Header({ onMenuClick }) {
  const { pathname } = useLocation();
  const { dark, toggle } = useTheme();
  const page = titles[pathname] || { label: 'KINDERFOUNDS', emoji: '⭐' };

  return (
    <header className="
      flex items-center gap-3 px-4 md:px-6 py-3.5
      bg-white dark:bg-kinder-card
      border-b border-gray-100 dark:border-kinder-border
      shadow-sm dark:shadow-none
    ">
      <button
        onClick={onMenuClick}
        className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xl">{page.emoji}</span>
        <h1 className="text-base font-bold text-gray-800 dark:text-white">{page.label}</h1>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden sm:block text-xs text-gray-400 dark:text-slate-500 capitalize">
          {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>

        {/* Dark/Light toggle */}
        <button
          onClick={toggle}
          title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="
            w-9 h-9 flex items-center justify-center rounded-xl
            bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600
            text-gray-500 dark:text-yellow-400
            transition-all duration-200 active:scale-90
          "
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
