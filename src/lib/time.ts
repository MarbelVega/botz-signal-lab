export const TIMEZONES = [
  { id: 'America/Sao_Paulo', label: 'UTC-3 · America/Sao_Paulo (lista de señales)', featured: true },
  { id: 'America/La_Paz', label: 'UTC-4 · America/La_Paz' },
  { id: 'UTC', label: 'UTC±0 · UTC' },
  { id: 'America/Argentina/Buenos_Aires', label: 'UTC-3 · Buenos Aires' },
  { id: 'America/Bogota', label: 'UTC-5 · Bogotá / Lima' },
  { id: 'America/Mexico_City', label: 'UTC-6 · Ciudad de México' },
  { id: 'Europe/Madrid', label: 'CET · Madrid' },
] as const;

/** Offset en minutos (zona - UTC) para un instante dado. Ej: Sao_Paulo => -180. */
export function tzOffsetMinutes(tz: string, epochMs: number): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / 60000);
}

/** Convierte fecha+hora "de pared" en una zona a epoch ms (UTC). */
export function zonedToEpoch(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, 0);
  let off = tzOffsetMinutes(tz, guess);
  let epoch = guess - off * 60000;
  const off2 = tzOffsetMinutes(tz, epoch);
  if (off2 !== off) { off = off2; epoch = guess - off * 60000; }
  return epoch;
}

export function formatInTz(epochMs: number, tz: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('es-BO', { timeZone: tz, hourCycle: 'h23', ...opts }).format(new Date(epochMs));
}

export function hhmm(epochMs: number, tz: string) {
  return formatInTz(epochMs, tz, { hour: '2-digit', minute: '2-digit' });
}

export function todayInTz(tz: string, epochMs = Date.now()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
      .formatToParts(new Date(epochMs)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export function offsetLabel(tz: string, epochMs = Date.now()): string {
  const off = tzOffsetMinutes(tz, epochMs);
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `UTC${sign}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''}`;
}

export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return '—';
  const neg = ms < 0;
  let s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const core = `${h > 0 ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return neg ? `-${core}` : core;
}

export const expirySeconds = (e: 'M1' | 'M5') => (e === 'M5' ? 300 : 60);
