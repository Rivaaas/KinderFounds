import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, X, Lock, Sun, Moon, Loader2, PiggyBank, Wallet, BarChart3, PartyPopper } from 'lucide-react';
import { publicApi } from '../services/api';
import Footer from '../components/Layout/Footer';
import { BuildzBadge, BuildzBanner } from '../components/Brand/Buildz';
import ActividadesCurso from '../components/Public/ActividadesCurso';
import { useTheme } from '../context/ThemeContext';
import { formatCLP } from '../utils/formatters';

const ESTADOS = {
  al_dia:    { emoji: '🟢', texto: 'Cuenta al día',        clase: 'text-kinder-green', fondo: 'bg-kinder-green/10 border-kinder-green/30' },
  con_deuda: { emoji: '🟠', texto: 'Tiene pagos pendientes', clase: 'text-amber-500',    fondo: 'bg-amber-500/10 border-amber-500/30' },
  sin_pagos: { emoji: '🔴', texto: 'Pendiente de pago',    clase: 'text-kinder-coral', fondo: 'bg-kinder-coral/10 border-kinder-coral/30' },
};

const ESTADO_CUOTA = {
  paid:      { icono: '✅', texto: 'Pagado',    clase: 'text-kinder-green' },
  pending:   { icono: '❌', texto: 'Pendiente', clase: 'text-kinder-coral' },
  cancelled: { icono: '⛔', texto: 'Anulado',   clase: 'text-gray-400 dark:text-slate-500' },
};

const TIPOS = {
  actividad_18_septiembre: '18 de Septiembre',
  navidad: 'Navidad', paseo: 'Paseo', rifa: 'Rifa',
  aporte_voluntario: 'Aporte voluntario', otro: 'Otro',
};

// Barra de avance: comunica de un vistazo cuánto falta, sin depender del color.
function Progreso({ pagado, total, color }) {
  const pct = total > 0 ? Math.min(100, Math.round((pagado / total) * 100)) : 0;
  return (
    <div className="mt-3">
      <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">{pct}% cubierto</div>
    </div>
  );
}

function Tarjeta({ icono, titulo, pagado, total, pendiente, excedente, color, barra }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className={color}>{icono}</span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">{titulo}</h3>
      </div>
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-2xl font-extrabold text-gray-800 dark:text-white">{formatCLP(pagado)}</span>
        <span className="text-sm text-gray-400 dark:text-slate-500">de {formatCLP(total)}</span>
      </div>
      <Progreso pagado={pagado} total={total} color={barra} />
      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-kinder-border text-sm">
        {pendiente > 0 ? (
          <span className="text-gray-600 dark:text-slate-300">
            Pendiente: <strong className="text-kinder-coral">{formatCLP(pendiente)}</strong>
          </span>
        ) : (
          <span className="text-kinder-green font-medium">Sin saldo pendiente</span>
        )}
        {excedente > 0 && (
          <div className="mt-1 text-xs text-kinder-blue">Pagó {formatCLP(excedente)} por sobre lo requerido.</div>
        )}
      </div>
    </div>
  );
}

