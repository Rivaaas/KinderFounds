import { useEffect, useState } from 'react';
import { Loader2, Server, X } from 'lucide-react';
import { onSlowRequestChange } from '../../services/slowRequest';

// Aviso de servidor despertando.
//
// El backend corre en una instancia gratuita de Render, que se apaga tras un rato
// sin tráfico; la primera petición después tarda entre 30 y 60 segundos. Sin
// explicación, esa espera se lee como una aplicación colgada.
//
// Se muestra solo cuando una petición ya lleva más del umbral esperando, y
// desaparece sola en cuanto el servidor responde. No cancela ni reintenta nada.
//
// Es un aviso flotante y NO un modal: antes usaba <Modal>, cuyo fondo oscuro
// capturaba todos los clics. Si el aviso quedaba visible (una petición colgada),
// la página entera quedaba bloqueada y había que hacer clic fuera para cerrarlo.
// Ahora el contenedor no intercepta clics (pointer-events-none) y la página
// sigue usable mientras se espera.
export default function ServerWakingNotice() {
  const [estado, setEstado] = useState({ waking: false, since: 0 });
  const [segundos, setSegundos] = useState(0);
  // Cerrado a mano por el usuario: se respeta hasta el próximo episodio de espera.
  const [descartado, setDescartado] = useState(false);

  useEffect(() => onSlowRequestChange((e) => {
    setEstado(e);
    if (!e.waking) setDescartado(false);
  }), []);

  // Contador visible: deja claro que la aplicación sigue trabajando y no se colgó.
  useEffect(() => {
    if (!estado.waking) { setSegundos(0); return; }
    const calcular = () => setSegundos(Math.max(0, Math.round((Date.now() - estado.since) / 1000)));
    calcular();
    const id = setInterval(calcular, 1000);
    return () => clearInterval(id);
  }, [estado.waking, estado.since]);

  if (!estado.waking || descartado) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-4 pointer-events-none">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-sm animate-fadeIn
                   bg-white dark:bg-kinder-card border border-gray-100 dark:border-kinder-border
                   rounded-2xl shadow-xl dark:shadow-card-dark p-4"
      >
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <div className="w-11 h-11 rounded-xl bg-kinder-blue/10 dark:bg-kinder-blue/20 flex items-center justify-center">
              <Server size={20} className="text-kinder-blue" />
            </div>
            <Loader2
              size={16}
              className="absolute -bottom-1 -right-1 text-kinder-blue animate-spin bg-white dark:bg-kinder-card rounded-full"
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-800 dark:text-white">Estamos iniciando el servidor ⏳</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-slate-300 leading-relaxed">
              Tras un tiempo sin uso, la primera respuesta puede tardar hasta un minuto.
              Puedes seguir usando la página mientras tanto.
            </p>
          </div>

          <button
            onClick={() => setDescartado(true)}
            aria-label="Ocultar aviso"
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Barra indeterminada: no hay progreso real que informar, pero deja ver movimiento. */}
        <div className="mt-3 w-full h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-kinder-blue animate-slide" />
        </div>

        <p className="mt-2 text-[11px] text-gray-400 dark:text-slate-500">
          Esperando hace {segundos} {segundos === 1 ? 'segundo' : 'segundos'} · las próximas solicitudes serán más rápidas
        </p>
      </div>
    </div>
  );
}
