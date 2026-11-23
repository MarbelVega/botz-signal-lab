import type { OperatingMode, RiskConfig, Signal } from './types';
import { maxGaleForMode } from './evaluation';

export interface CycleRow {
  level: 0 | 1 | 2;
  label: 'Base' | 'Gale 1' | 'Gale 2';
  amount: number;
  cumulative: number;
  netIfWin: number;
  pctCapital: number;
  enabled: boolean;
}

export const clampNum = (v: number, min: number, max: number, fallback: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

export function sanitizeRisk(r: RiskConfig): RiskConfig {
  return {
    capital: clampNum(r.capital, 1, 1e9, 1000),
    baseAmount: clampNum(r.baseAmount, 0.01, 1e8, 10),
    multiplier: clampNum(r.multiplier, 1, 10, 2.2),
    payoutPct: clampNum(r.payoutPct, 1, 100, 85),
    mode: r.mode === 'COPY_G2' ? 'COPY_G2' : 'FILTER_G1',
  };
}

const LABELS = ['Base', 'Gale 1', 'Gale 2'] as const;

/** Tabla de ciclos. Nunca escala más allá de Gale 2 (sin Gale 3+). */
export function cycleTable(cfg: RiskConfig): CycleRow[] {
  const c = sanitizeRisk(cfg);
  const p = c.payoutPct / 100;
  const maxG = maxGaleForMode(c.mode);
  let cum = 0;
  return ([0, 1, 2] as const).map((level) => {
    const amount = round2(c.baseAmount * c.multiplier ** level);
    const prev = cum;
    cum = round2(cum + amount);
    return {
      level, label: LABELS[level], amount, cumulative: cum,
      netIfWin: round2(amount * p - prev), pctCapital: (cum / c.capital) * 100, enabled: level <= maxG,
    };
  });
}

export function maxExposure(cfg: RiskConfig): number {
  const rows = cycleTable(cfg).filter((r) => r.enabled);
  return rows[rows.length - 1].cumulative;
}

/** Win rate mínimo por entrada para no perder dinero en una entrada simple: 1 / (1 + payout). */
export const breakevenWinRate = (payoutPct: number) => 1 / (1 + payoutPct / 100);

/**
 * Valor esperado de UN ciclo completo, dado un supuesto de probabilidad de acierto por entrada `q`.
 * Sirve para mostrar que el ciclo (martingala) cambia la distribución de resultados pero no la ventaja.
 */
export function cycleExpectedValue(cfg: RiskConfig, q: number) {
  const rows = cycleTable(cfg).filter((r) => r.enabled);
  const qq = clampNum(q, 0, 1, 0.5);
  let ev = 0;
  rows.forEach((r, L) => { ev += (1 - qq) ** L * qq * r.netIfWin; });
  const pLoseAll = (1 - qq) ** rows.length;
  ev -= pLoseAll * rows[rows.length - 1].cumulative;
  return { ev: round2(ev), pLoseAll, stakeExpected: rows.reduce((a, r, L) => a + (1 - qq) ** L * r.amount, 0) };
}

/** P&L de una señal según su estado y la configuración vigente. */
export function pnlForStatus(s: Pick<Signal, 'status'>, cfg: RiskConfig, modeOverride?: OperatingMode): number {
  const rows = cycleTable({ ...cfg, mode: modeOverride ?? cfg.mode });
  switch (s.status) {
    case 'Ganada Base': return rows[0].netIfWin;
    case 'Ganada Gale 1': return rows[1].netIfWin;
    case 'Ganada Gale 2': return rows[2].netIfWin;
    case 'Perdida': return -maxExposure({ ...cfg, mode: modeOverride ?? cfg.mode });
    default: return 0;
  }
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
