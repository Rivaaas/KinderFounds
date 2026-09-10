import { useEffect, useState } from 'react';
import { Loader2, Server } from 'lucide-react';
import Modal from './Modal';
import { onSlowRequestChange } from '../../services/slowRequest';

// Aviso de servidor despertando.
//
// El backend corre en una instancia gratuita de Render, que se apaga tras un rato
// sin tráfico; la primera petición después tarda entre 30 y 60 segundos. Sin
// explicación, esa espera se lee como una aplicación colgada.
//
// Se muestra solo cuando una petición ya lleva más del umbral esperando, y
// desaparece sola en cuanto llega la respuesta. No cancela ni reintenta nada: la
// petición original sigue su curso.
export default function ServerWakingNotice() {
  const [estado, setEstado] = useState({ waking: false, since: 0 });
  const [segundos, setSegundos] = useState(0);

  useEffect(() => onSlowRequestChange(setEstado), []);

  // Contador visible: deja claro que la aplicación sigue trabajando y no se colgó.
  useEffect(() => {
    if (!estado.waking) { setSegundos(0); return; }
    const calcular = () => setSegundos(Math.max(0, Math.round((Date.now() - estado.since) / 1000)));
    calcular();
    const id = setInterval(calcular, 1000);
    return () => clearInterval(id);
  }, [estado.waking, estado.since]);

  if (!estado.waking) return null;

  return (
    <Modal
      open
      // Cerrarlo solo oculta el aviso: la petición continúa y el resultado llega igual.
      onClose={() => setEstado({ waking: false, since: 0 })}
      title="Estamos iniciando el servidor ⏳"
      size="sm"
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-kinder-blue/10 dark:bg-kinder-blue/20 flex items-center justify-center">
            <Server size={26} className="text-kinder-blue" />
          </div>
          <Loader2
            size={20}
            className="absolute -bottom-1 -right-1 text-kinder-blue animate-spin bg-white dark:bg-kinder-card rounded-full"
          />
        </div>

        <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
          Esta es la primera solicitud después de un período de inactividad, por lo que el
          servidor puede tardar un poco más de lo habitual en responder.
          Por favor, espera unos segundos.
        </p>

        {/* Barra indeterminada: no hay progreso real que informar, pero deja ver movimiento. */}
        <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-kinder-blue animate-slide" />
        </div>

        <p className="text-xs text-gray-400 dark:text-slate-500">
          Esperando hace {segundos} {segundos === 1 ? 'segundo' : 'segundos'} · suele tardar hasta un minuto
        </p>

        <p className="text-xs font-medium text-kinder-green">
          Las próximas solicitudes serán más rápidas.
        </p>
      </div>
    </Modal>
  );
}
