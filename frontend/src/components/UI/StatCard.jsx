const palette = {
  purple: { bg: 'bg-purple-50  dark:bg-purple-900/20', border: 'border-l-kinder-lavender', icon: 'bg-purple-100  dark:bg-purple-900/40 text-kinder-lavender', text: 'text-kinder-lavender' },
  cyan:   { bg: 'bg-blue-50    dark:bg-blue-900/20',   border: 'border-l-kinder-blue',      icon: 'bg-blue-100    dark:bg-blue-900/40   text-kinder-blue',      text: 'text-kinder-blue' },
  green:  { bg: 'bg-green-50   dark:bg-green-900/20',  border: 'border-l-kinder-green',     icon: 'bg-green-100   dark:bg-green-900/40  text-kinder-green',     text: 'text-kinder-green' },
  rose:   { bg: 'bg-red-50     dark:bg-red-900/20',    border: 'border-l-kinder-coral',     icon: 'bg-red-100     dark:bg-red-900/40    text-kinder-coral',     text: 'text-kinder-coral' },
  yellow: { bg: 'bg-yellow-50  dark:bg-yellow-900/20', border: 'border-l-kinder-yellow',    icon: 'bg-yellow-100  dark:bg-yellow-900/40 text-yellow-500',       text: 'text-yellow-500' },
  pink:   { bg: 'bg-pink-50    dark:bg-pink-900/20',   border: 'border-l-pink-400',         icon: 'bg-pink-100    dark:bg-pink-900/40   text-pink-500',         text: 'text-pink-500' },
  indigo: { bg: 'bg-indigo-50  dark:bg-indigo-900/20', border: 'border-l-indigo-400',       icon: 'bg-indigo-100  dark:bg-indigo-900/40 text-indigo-500',       text: 'text-indigo-500' },
  orange: { bg: 'bg-orange-50  dark:bg-orange-900/20', border: 'border-l-orange-400',       icon: 'bg-orange-100  dark:bg-orange-900/40 text-orange-500',       text: 'text-orange-500' },
};

export default function StatCard({ label, value, icon: Icon, color = 'purple', sub }) {
  const p = palette[color] || palette.purple;

  return (
    <div className={`
      ${p.bg} ${p.border}
      border border-gray-100 dark:border-kinder-border
      border-l-4 rounded-2xl p-5 shadow-card dark:shadow-card-dark
      hover:scale-[1.02] transition-transform duration-200 cursor-default
    `}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${p.icon}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className={`text-2xl font-extrabold ${p.text}`}>{value}</div>
      <div className="text-sm font-medium text-gray-600 dark:text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
