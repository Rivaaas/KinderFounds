import { BuildzMark } from '../Brand/Buildz';
import { BUILDZ } from '../../config/brand';

// Pie de página común a todas las pantallas: panel de administración, consulta
// pública y login. Se mantiene en un solo componente para que el texto y el año
// no se desincronicen entre pantallas.
export default function Footer({ className = '' }) {
  const año = new Date().getFullYear();

  return (
    <footer className={`text-center text-xs text-gray-400 dark:text-slate-500 ${className}`}>
      <a
        href={BUILDZ.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300 hover:text-kinder-blue dark:hover:text-kinder-blue transition-colors"
      >
        <BuildzMark size="sm" />
        <span>Creado y desarrollado por <strong className="font-extrabold">Buildz.cl</strong></span>
      </a>
      <p className="mt-1.5">{BUILDZ.aporte}</p>
      <p className="mt-0.5">© {año} Buildz.cl · Todos los derechos reservados</p>
    </footer>
  );
}
