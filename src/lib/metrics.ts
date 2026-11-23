import type { RiskConfig, Signal } from './types';
import { pnlForStatus, round2 } from './risk';
import { zonedToEpoch } from './time';

export interface SessionMetrics {
  total: number;
  pending: number;
  winsBase: number;
  winsG1: number;
  winsG2: number;
  wins: number;
  losses: number;
  filtered: number;
  filteredWouldLose: number;
  winRate: number | null;
  pnl: number;
  equity: { time: number; value: number }[];
  maxDrawdown: number;
}

export function computeMetrics(signals: Signal[], risk: RiskConfig, listTz: string): SessionMetrics {
  const sorted = [...signals].sort(
    (a, b) => zonedToEpoch(a.date, a.time, listTz) - zonedToEpoch(b.date, b.time, listTz),
  );
  const m: SessionMetrics = {
    total: signals.length, pending: 0, winsBase: 0, winsG1: 0, winsG2: 0, wins: 0, losses: 0,
    filtered: 0, filteredWouldLose: 0, winRate: null, pnl: 0, equity: [], maxDrawdown: 0,
  };
  let equity = risk.capital;
  let peak = equity;
  let lastT = 0;
  for (const s of sorted) {
    switch (s.status) {
      case 'Pendiente': m.pending++; break;
      case 'Ganada Base': m.winsBase++; break;
      case 'Ganada Gale 1': m.winsG1++; break;
      case 'Ganada Gale 2': m.winsG2++; break;
      case 'Perdida': m.losses++; break;
      case 'Omitida':
        m.filtered++;
        if (s.rawOutcome === 'Perdida' || (risk.mode === 'FILTER_G1' && s.rawOutcome === 'Ganada Gale 2')) m.filteredWouldLose++;
        break;
    }
    if (s.status === 'Pendiente' || s.status === 'Omitida') continue;
    equity = round2(equity + pnlForStatus(s, risk));
    peak = Math.max(peak, equity);
    m.maxDrawdown = Math.max(m.maxDrawdown, peak - equity);
    let t = Math.floor(zonedToEpoch(s.date, s.time, listTz) / 1000);
    if (t <= lastT) t = lastT + 1; // lightweight-charts exige tiempos estrictamente crecientes
    lastT = t;
    m.equity.push({ time: t, value: equity });
  }
  m.wins = m.winsBase + m.winsG1 + m.winsG2;
  const decided = m.wins + m.losses;
  m.winRate = decided ? (m.wins / decided) * 100 : null;
  m.pnl = round2(equity - risk.capital);
  m.maxDrawdown = round2(m.maxDrawdown);
  return m;
}
