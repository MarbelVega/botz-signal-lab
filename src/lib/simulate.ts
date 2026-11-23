import { evaluateAt } from './evaluation';
import { computeAll } from './indicators';
import { fetchCandles, type DataSource } from './marketData';
import { expirySeconds, zonedToEpoch } from './time';
import type { Candle, Evaluation, IndicatorConfig, OperatingMode, Signal, SignalStatus } from './types';

export const HISTORY = 260; // velas de historia (EMA 100 necesita >= 100 + margen)

export interface SignalContext {
  candles: Candle[];
  targetIndex: number;
  evaluation: Evaluation | null;
  source: DataSource;
  note?: string;
  /** true si la vela objetivo (y sus ciclos) aún no han cerrado. */
  future: boolean;
  /** true si entre la última vela cerrada y la vela objetivo faltan velas: la evaluación es preliminar. */
  preliminary: boolean;
  /** true si la vela objetivo es un marcador (aún no existe). */
  placeholder: boolean;
}

/**
 * Obtiene velas alrededor de la señal: HISTORY velas antes + vela objetivo + 2 velas (Gale 1 y 2).
 * Nunca se usa información posterior a la vela objetivo para evaluar (solo para resolver el resultado).
 */
export async function loadSignalContext(
  s: Signal, listTz: string, cfg: IndicatorConfig, mode: OperatingMode, source: DataSource, nowMs = Date.now(),
): Promise<SignalContext> {
  const tf = expirySeconds(s.expiry);
  const target = Math.floor(zonedToEpoch(s.date, s.time, listTz) / 1000 / tf) * tf;
  const nowSec = Math.floor(nowMs / 1000);
  const lastClosed = Math.floor(nowSec / tf) * tf - tf;
  const end = Math.min(target + 2 * tf, lastClosed);
  const future = target + 2 * tf > lastClosed;
  // Para señales futuras se muestra el contexto hasta la última vela cerrada.
  const { candles, source: used, note } = await fetchCandles(source, s.asset, s.market, s.expiry, end, HISTORY + 3);
  let targetIndex = candles.findIndex((c) => c.time === target);
  let evalCandles = candles;
  let preliminary = false;
  let placeholder = false;
  if (targetIndex === -1) {
    // Vela objetivo aún no existe: se agrega un marcador (no se usa para votar).
    const last = candles[candles.length - 1];
    preliminary = last.time < target - tf;
    placeholder = true;
    evalCandles = [...candles, { ...last, open: last.close, high: last.close, low: last.close, time: target }];
    targetIndex = evalCandles.length - 1;
  }
  let evaluation: Evaluation | null = null;
  if (targetIndex >= cfg.lookback) {
    // Todos los indicadores son causales y los fractales solo se leen confirmados antes de t: sin look-ahead.
    evaluation = evaluateAt(evalCandles, targetIndex, s.direction, cfg, mode, computeAll(evalCandles, cfg));
  }
  return { candles: evalCandles, targetIndex, evaluation, source: used, note, future, preliminary, placeholder };
}

/** Resultado de mercado puro: la vela L (0 = base) gana si cierra a favor. Doji = pérdida (conservador). */
export function rawOutcome(candles: Candle[], t: number, direction: 'CALL' | 'PUT'): Exclude<SignalStatus, 'Pendiente' | 'Omitida'> | null {
  const labels = ['Ganada Base', 'Ganada Gale 1', 'Ganada Gale 2'] as const;
  for (let L = 0; L < 3; L++) {
    const c = candles[t + L];
    if (!c) return null;
    const win = direction === 'CALL' ? c.close > c.open : c.close < c.open;
    if (win) return labels[L];
  }
  return 'Perdida';
}

export interface ResolveOptions {
  mode: OperatingMode;
  /** En modo filtro: ¿operar señales en estado REVISAR? (por defecto no) */
  operateOnReview: boolean;
}

/** Aplica Ley 1 / Ley 2 y el límite de ciclos del modo para obtener el estado final. */
export function resolveStatus(
  raw: Exclude<SignalStatus, 'Pendiente' | 'Omitida'>, ev: Evaluation | null, opt: ResolveOptions,
): SignalStatus {
  if (opt.mode === 'FILTER_G1' && ev) {
    if (ev.verdict === 'DESCARTADA') return 'Omitida';
    if (ev.verdict === 'REVISAR' && !opt.operateOnReview) return 'Omitida';
  }
  const maxG = opt.mode === 'FILTER_G1' ? 1 : 2;
  const level = raw === 'Ganada Base' ? 0 : raw === 'Ganada Gale 1' ? 1 : raw === 'Ganada Gale 2' ? 2 : 99;
  return level <= maxG ? raw : 'Perdida';
}

export async function simulateSignal(
  s: Signal, listTz: string, cfg: IndicatorConfig, opt: ResolveOptions, source: DataSource, nowMs = Date.now(),
): Promise<Signal> {
  const ctx = await loadSignalContext(s, listTz, cfg, opt.mode, source, nowMs);
  if (ctx.future) return { ...s, verdict: ctx.evaluation?.verdict, confluence: ctx.evaluation?.confluence, status: 'Pendiente' };
  const raw = rawOutcome(ctx.candles, ctx.targetIndex, s.direction);
  if (!raw) return { ...s, status: 'Pendiente' };
  return {
    ...s, rawOutcome: raw, verdict: ctx.evaluation?.verdict, confluence: ctx.evaluation?.confluence,
    status: resolveStatus(raw, ctx.evaluation, opt),
  };
}
