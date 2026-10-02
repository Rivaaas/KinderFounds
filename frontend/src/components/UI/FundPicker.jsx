import { useEffect, useState } from 'react';
import api from '../../services/api';
import { FUNDS, normalizeFund } from '../../config/funds';
import { formatCLP } from '../../utils/formatters';
import { AlertTriangle } from 'lucide-react';

// Saldos actuales por fondo, para que quien registra un gasto o descuento vea
// de dónde conviene sacar el dinero antes de elegir.
export function useFundBalances(enabled = true) {
  const [balances, setBalances] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let vivo = true;
    api.get('/dashboard/summary')
      .then(({ data }) => {
        if (!vivo || !Array.isArray(data?.funds)) return;
        setBalances(Object.fromEntries(data.funds.map((f) => [f.key, f.balance])));
      })
      .catch(() => { /* sin saldos el selector sigue funcionando, solo sin la ayuda */ });
    return () => { vivo = false; };
  }, [enabled]);
  return balances;
}

// Selector del fondo del que sale el dinero. Muestra el saldo disponible de
// cada uno y avisa si el monto que se está ingresando lo dejaría en negativo.
export default function FundPicker({ value, onChange, amount, label = 'Descontar de *', balances: externas }) {
  const propias = useFundBalances(!externas);
  const balances = externas || propias;
  const actual = normalizeFund(value);
  const monto = Number(amount) || 0;
  const saldoElegido = balances?.[actual];
  const quedaNegativo = balances && monto > 0 && saldoElegido !== undefined && monto > saldoElegido;

  return (
    <div>
      <label className="block text-xs text-white/60 mb-2">{label}</label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label={label}>
        {FUNDS.map((f) => {
          const activo = actual === f.key;
          const saldo = balances?.[f.key];
          const insuficiente = balances && monto > 0 && saldo !== undefined && monto > saldo;
          return (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => onChange(f.key)}
              className={`text-left rounded-xl border px-3 py-2.5 transition-all duration-200
                ${activo ? f.active : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'}`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden="true">{f.emoji}</span>
                <span className="truncate">{f.label}</span>
              </div>
              {saldo !== undefined && (
                <div className={`mt-1 text-xs tabular-nums ${insuficiente ? 'text-amber-500' : 'opacity-70'}`}>
                  Disponible: {formatCLP(saldo)}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {quedaNegativo && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Este monto supera lo disponible en {FUNDS.find((f) => f.key === actual)?.label}
            {' '}(quedaría en {formatCLP(saldoElegido - monto)}). Puedes guardarlo igual o elegir otro fondo.
          </span>
        </p>
      )}
    </div>
  );
}
