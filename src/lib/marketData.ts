import type { Candle, Expiry, Market } from './types';
import { expirySeconds } from './time';

/**
 * Proveedor de datos de mercado.
 * - MOCK (por defecto): serie sintética DETERMINISTA y SIN ESTADO -> price(t) es función pura del tiempo
 *   y del activo, por lo que cualquier ventana consultada es consistente (misma vela = mismo OHLC siempre).
 * - BINANCE (opcional): velas públicas de criptomonedas (BTC/USDT, ETH/USDT...) desde data-api.binance.vision,
 *   endpoint público de solo lectura, sin API key. Si falla, se hace fallback a MOCK.
 */
export type DataSource = 'MOCK' | 'BINANCE';

const BASE_PRICES: Record<string, number> = {
  'EUR/AUD': 1.652, 'EUR/GBP': 0.8435, 'GBP/CHF': 1.1268, 'EUR/USD': 1.0842, 'GBP/USD': 1.2711,
  'USD/JPY': 151.32, 'AUD/CAD': 0.9124, 'USD/CHF': 0.8813, 'AUD/USD': 0.6563, 'NZD/USD': 0.5951,
  'EUR/JPY': 164.05, 'USD/CAD': 1.3866, 'BTC/USDT': 64000, 'ETH/USDT': 3200,
};

function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Hash entero -> [0,1) (xorshift-mult). */
function rnd(seed: number, n: number): number {
  let x = (seed ^ Math.imul(n | 0, 0x9e3779b1)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Value-noise 1D suavizado en [-1,1]. */
function vnoise(seed: number, x: number): number {
  const i = Math.floor(x); const f = x - i; const u = f * f * (3 - 2 * f);
  const a = rnd(seed, i) * 2 - 1; const b = rnd(seed, i + 1) * 2 - 1;
  return a + (b - a) * u;
}

function priceAt(asset: string, market: Market, tSec: number): number {
  const key = asset.toUpperCase();
  const base = BASE_PRICES[key] ?? 1 + (hash32(key) % 1000) / 1000;
  const seed = hash32(`${key}|${market}`);
  const vol = market === 'OTC' ? 1.6 : 1.0;
  const m = tSec / 60; // minutos
  // Octavas: macro tendencia (horas), swing (decenas de min), ruido (min / sub-min)
  const n =
    0.0040 * vnoise(seed, m / 240) +
    0.0018 * vnoise(seed + 1, m / 45) +
    0.0009 * vnoise(seed + 2, m / 12) +
    0.00045 * vnoise(seed + 3, m / 3) +
    0.00025 * vnoise(seed + 4, m) +
    0.00012 * vnoise(seed + 5, m * 4);
  return base * (1 + n * vol);
}

export function mockCandles(asset: string, market: Market, expiry: Expiry, endTimeSec: number, count: number): Candle[] {
  const tf = expirySeconds(expiry);
  const end = Math.floor(endTimeSec / tf) * tf;
  const steps = 6;
  const seed = hash32(`${asset}|${market}|wick`);
  const out: Candle[] = [];
  for (let k = count - 1; k >= 0; k--) {
    const t = end - k * tf;
    const open = priceAt(asset, market, t);
    const close = priceAt(asset, market, t + tf);
    let hi = Math.max(open, close); let lo = Math.min(open, close);
    for (let s = 1; s < steps; s++) {
      const p = priceAt(asset, market, t + (tf * s) / steps);
      hi = Math.max(hi, p); lo = Math.min(lo, p);
    }
    const body = Math.max(hi - lo, open * 0.00005);
    hi += body * 0.25 * rnd(seed, t);
    lo -= body * 0.25 * rnd(seed + 7, t);
    out.push({ time: t, open, high: hi, low: lo, close });
  }
  return out;
}

const binanceInterval = (e: Expiry) => (e === 'M5' ? '5m' : '1m');

export function isCryptoAsset(asset: string) {
  return /\/(USDT|USDC|BTC)$/.test(asset.toUpperCase());
}

export async function fetchCandles(
  source: DataSource, asset: string, market: Market, expiry: Expiry, endTimeSec: number, count: number,
): Promise<{ candles: Candle[]; source: DataSource; note?: string }> {
  if (source === 'BINANCE' && isCryptoAsset(asset) && market === 'REAL') {
    try {
      const symbol = asset.replace('/', '').toUpperCase();
      const url = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${binanceInterval(expiry)}&endTime=${endTimeSec * 1000 + 999}&limit=${Math.min(count, 1000)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as [number, string, string, string, string][];
      const candles = rows.map((r) => ({ time: Math.floor(r[0] / 1000), open: +r[1], high: +r[2], low: +r[3], close: +r[4] }));
      if (candles.length < 20) throw new Error('pocas velas');
      return { candles, source: 'BINANCE' };
    } catch (e) {
      return { candles: mockCandles(asset, market, expiry, endTimeSec, count), source: 'MOCK', note: `Binance no disponible (${(e as Error).message}); usando mock.` };
    }
  }
  const note = source === 'BINANCE' ? 'Binance solo aplica a cripto REAL (ej. BTC/USDT); usando mock.' : undefined;
  return { candles: mockCandles(asset, market, expiry, endTimeSec, count), source: 'MOCK', note };
}

export const KNOWN_ASSETS = Object.keys(BASE_PRICES);
