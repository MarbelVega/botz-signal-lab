import { useMemo } from 'react';
import { breakevenWinRate, cycleExpectedValue, cycleTable, maxExposure, sanitizeRisk } from '../lib/risk';
import type { OperatingMode, RiskConfig } from '../lib/types';
import { Card, NumberField, money } from './ui';

interface Props {
  risk: RiskConfig;
  onChange: (r: RiskConfig) => void;
  winProb: number;
  onWinProb: (n: number) => void;
}

export function RiskCalculator({ risk, onChange, winProb, onWinProb }: Props) {
  const safe = useMemo(() => sanitizeRisk(risk), [risk]);
  const rows = useMemo(() => cycleTable(safe), [safe]);
  const exposure = maxExposure(safe);
  const expPct = (exposure / safe.capital) * 100;
  const be = breakevenWinRate(safe.payoutPct);
  const q = Number.isFinite(winProb) ? Math.min(99, Math.max(1, winProb)) / 100 : 0.5;
  const ev = cycleExpectedValue(safe, q);
  const invalid = Object.entries(risk).some(([k, v]) => k !== 'mode' && (!Number.isFinite(v as number) || (v as number) <= 0));
  const set = (patch: Partial<RiskConfig>) => onChange({ ...risk, ...patch });

  return (
    <Card title="Calculadora de ciclos y gestión de riesgo">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <NumberField id="r-cap" label="Capital de prueba" value={risk.capital} min={1} step={50} onChange={(n) => set({ capital: n })} />
        <NumberField id="r-base" label="Monto base" value={risk.baseAmount} min={0.01} step={1} onChange={(n) => set({ baseAmount: n })} />
        <NumberField id="r-mult" label="Multiplicador ciclo" value={risk.multiplier} min={1} max={10} step={0.1} suffix="×" onChange={(n) => set({ multiplier: n })} />
        <NumberField id="r-pay" label="Payout" value={risk.payoutPct} min={1} max={100} step={1} suffix="%" onChange={(n) => set({ payoutPct: n })} />
        <div className="col-span-2 sm:col-span-1">
          <label className="label" htmlFor="r-mode">Modo operativo</label>
          <select id="r-mode" className="input" value={risk.mode} onChange={(e) => set({ mode: e.target.value as OperatingMode })}>
            <option value="COPY_G2">Copia sin filtro: hasta Gale 2</option>
            <option value="FILTER_G1">Con filtro de indicadores: máx. Gale 1</option>
          </select>
        </div>
      </div>
      {invalid && <p className="mt-2 text-xs text-red-400" role="alert">Hay valores vacíos o ≤ 0; se usan valores seguros por defecto para el cálculo.</p>}

      <div className="mt-3 overflow-x-auto rounded-xl ring-1 ring-slate-800">
        <table className="w-full min-w-[520px]">
          <thead className="bg-slate-900"><tr>
            <th className="th">Ciclo</th><th className="th text-right">Monto</th><th className="th text-right">Exposición acumulada</th>
            <th className="th text-right">% capital</th><th className="th text-right">Neto si gana aquí</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.level} className={`border-t border-slate-800 ${r.enabled ? '' : 'opacity-40 line-through'}`}>
                <td className="td font-semibold">{r.label}{!r.enabled && <span className="ml-1 text-[10px] no-underline">(bloqueado por modo)</span>}</td>
                <td className="td text-right font-mono">{money(r.amount)}</td>
                <td className="td text-right font-mono">{money(r.cumulative)}</td>
                <td className={`td text-right font-mono ${r.pctCapital > 10 ? 'text-red-400' : r.pctCapital > 5 ? 'text-amber-300' : ''}`}>{r.pctCapital.toFixed(2)}%</td>
                <td className={`td text-right font-mono ${r.netIfWin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{r.netIfWin >= 0 ? '+' : ''}{money(r.netIfWin)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-800 bg-slate-950/60 text-slate-500"><td className="td" colSpan={5}>Gale 3+ deshabilitado por diseño: no se escala más allá de Gale 2.</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className={`rounded-xl p-3 ring-1 ${expPct > 10 ? 'bg-red-950/50 ring-red-800' : 'bg-slate-950/70 ring-slate-800'}`}>
          <div className="text-[11px] uppercase text-slate-400">Pérdida máx. por ciclo</div>
          <div className="font-mono text-xl font-bold text-red-300">-{money(exposure)}</div>
          <div className="text-[11px] text-slate-400">{expPct.toFixed(2)}% del capital {expPct > 10 && '· ⚠ supera el 10%'}</div>
        </div>
        <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
          <div className="text-[11px] uppercase text-slate-400">Break-even por entrada</div>
          <div className="font-mono text-xl font-bold">{(be * 100).toFixed(2)}%</div>
          <div className="text-[11px] text-slate-400">con payout {safe.payoutPct}%: 1 / (1 + payout)</div>
        </div>
        <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
          <NumberField id="r-q" label="Supuesto: prob. acierto por entrada" value={winProb} min={1} max={99} step={1} suffix="%" onChange={onWinProb} />
          <div className={`mt-1 font-mono text-sm ${ev.ev >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>EV por ciclo: {ev.ev >= 0 ? '+' : ''}{money(ev.ev)}</div>
          <div className="text-[11px] text-slate-400">P(perder ciclo completo) = {(ev.pLoseAll * 100).toFixed(2)}%</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Nota educativa: los ciclos (Gale) suben la probabilidad de cerrar el ciclo en positivo, pero a cambio la pérdida máxima es mucho mayor.
        Con un acierto por entrada igual o por debajo del break-even, el valor esperado se mantiene negativo, haya o no Gale.
      </p>
    </Card>
  );
}
