import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, CreditCard, Receipt, Zap,
  PiggyBank, BarChart3, FileText, LogOut, X, Tag, KeyRound
} from 'lucide-react';
import { BuildzSidebarCredit } from '../Brand/Buildz';

const navItems = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',      bg: 'bg-blue-100 dark:bg-blue-900/40',   ic: 'text-kinder-blue' },
  { to: '/students',   icon: Users,            label: 'Estudiantes',    bg: 'bg-purple-100 dark:bg-purple-900/40', ic: 'text-kinder-lavender' },
  { to: '/payments',   icon: CreditCard,       label: 'Cuotas y Pagos', bg: 'bg-green-100 dark:bg-green-900/40',  ic: 'text-kinder-green' },
  { to: '/expenses',   icon: Receipt,          label: 'Gastos',         bg: 'bg-red-100 dark:bg-red-900/40',      ic: 'text-kinder-coral' },
  { to: '/discounts',  icon: Tag,              label: 'Descuentos',     bg: 'bg-amber-100 dark:bg-amber-900/40',  ic: 'text-amber-500' },
  { to: '/activities', icon: Zap,              label: 'Actividades',    bg: 'bg-yellow-100 dark:bg-yellow-900/40',ic: 'text-kinder-yellow dark:text-yellow-400' },
  { to: '/petty-cash', icon: PiggyBank,        label: 'Caja Chica',     bg: 'bg-pink-100 dark:bg-pink-900/40',    ic: 'text-pink-500' },
  { to: '/statistics', icon: BarChart3,        label: 'Estadísticas',   bg: 'bg-indigo-100 dark:bg-indigo-900/40',ic: 'text-indigo-500' },
  { to: '/reports',    icon: FileText,         label: 'Reportes',       bg: 'bg-slate-100 dark:bg-slate-700',     ic: 'text-slate-500 dark:text-slate-300' },
  { to: '/users',      icon: KeyRound,         label: 'Perfiles',       bg: 'bg-teal-100 dark:bg-teal-900/40',    ic: 'text-teal-500', adminOnly: true },
];

export default function Sidebar({ open, onClose }) {
  const { logout, user, isAdmin } = useAuth();
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-64 flex flex-col
        bg-white dark:bg-kinder-card
        border-r border-gray-100 dark:border-kinder-border
        shadow-xl dark:shadow-card-dark
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-gray-100 dark:border-kinder-border">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-extrabold text-kinder-blue tracking-tight">KINDERFOUNDS</span>
              <span className="text-lg">⭐</span>
            </div>
            <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 font-medium">Finanzas del Curso · por Buildz.cl</div>
          </div>
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {visibleItems.map(({ to, icon: Icon, label, bg, ic }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                ${isActive
                  ? 'bg-kinder-blue text-white shadow-glow'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/60 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-all
                    ${isActive ? 'bg-white/20' : bg}`}>
                    <Icon size={16} className={isActive ? 'text-white' : ic} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Crédito del creador */}
        <div className="px-3 pb-3">
          <BuildzSidebarCredit />
        </div>

        {/* User */}
        <div className="px-4 py-4 border-t border-gray-100 dark:border-kinder-border">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-kinder-blue flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? 'T'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800 dark:text-white truncate">{user?.name}</div>
              <div className="text-xs text-gray-400 dark:text-slate-500">
                {isAdmin ? 'Tesorero' : 'Solo lectura'}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full text-gray-400 hover:text-kinder-coral dark:text-slate-500 dark:hover:text-kinder-coral text-sm py-2 px-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150"
          >
            <LogOut size={15} /> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
