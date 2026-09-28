import { ExternalLink, Heart } from 'lucide-react';
import { BUILDZ } from '../../config/brand';

// Enlace externo seguro: noopener evita que la pestaña nueva controle a esta.
const enlace = { href: BUILDZ.url, target: '_blank', rel: 'noopener noreferrer' };

// Isotipo simple de Buildz: bloque con la "B". Es texto + CSS, sin imagen, para
// no depender de un archivo externo. Si Buildz tiene logo oficial, reemplazar aquí.
export function BuildzMark({ size = 'md' }) {
  const s = { sm: 'w-6 h-6 text-xs rounded-md', md: 'w-8 h-8 text-sm rounded-lg', lg: 'w-11 h-11 text-lg rounded-xl' }[size];
  return (
    <span
      aria-hidden="true"
      // Color en línea a propósito: index.css reescribe .text-white a gris oscuro
      // en tema claro (compatibilidad heredada) y la "B" quedaba ilegible.
      style={{ color: '#fff' }}
      className={`${s} shrink-0 inline-flex items-center justify-center font-black
                  bg-gradient-to-br from-slate-900 to-kinder-blue shadow-sm`}
    >
      B
    </span>
  );
}

// Píldora compacta "hecho por Buildz.cl", para cabeceras.
export function BuildzBadge({ className = '' }) {
  return (
    <a
      {...enlace}
      title={BUILDZ.firma}
      className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 shadow-sm
                  text-xs font-medium text-gray-600 dark:text-slate-300 hover:text-kinder-blue dark:hover:text-kinder-blue
                  transition-colors ${className}`}
    >
      <BuildzMark size="sm" />
      <span>por <strong className="font-extrabold text-gray-800 dark:text-white">Buildz.cl</strong></span>
    </a>
  );
}

// Tarjeta destacada: explica que la plataforma es un aporte gratuito de Buildz.
export function BuildzBanner({ className = '' }) {
  return (
    <a
      {...enlace}
      className={`group block glass p-5 border-2 border-kinder-blue/20 hover:border-kinder-blue/50 transition-colors ${className}`}
    >
      <div className="flex items-center gap-4">
        <BuildzMark size="lg" />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-kinder-blue flex items-center gap-1">
            <Heart size={12} className="fill-current" /> Aporte gratuito
          </p>
          <p className="mt-0.5 font-bold text-gray-800 dark:text-white">{BUILDZ.firma}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {BUILDZ.lema}. ¿Necesitas una plataforma como esta?
          </p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 shrink-0 text-sm font-semibold text-kinder-blue group-hover:underline">
          Visitar <ExternalLink size={14} />
        </span>
      </div>
    </a>
  );
}

// Crédito compacto para la barra lateral del panel.
export function BuildzSidebarCredit() {
  return (
    <a
      {...enlace}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800/60
                 hover:bg-kinder-sky dark:hover:bg-slate-700/60 transition-colors"
    >
      <BuildzMark size="sm" />
      <span className="min-w-0 leading-tight">
        <span className="block text-[11px] text-gray-400 dark:text-slate-500">Creado y desarrollado por</span>
        <span className="block text-sm font-extrabold text-gray-800 dark:text-white">Buildz.cl</span>
      </span>
      <ExternalLink size={13} className="ml-auto text-gray-400 shrink-0" />
    </a>
  );
}