export default function Consulta() {
  const { dark, toggle } = useTheme();
  const [params, setParams] = useSearchParams();

  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto]   = useState(false);
  const [aviso, setAviso]       = useState('');
  const [estado, setEstado]     = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError]       = useState('');
  const cajaRef = useRef(null);

  const seleccionado = params.get('alumno');
  // Vista de actividades del curso: vive en la URL para poder compartir el enlace.
  const vistaActividades = params.get('vista') === 'actividades';

  // Cierra el desplegable al hacer clic fuera.
  useEffect(() => {
    const fuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  // Búsqueda con espera: no se consulta en cada tecla.
  useEffect(() => {
    const texto = query.trim();
    // Tres caracteres, igual que el backend: con menos, el buscador se convertía
    // en un listado del curso completo para quien barriera combinaciones.
    if (texto.length < 3) { setResults([]); setAviso(''); return; }

    let vigente = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await publicApi.get('/public/students', { params: { q: texto } });
        if (!vigente) return;
        setResults(data.results || []);
        setAviso((data.results || []).length === 0 ? 'No encontramos un estudiante con ese nombre.' : '');
        setAbierto(true);
      } catch {
        if (vigente) setAviso('No pudimos consultar la información. Intenta nuevamente.');
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);

    return () => { vigente = false; clearTimeout(t); };
  }, [query]);

  // El alumno seleccionado vive en la URL: al recargar, la consulta se mantiene.
  useEffect(() => {
    if (!seleccionado) { setEstado(null); setError(''); return; }

    let vigente = true;
    setCargando(true);
    setError('');
    publicApi.get(`/public/students/${seleccionado}/statement`)
      .then(({ data }) => { if (vigente) setEstado(data); })
      .catch((err) => {
        if (!vigente) return;
        setEstado(null);
        setError(err?.response?.status === 404
          ? 'No encontramos un estudiante con ese nombre.'
          : 'No pudimos consultar la información. Intenta nuevamente.');
      })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
  }, [seleccionado]);

  const elegir = (alumno) => {
    setQuery(alumno.name);
    setAbierto(false);
    setResults([]);
    setParams({ alumno: alumno.id });
  };

  const limpiar = () => {
    setQuery(''); setResults([]); setAviso(''); setAbierto(false); setParams({});
  };

  const est = estado ? (ESTADOS[estado.summary.estado] || ESTADOS.con_deuda) : null;

  const BotonActividades = ({ className = '' }) => (
    <button
      onClick={() => setParams({ vista: 'actividades' })}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm
                  bg-white dark:bg-kinder-card border border-kinder-lavender/40 text-kinder-lavender
                  shadow-card dark:shadow-card-dark hover:bg-kinder-lavender hover:text-white transition-colors ${className}`}
    >
      <PartyPopper size={16} /> Ver actividades del curso
    </button>
  );

  return (
    <div className="min-h-screen bg-kinder-sky dark:bg-kinder-dark">
      {/* Decoración de fondo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-kinder-blue/10 dark:bg-kinder-blue/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-32 w-96 h-96 bg-kinder-lavender/10 dark:bg-kinder-lavender/20 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 pb-16">

        {/* Barra superior */}
        <header className="flex items-center gap-2 py-4">
          <BuildzBadge className="mr-auto" />
          <button
            onClick={toggle}
            aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center text-gray-400 dark:text-yellow-400 hover:scale-105 transition-transform"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link
            to="/login"
            aria-label="Administración"
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 shadow-sm hover:text-kinder-blue transition-colors"
          >
            <Lock size={14} /> <span className="hidden sm:inline">Administración</span>
          </Link>
        </header>

        {vistaActividades ? (
          <ActividadesCurso onVolver={() => setParams({})} />
        ) : (<>
        {/* Portada */}
        <div className="text-center mt-4 mb-8">
          <div className="text-5xl mb-3">💰</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-kinder-blue tracking-tight">Tesorería Kinder</h1>
          <h2 className="mt-4 text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            Consulta el estado de tu estudiante
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-500 dark:text-slate-400 max-w-md mx-auto">
            Ingresa el nombre del estudiante para consultar sus cuotas y caja chica.
          </p>
        </div>

        {/* Buscador */}
        <div ref={cajaRef} className="relative">
          <label htmlFor="buscar" className="sr-only">Buscar estudiante</label>
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              id="buscar"
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length && setAbierto(true)}
              placeholder="Escribe el nombre o apellido del estudiante..."
              className="w-full bg-white dark:bg-kinder-card border border-gray-200 dark:border-kinder-border
                         text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500
                         rounded-2xl pl-12 pr-12 py-4 text-base shadow-card dark:shadow-card-dark
                         focus:outline-none focus:ring-2 focus:ring-kinder-blue/40 focus:border-kinder-blue transition-all"
            />
            {(query || seleccionado) && (
              <button
                onClick={limpiar}
                aria-label="Limpiar búsqueda"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                {buscando ? <Loader2 size={18} className="animate-spin" /> : <X size={18} />}
              </button>
            )}
          </div>

          {/* Resultados */}
          {abierto && results.length > 0 && (
            <ul className="absolute z-20 mt-2 w-full bg-white dark:bg-kinder-card border border-gray-100 dark:border-kinder-border
                           rounded-2xl shadow-xl overflow-hidden animate-fadeIn max-h-72 overflow-y-auto">
              {results.map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => elegir(a)}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-slate-200
                               hover:bg-kinder-sky dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="font-medium">{a.name}</span>
                    {!a.active && <span className="badge-cancelled shrink-0">Inactivo</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {aviso && !abierto && query.trim().length >= 3 && !buscando && (
            <p className="mt-3 text-sm text-center text-gray-500 dark:text-slate-400">{aviso}</p>
          )}
          {aviso && abierto && results.length === 0 && (
            <p className="mt-3 text-sm text-center text-gray-500 dark:text-slate-400">{aviso}</p>
          )}
        </div>

        {/* Estado de cuenta */}
        {cargando && (
          <div className="mt-10 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-kinder-blue" />
            Consultando información...
          </div>
        )}

        {error && !cargando && (
          <div className="mt-10 glass p-6 text-center">
            <div className="text-4xl mb-2">🔍</div>
            <p className="text-gray-700 dark:text-slate-200 font-medium">{error}</p>
            <button onClick={limpiar} className="mt-4 btn-ghost border border-gray-200 dark:border-kinder-border">
              Buscar de nuevo
            </button>
          </div>
        )}

        {estado && !cargando && !error && (
          <div className="mt-10 space-y-6 animate-fadeIn">

            {/* Nombre y estado */}
            <div className="text-center">
              <h2 className="text-2xl font-extrabold text-gray-800 dark:text-white">{estado.student.name}</h2>
              {!estado.student.active && (
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Estudiante marcado como inactivo</p>
              )}
              <div className={`inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full border text-sm font-semibold ${est.fondo} ${est.clase}`}>
                <span aria-hidden="true">{est.emoji}</span> {est.texto}
              </div>
            </div>

            {/* Tarjetas */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Tarjeta
                icono={<Wallet size={18} />} titulo="Cuotas mensuales"
                pagado={estado.cuotas.paid} total={estado.cuotas.total}
                pendiente={estado.cuotas.pending} excedente={estado.cuotas.surplus}
                color="text-kinder-blue" barra="bg-kinder-blue"
              />
              <Tarjeta
                icono={<PiggyBank size={18} />} titulo="Caja chica"
                pagado={estado.pettyCash.paid} total={estado.pettyCash.total}
                pendiente={estado.pettyCash.pending} excedente={estado.pettyCash.surplus}
                color="text-kinder-lavender" barra="bg-kinder-lavender"
              />
            </div>

            {estado.otherPayments.total > 0 && (
              <Tarjeta
                icono={<BarChart3 size={18} />} titulo="Otros aportes y actividades"
                pagado={estado.otherPayments.paid} total={estado.otherPayments.total}
                pendiente={estado.otherPayments.pending} excedente={estado.otherPayments.surplus}
                color="text-kinder-yellow" barra="bg-kinder-yellow"
              />
            )}

            {/* Total */}
            <div className={`glass p-6 border-2 ${est.fondo}`}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 text-center">
                Estado general
              </h3>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Debe pagar</div>
                  <div className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">{formatCLP(estado.summary.total)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Pagado</div>
                  <div className="text-lg sm:text-xl font-bold text-kinder-green">{formatCLP(estado.summary.paid)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-slate-400">Pendiente</div>
                  <div className={`text-lg sm:text-xl font-bold ${estado.summary.pending > 0 ? 'text-kinder-coral' : 'text-kinder-green'}`}>
                    {formatCLP(estado.summary.pending)}
                  </div>
                </div>
              </div>
              <Progreso pagado={estado.summary.paid} total={estado.summary.total} color="bg-kinder-green" />
              {estado.summary.surplus > 0 && (
                <p className="mt-3 text-center text-sm text-kinder-blue">
                  Hay un excedente de {formatCLP(estado.summary.surplus)} a favor del estudiante.
                </p>
              )}
            </div>

            {/* Detalle de cuotas */}
            {estado.cuotas.months.length > 0 && (
              <div className="glass overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-kinder-border flex items-baseline justify-between gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-800 dark:text-white">Detalle de cuotas</h3>
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    {estado.cuotas.paidCount} de {estado.cuotas.count} pagadas
                  </span>
                </div>
                <ul className="divide-y divide-gray-50 dark:divide-kinder-border">
                  {estado.cuotas.months.map((m, i) => {
                    const e = ESTADO_CUOTA[m.status] || ESTADO_CUOTA.pending;
                    return (
                      <li key={`${m.month}-${i}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <span className="text-gray-700 dark:text-slate-200 capitalize">{m.label}</span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="text-gray-600 dark:text-slate-300 tabular-nums">{formatCLP(m.amount)}</span>
                          <span className={`flex items-center gap-1 font-medium w-24 justify-end ${e.clase}`}>
                            <span aria-hidden="true">{e.icono}</span> {e.texto}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Detalle de caja chica */}
            <div className="glass p-5">
              <h3 className="font-bold text-gray-800 dark:text-white mb-3">Caja chica</h3>
              <dl className="grid grid-cols-3 gap-3 text-center text-sm">
                <div><dt className="text-xs text-gray-500 dark:text-slate-400">Requerido</dt>
                  <dd className="font-bold text-gray-800 dark:text-white">{formatCLP(estado.pettyCash.total)}</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-slate-400">Pagado</dt>
                  <dd className="font-bold text-kinder-green">{formatCLP(estado.pettyCash.paid)}</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-slate-400">Pendiente</dt>
                  <dd className={`font-bold ${estado.pettyCash.pending > 0 ? 'text-kinder-coral' : 'text-kinder-green'}`}>
                    {formatCLP(estado.pettyCash.pending)}
                  </dd></div>
              </dl>
              {estado.pettyCash.total === 0 && estado.pettyCash.paid === 0 && (
                <p className="mt-3 text-xs text-center text-gray-500 dark:text-slate-400">
                  Aún no hay caja chica registrada para este estudiante.
                </p>
              )}
            </div>

            {/* Otros aportes, en detalle */}
            {estado.otherPayments.items.length > 0 && (
              <div className="glass overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-kinder-border">
                  <h3 className="font-bold text-gray-800 dark:text-white">Otros aportes</h3>
                </div>
                <ul className="divide-y divide-gray-50 dark:divide-kinder-border">
                  {estado.otherPayments.items.map((p, i) => {
                    const e = ESTADO_CUOTA[p.status] || ESTADO_CUOTA.pending;
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                        <span className="text-gray-700 dark:text-slate-200 min-w-0">
                          <span className="block truncate">{p.description || TIPOS[p.type] || p.type}</span>
                          {p.description && <span className="text-xs text-gray-400">{TIPOS[p.type] || p.type}</span>}
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          <span className="text-gray-600 dark:text-slate-300 tabular-nums">{formatCLP(p.amount)}</span>
                          <span className={`flex items-center gap-1 font-medium w-24 justify-end ${e.clase}`}>
                            <span aria-hidden="true">{e.icono}</span> {e.texto}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {estado.cuotas.cancelled > 0 && (
              <p className="text-xs text-center text-gray-500 dark:text-slate-400">
                Hay {formatCLP(estado.cuotas.cancelled)} en cuotas anuladas que no se cobran y no forman parte del total.
              </p>
            )}
          </div>
        )}

        {/* Estado inicial */}
        {!estado && !cargando && !error && !query && (
          <div className="mt-12 text-center text-gray-400 dark:text-slate-500">
            <div className="text-5xl mb-3 opacity-40">🎒</div>
            <p className="text-sm">Busca por nombre o apellido para ver el estado de cuenta.</p>
            <div className="mt-6"><BotonActividades /></div>
          </div>
        )}

        {/* Acceso a actividades también cuando ya hay un estado de cuenta en pantalla */}
        {(estado || error) && !cargando && (
          <div className="mt-8 text-center"><BotonActividades /></div>
        )}

        </>)}

        <div className="mt-16 text-center text-xs text-gray-400 dark:text-slate-600">
          Si un monto no coincide con lo que pagaste, avisa al tesorero del curso.
        </div>
        <BuildzBanner className="mt-8" />
        <Footer className="mt-6 pt-6 border-t border-gray-200/60 dark:border-kinder-border" />
      </div>
    </div>
  );
}
