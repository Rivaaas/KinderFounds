// Pie de página común a todas las pantallas: panel de administración, consulta
// pública y login. Se mantiene en un solo componente para que el texto y el año
// no se desincronicen entre pantallas.
export default function Footer({ className = '' }) {
  const año = new Date().getFullYear();

  return (
    <footer className={`text-center text-xs text-gray-400 dark:text-slate-600 ${className}`}>
      <p>© {año} KinderFunds · Todos los derechos reservados</p>
      <p className="mt-0.5">Desarrollado por Victor Rivas</p>
    </footer>
  );
}
