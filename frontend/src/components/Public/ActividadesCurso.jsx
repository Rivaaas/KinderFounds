import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, CalendarDays, Coins, Users } from 'lucide-react';
import { publicApi } from '../../services/api';
import { formatCLP, formatDate } from '../../utils/formatters';

// Actividades del curso en la consulta pública: para cada actividad visible,
// quiénes ya pagaron su cuota y quiénes están pendientes. Es información que la
// tesorera decide publicar por actividad (interruptor "visible al público").

const ESTADO = {
  planned:   { texto: 'Planificada', clase: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  active:    { texto: 'En curso',    clase: 'bg-kinder-green/15 text-green-700 dark:text-green-300' },
  completed: { texto: 'Completada',  clase: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

function ListaNombres({ titulo, nombres, color, punto, vacio }) {
  return (
    <div>
      <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 ${color}`}>
        {titulo} ({nombres.length})
      </h4>
      {nombres.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500">{vacio}</p>
      ) : (
        <ul className="space-y-1">
          {nombres.map((n, i) => (
            <li key={`${n}-${i}`} className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200">
              <span className={`w-2 h-2 rounded-full shrink-0 ${punto}`} aria-hidden="true" />
              <span className="truncate">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TarjetaActividad({ a, abiertaInicial }) {
  const [abierta, setAbierta] = useState(abiertaInicial);
  const total = a.totals.paidCount + a.totals.pendingCount;
  const pct = total > 0 ? Math.round((a.totals.paidCount / total) * 100) : 0;
  const est = ESTADO[a.status] || ESTADO.active;
  const conCuota = a.amountPerStudent > 0;

  return (
    <div className="glass overflow-hidden">
      <button
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        className="w-full text-left p-5 hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-800 dark:text-white">{a.name}</h3>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${est.clase}`}>{est.texto}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><CalendarDays size={12} /> {formatDate(a.date)}</span>
              {conCuota && <span className="flex items-center gap-1"><Coins size={12} /> Cuota {formatCLP(a.amountPerStudent)} por alumno</span>}
              {a.earned > 0 && <span className="flex items-center gap-1 text-kinder-green font-medium">Ganancia de la actividad: {formatCLP(a.earned)}</span>}
              <span className="flex items-center gap-1"><Users size={12} /> {total} participantes</span>
            </div>
            {a.description && <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{a.description}</p>}
          </div>
          <span className="shrink-0 text-gray-400">{abierta ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
        </div>

        {conCuota && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm mb-1.5">
              <span className="text-gray-700 dark:text-slate-200">
                <strong className="text-kinder-green">{a.totals.paidCount}</strong> de {total} pagaron
              </span>
              <span className="text-gray-500 dark:text-slate-400">
                {formatCLP(a.totals.collected)} de {formatCLP(a.totals.expected)}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
              <div className="h-full rounded-full bg-kinder-green transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </button>

      {abierta && (
        <div className="px-5 pb-5 pt-1 border-t border-gray-100 dark:border-kinder-border grid gap-5 sm:grid-cols-2 animate-fadeIn">
          <ListaNombres titulo="Pagaron" nombres={a.paid} color="text-kinder-green" punto="bg-kinder-green" vacio="Todavía nadie ha pagado." />
          <ListaNombres titulo="Pendientes" nombres={a.pending} color="text-kinder-coral" punto="bg-kinder-coral" vacio="¡Todos al día!" />
        </div>
      )}
    </div>
  );
}

export default function ActividadesCurso({ onVolver }) {
  const [actividades, setActividades] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vigente = true;
    publicApi.get('/public/activities')
      .then(({ data }) => { if (vigente) setActividades(data.activities || []); })
      .catch(() => { if (vigente) setError('No pudimos cargar las actividades. Intenta nuevamente.'); });
    return () => { vigente = false; };
  }, []);

  return (
    <div className="mt-2 animate-fadeIn">
      <button onClick={onVolver}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-kinder-blue transition-colors">
        <ArrowLeft size={14} /> Volver a la consulta por estudiante
      </button>

      <div className="text-center mt-4 mb-6">
        <div className="text-4xl mb-2">🎉</div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">Actividades del curso</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Cuotas y actividades: quiénes ya aportaron y quiénes faltan.</p>
      </div>

      {actividades === null && !error && (
        <div className="mt-10 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-kinder-blue" /> Cargando actividades...
        </div>
      )}

      {error && (
        <div className="glass p-6 text-center text-gray-700 dark:text-slate-200">{error}</div>
      )}

      {actividades && actividades.length === 0 && (
        <div className="glass p-8 text-center text-gray-500 dark:text-slate-400">
          <div className="text-4xl mb-2 opacity-60">📭</div>
          Por ahora no hay actividades publicadas.
        </div>
      )}

      {actividades && actividades.length > 0 && (
        <div className="space-y-4">
          {actividades.map((a, i) => <TarjetaActividad key={`${a.name}-${a.date}`} a={a} abiertaInicial={i === 0} />)}
        </div>
      )}
    </div>
  );
}
