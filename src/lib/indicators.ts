import type { Candle } from './types';

export type Series = (number | null)[];

/** EMA clásica, semilla = SMA de los primeros `period` valores. */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export interface BollingerPoint { upper: number; middle: number; lower: number }

/** Bandas de Bollinger (desviación estándar poblacional, como MT4/TradingView). */
export function bollinger(values: number[], period = 20, mult = 2): (BollingerPoint | null)[] {
  const out: (BollingerPoint | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const win = values.slice(i - period + 1, i + 1);
    const mean = win.reduce((a, b) => a + b, 0) / period;
    const variance = win.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    out[i] = { upper: mean + mult * sd, middle: mean, lower: mean - mult * sd };
  }
  return out;
}

/** RSI de Wilder. */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  out[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

export interface StochPoint { k: number; d: number | null }

/**
 * Estocástico lento: %K bruto(kPeriod) suavizado con SMA(smooth); %D = SMA(dPeriod) de %K.
 * Con smooth = 1 se obtiene el estocástico rápido.
 */
export function stochastic(candles: Candle[], kPeriod = 6, dPeriod = 3, smooth = 3): (StochPoint | null)[] {
  const n = candles.length;
  const rawK: Series = new Array(n).fill(null);
  for (let i = kPeriod - 1; i < n; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      hh = Math.max(hh, candles[j].high);
      ll = Math.min(ll, candles[j].low);
    }
    rawK[i] = hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100;
  }
  const smoothSeries = (src: Series, p: number): Series => {
    const out: Series = new Array(src.length).fill(null);
    for (let i = 0; i < src.length; i++) {
      if (i < p - 1) continue;
      const win = src.slice(i - p + 1, i + 1);
      if (win.some((v) => v === null)) continue;
      out[i] = (win as number[]).reduce((a, b) => a + b, 0) / p;
    }
    return out;
  };
  const k = smooth > 1 ? smoothSeries(rawK, smooth) : rawK;
  const d = smoothSeries(k, dPeriod);
  return k.map((kv, i) => (kv === null ? null : { k: kv, d: d[i] }));
}

export type FractalType = 'UP' | 'DOWN' | 'BOTH' | null;

/**
 * Fractales de Bill Williams con periodo configurable.
 * period = 6 -> 3 velas a cada lado (half = ceil(period/2)); period = 5 -> 2 a cada lado (clásico).
 * Un fractal en la vela i solo está CONFIRMADO cuando ya cerraron `half` velas a su derecha.
 */
export function fractals(candles: Candle[], period = 6): FractalType[] {
  const half = Math.max(1, Math.ceil((period - 1) / 2));
  const out: FractalType[] = new Array(candles.length).fill(null);
  for (let i = half; i < candles.length - half; i++) {
    let up = true;
    let down = true;
    for (let j = 1; j <= half; j++) {
      if (!(candles[i].high > candles[i - j].high && candles[i].high >= candles[i + j].high)) up = false;
      if (!(candles[i].low < candles[i - j].low && candles[i].low <= candles[i + j].low)) down = false;
    }
    out[i] = up && down ? 'BOTH' : up ? 'UP' : down ? 'DOWN' : null;
  }
  return out;
}

export function fractalHalf(period: number): number {
  return Math.max(1, Math.ceil((period - 1) / 2));
}

export interface IndicatorBundle {
  ema: Series;
  bb: (BollingerPoint | null)[];
  rsi: Series;
  stoch: (StochPoint | null)[];
  fractals: FractalType[];
}

export function computeAll(
  candles: Candle[],
  cfg: { emaPeriod: number; bbPeriod: number; bbStdDev: number; rsiPeriod: number; stochK: number; stochD: number; stochSmooth: number; fractalPeriod: number },
): IndicatorBundle {
  const closes = candles.map((c) => c.close);
  return {
    ema: ema(closes, cfg.emaPeriod),
    bb: bollinger(closes, cfg.bbPeriod, cfg.bbStdDev),
    rsi: rsi(closes, cfg.rsiPeriod),
    stoch: stochastic(candles, cfg.stochK, cfg.stochD, cfg.stochSmooth),
    fractals: fractals(candles, cfg.fractalPeriod),
  };
}
