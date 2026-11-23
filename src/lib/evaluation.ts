import { computeAll, fractalHalf, type IndicatorBundle } from './indicators';
import type {
  Candle, Direction, Evaluation, IndicatorConfig, IndicatorVote, OperatingMode, RiskLevel, Verdict, Vote,
} from './types';

const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : v.toFixed(d));

/**
 * Motor de votos sobre las `lookback` velas cerradas previas a la vela objetivo (índice `t`).
 * Reglas (documentadas en docs/INDICADORES_Y_LEYES.md):
 *  - EMA(100): 3/3 cierres sobre la EMA => CALL (tendencia), 3/3 debajo => PUT, mixto => NEUTRAL.
 *  - Fractals(6): último fractal CONFIRMADO reciente. Fractal inferior (soporte) => CALL; superior (resistencia) => PUT.
 *  - Bollinger(20,2): alguna de las 3 velas toca/rompe banda inferior => CALL (reversión); superior => PUT.
 *  - RSI(6) [80/20]: algún valor <= 20 => CALL; >= 80 => PUT.
 *  - Estocástico %K(6) [80/20]: algún %K <= 20 => CALL; >= 80 => PUT.
 * Si un indicador marca ambas direcciones dentro de la ventana, vota NEUTRAL.
 */
export function voteIndicators(candles: Candle[], t: number, cfg: IndicatorConfig, bundle?: IndicatorBundle): IndicatorVote[] {
  const b = bundle ?? computeAll(candles, cfg);
  const lb = cfg.lookback;
  const idx: number[] = [];
  for (let i = t - lb; i < t; i++) if (i >= 0) idx.push(i);
  const votes: IndicatorVote[] = [];

  // EMA
  {
    const rel = idx.map((i) => (b.ema[i] === null ? 0 : Math.sign(candles[i].close - (b.ema[i] as number))));
    const above = rel.filter((r) => r > 0).length;
    const below = rel.filter((r) => r < 0).length;
    const vote: Vote = idx.length && above === idx.length ? 'CALL' : idx.length && below === idx.length ? 'PUT' : 'NEUTRAL';
    const lastEma = b.ema[idx[idx.length - 1]];
    votes.push({
      key: 'EMA', label: `EMA ${cfg.emaPeriod}`, vote,
      reason: lastEma === null ? `Datos insuficientes (< ${cfg.emaPeriod} velas)` :
        vote === 'CALL' ? `${above}/${idx.length} cierres sobre la EMA: tendencia alcista` :
        vote === 'PUT' ? `${below}/${idx.length} cierres bajo la EMA: tendencia bajista` :
        `Precio cruzando la EMA (${above} arriba / ${below} abajo)`,
      values: `EMA=${fmt(lastEma, 5)}`,
    });
  }

  // Fractals (solo confirmados antes de t)
  {
    const half = fractalHalf(cfg.fractalPeriod);
    const lastConfirmable = t - 1 - half;
    const from = Math.max(0, lastConfirmable - (lb + half * 2));
    let found: { i: number; type: 'UP' | 'DOWN' } | null = null;
    let conflict = false;
    for (let i = lastConfirmable; i >= from; i--) {
      const f = b.fractals[i];
      if (f === 'BOTH') { conflict = true; found = null; break; }
      if (f === 'UP' || f === 'DOWN') { found = { i, type: f }; break; }
    }
    const vote: Vote = conflict || !found ? 'NEUTRAL' : found.type === 'DOWN' ? 'CALL' : 'PUT';
    const ago = found ? t - found.i : 0;
    votes.push({
      key: 'FRACTALS', label: `Fractals ${cfg.fractalPeriod}P`, vote,
      reason: conflict ? 'Fractal doble (arriba y abajo) en la misma vela' :
        !found ? 'Sin fractal confirmado reciente' :
        found.type === 'DOWN' ? `Fractal inferior (soporte) confirmado hace ${ago} velas` :
        `Fractal superior (resistencia) confirmado hace ${ago} velas`,
      values: found ? `${found.type === 'DOWN' ? '▼ low' : '▲ high'}=${fmt(found.type === 'DOWN' ? candles[found.i].low : candles[found.i].high, 5)}` : `lado=${half} velas`,
    });
  }

  // Bollinger
  {
    let lower = 0; let upper = 0;
    for (const i of idx) {
      const bb = b.bb[i];
      if (!bb) continue;
      if (candles[i].low <= bb.lower) lower++;
      if (candles[i].high >= bb.upper) upper++;
    }
    const vote: Vote = lower && !upper ? 'CALL' : upper && !lower ? 'PUT' : 'NEUTRAL';
    const last = b.bb[idx[idx.length - 1]];
    votes.push({
      key: 'BB', label: `Bollinger ${cfg.bbPeriod},${cfg.bbStdDev}`, vote,
      reason: !last ? 'Datos insuficientes' :
        vote === 'CALL' ? `${lower} vela(s) tocaron la banda inferior: posible rebote` :
        vote === 'PUT' ? `${upper} vela(s) tocaron la banda superior: posible retroceso` :
        lower && upper ? 'Toques en ambas bandas (alta volatilidad)' : 'Precio dentro de las bandas',
      values: last ? `U=${fmt(last.upper, 5)} L=${fmt(last.lower, 5)}` : '—',
    });
  }

  // RSI
  {
    const vals = idx.map((i) => b.rsi[i]).filter((v): v is number => v !== null);
    const os = vals.some((v) => v <= cfg.rsiLower);
    const ob = vals.some((v) => v >= cfg.rsiUpper);
    const vote: Vote = os && !ob ? 'CALL' : ob && !os ? 'PUT' : 'NEUTRAL';
    votes.push({
      key: 'RSI', label: `RSI ${cfg.rsiPeriod}P [${cfg.rsiUpper}/${cfg.rsiLower}]`, vote,
      reason: !vals.length ? 'Datos insuficientes' :
        vote === 'CALL' ? `Sobreventa (≤ ${cfg.rsiLower})` : vote === 'PUT' ? `Sobrecompra (≥ ${cfg.rsiUpper})` :
        os && ob ? 'Extremos opuestos en la ventana' : 'Zona media, sin extremo',
      values: vals.map((v) => fmt(v, 1)).join(' · ') || '—',
    });
  }

  // Estocástico
  {
    const vals = idx.map((i) => b.stoch[i]?.k ?? null).filter((v): v is number => v !== null);
    const os = vals.some((v) => v <= cfg.stochLower);
    const ob = vals.some((v) => v >= cfg.stochUpper);
    const vote: Vote = os && !ob ? 'CALL' : ob && !os ? 'PUT' : 'NEUTRAL';
    votes.push({
      key: 'STOCH', label: `Stochastic K=${cfg.stochK} [${cfg.stochUpper}/${cfg.stochLower}]`, vote,
      reason: !vals.length ? 'Datos insuficientes' :
        vote === 'CALL' ? `%K en sobreventa (≤ ${cfg.stochLower})` : vote === 'PUT' ? `%K en sobrecompra (≥ ${cfg.stochUpper})` :
        os && ob ? 'Extremos opuestos en la ventana' : 'Zona media, sin extremo',
      values: vals.map((v) => fmt(v, 1)).join(' · ') || '—',
    });
  }
  return votes;
}

