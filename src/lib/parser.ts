import type { Direction, Expiry, Market, Signal } from './types';
import { uid } from './uid';

export interface ParseResult {
  signals: Signal[];
  errors: { line: number; text: string; reason: string }[];
}

const DIR_CALL = /\b(CALL|COMPRA|BUY|ARRIBA|UP)\b|🟢|⬆️?|↑/i;
const DIR_PUT = /\b(PUT|VENTA|SELL|ABAJO|DOWN)\b|🔴|⬇️?|↓/i;

export function normalizeAsset(raw: string): { asset: string; market: Market } | null {
  const up = raw.toUpperCase();
  const market: Market = /OTC/.test(up) ? 'OTC' : 'REAL';
  const cleaned = up.replace(/OTC/g, ' ').replace(/[-_]/g, ' ');
  let m = cleaned.match(/\b([A-Z]{3,5})\s*\/\s*([A-Z]{3,5})\b/);
  if (m) return { asset: `${m[1]}/${m[2]}`, market };
  m = cleaned.match(/\b([A-Z]{3})([A-Z]{3,4})\b/);
  if (m) return { asset: `${m[1]}/${m[2]}`, market };
  return null;
}

/**
 * Parser tolerante de "tuplas". Ejemplos válidos (una señal por línea):
 *   M5;EUR/AUD;14:30;CALL
 *   14:30 - EUR/GBP OTC - PUT - M1
 *   EURUSD-OTC 09:15 CALL M5
 *   2026-11-23 10:05 GBP/CHF PUT M1
 * Líneas vacías o que comienzan con # / // se ignoran.
 */
export function parseSignals(text: string, defaultDate: string): ParseResult {
  const res: ParseResult = { signals: [], errors: [] };
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const up = line.toUpperCase();

    const time = up.match(/\b([01]?\d|2[0-3])[:hH.]([0-5]\d)\b/);
    if (!time) return res.errors.push({ line: i + 1, text: line, reason: 'Hora HH:MM no encontrada' });
    const hhmm = `${time[1].padStart(2, '0')}:${time[2]}`;

    let date = defaultDate;
    const iso = up.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    const dmy = up.match(/\b(\d{2})\/(\d{2})(?:\/(20\d{2}))?\b/);
    if (iso) date = `${iso[1]}-${iso[2]}-${iso[3]}`;
    else if (dmy && !/[A-Z]/.test(dmy[0])) date = `${dmy[3] ?? defaultDate.slice(0, 4)}-${dmy[2]}-${dmy[1]}`;

    const isCall = DIR_CALL.test(line);
    const isPut = DIR_PUT.test(line);
    if (isCall === isPut) return res.errors.push({ line: i + 1, text: line, reason: 'Dirección CALL/PUT ausente o ambigua' });
    const direction: Direction = isCall ? 'CALL' : 'PUT';

    const exp = up.match(/\bM(1|5|15)\b/);
    if (exp && exp[1] === '15') return res.errors.push({ line: i + 1, text: line, reason: 'Solo se admite M1 o M5' });
    const expiry: Expiry = exp && exp[1] === '5' ? 'M5' : 'M1';

    const stripped = up
      .replace(/\b(CALL|PUT|COMPRA|VENTA|BUY|SELL|ARRIBA|ABAJO|UP|DOWN)\b/g, ' ')
      .replace(/\bM(1|5|15)\b/g, ' ')
      .replace(/\b\d{1,4}[-/:hH.]\d{2}([-/]\d{2,4})?\b/g, ' ');
    const a = normalizeAsset(stripped);
    if (!a) return res.errors.push({ line: i + 1, text: line, reason: 'Activo no reconocido (ej. EUR/AUD o EURGBP-OTC)' });

    res.signals.push({
      id: uid(), date, time: hhmm, asset: a.asset, market: a.market, expiry, direction,
      status: 'Pendiente', createdAt: Date.now(),
    });
  });
  return res;
}

/** Regla operativa: no mezclar REAL y OTC en una misma lista/sesión. */
export function detectMarketMix(signals: Pick<Signal, 'market'>[]): boolean {
  return new Set(signals.map((s) => s.market)).size > 1;
}