export function riskFromConfluence(n: number): RiskLevel {
  if (n <= 0) return 'Sin confluencia';
  if (n === 1) return 'Riesgo Alto';
  if (n === 2) return 'Riesgo Moderado';
  return 'Riesgo Bajo relativo';
}

export function maxGaleForMode(mode: OperatingMode): 1 | 2 {
  return mode === 'FILTER_G1' ? 1 : 2;
}

/** Ley 1 (dirección por mayoría) + Ley 2 (nivel de confluencia y límite de ciclos). */
export function applyLaws(votes: IndicatorVote[], direction: Direction, cfg: IndicatorConfig, mode: OperatingMode) {
  const forCall = votes.filter((v) => v.vote === 'CALL').length;
  const forPut = votes.filter((v) => v.vote === 'PUT').length;
  const neutral = votes.length - forCall - forPut;
  const inFavor = direction === 'CALL' ? forCall : forPut;
  const against = direction === 'CALL' ? forPut : forCall;

  let verdict: Verdict;
  let ley1Reason: string;
  if (inFavor === 0 && against === 0) {
    verdict = 'REVISAR';
    ley1Reason = 'Todos los indicadores neutros: no hay evidencia a favor ni en contra.';
  } else if (inFavor > against) {
    verdict = 'APROBADA';
    ley1Reason = `Mayoría a favor de ${direction} (${inFavor} vs ${against}).`;
  } else if (against > inFavor) {
    verdict = 'DESCARTADA';
    ley1Reason = `La mayoría contradice la señal (${against} en contra vs ${inFavor} a favor).`;
  } else {
    verdict = cfg.tieRule;
    ley1Reason = `Empate técnico ${inFavor}-${against}: se aplica la regla configurada (${cfg.tieRule}).`;
  }

  const confluence = verdict === 'DESCARTADA' ? 0 : inFavor;
  const risk = riskFromConfluence(confluence);
  const maxGale = maxGaleForMode(mode);
  const ley2Reason =
    verdict === 'DESCARTADA' ? 'Señal descartada por Ley 1: no se opera, no se calcula ciclo.' :
    confluence === 0 ? 'Sin indicadores a favor: confluencia nula.' :
    `${confluence} indicador(es) a favor → ${risk}. ` +
      (mode === 'FILTER_G1' ? 'Con filtro de indicadores: máximo 1 ciclo (Gale 1).' : 'Modo copia sin filtro: hasta Gale 2 (sin Gale 3+).');

  return { forCall, forPut, neutral, inFavor, against, verdict, ley1Reason, confluence, risk, maxGale, ley2Reason } as const;
}

export function evaluateAt(
  candles: Candle[], t: number, direction: Direction, cfg: IndicatorConfig, mode: OperatingMode, bundle?: IndicatorBundle,
): Evaluation {
  const votes = voteIndicators(candles, t, cfg, bundle);
  const laws = applyLaws(votes, direction, cfg, mode);
  const windowTimes: number[] = [];
  for (let i = t - cfg.lookback; i < t; i++) if (i >= 0) windowTimes.push(candles[i].time);
  return { targetTime: candles[t]?.time ?? 0, windowTimes, votes, ...laws };
}
