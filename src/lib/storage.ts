import type { IndicatorConfig, RiskConfig, Signal } from './types';
import { getSupabase } from './supabase';

/**
 * Persistencia "local-first":
 *  - localStorage es SIEMPRE la fuente de verdad (la app arranca sin credenciales).
 *  - Si existen VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, se puede sincronizar con Supabase
 *    (tablas signals, user_settings, simulation_log; ver supabase/schema.sql) con RLS por usuario.
 */
const K = {
  signals: 'botz.signals.v1',
  settings: 'botz.settings.v1',
  log: 'botz.simlog.v1',
} as const;

export interface AppSettings {
  displayTz: string;
  listTz: string;
  risk: RiskConfig;
  indicators: IndicatorConfig;
  dataSource: 'MOCK' | 'BINANCE';
  blockMarketMix: boolean;
  operateOnReview: boolean;
  winProbAssumption: number;
}

export interface SimLogEntry {
  id: string;
  at: number;
  action: string;
  detail: string;
}

export function loadLocal<T>(key: keyof typeof K, fallback: T): T {
  try {
    const raw = localStorage.getItem(K[key]);
    return raw ? ({ ...(fallback as object), ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadLocalArray<T>(key: keyof typeof K): T[] {
  try {
    const raw = localStorage.getItem(K[key]);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveLocal(key: keyof typeof K, value: unknown) {
  try { localStorage.setItem(K[key], JSON.stringify(value)); } catch { /* cuota llena / modo privado */ }
}

// ----------------------- Supabase (opcional) -----------------------
type Row = Record<string, unknown>;

const toRow = (s: Signal, owner: string): Row => ({
  id: s.id, owner, date: s.date, time: s.time, asset: s.asset, market: s.market, expiry: s.expiry,
  direction: s.direction, status: s.status, raw_outcome: s.rawOutcome ?? null, verdict: s.verdict ?? null,
  confluence: s.confluence ?? null, note: s.note ?? null, created_at: new Date(s.createdAt).toISOString(),
});

const fromRow = (r: Row): Signal => ({
  id: String(r.id), date: String(r.date), time: String(r.time).slice(0, 5), asset: String(r.asset),
  market: r.market as Signal['market'], expiry: r.expiry as Signal['expiry'], direction: r.direction as Signal['direction'],
  status: r.status as Signal['status'], rawOutcome: (r.raw_outcome ?? undefined) as Signal['rawOutcome'],
  verdict: (r.verdict ?? undefined) as Signal['verdict'], confluence: (r.confluence ?? undefined) as number | undefined,
  note: (r.note ?? undefined) as string | undefined, createdAt: Date.parse(String(r.created_at)) || Date.now(),
});

async function session() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Supabase no configurado (.env)');
  const { data } = await sb.auth.getSession();
  if (data.session) return { sb, uid: data.session.user.id };
  const { data: anon, error } = await sb.auth.signInAnonymously();
  if (error || !anon.user) throw new Error(`Auth anónima falló: ${error?.message ?? 'sin usuario'}`);
  return { sb, uid: anon.user.id };
}

export async function cloudPush(signals: Signal[], settings: AppSettings, log: SimLogEntry[]) {
  const { sb, uid } = await session();
  const del = await sb.from('signals').delete().eq('owner', uid);
  if (del.error) throw del.error;
  if (signals.length) {
    const ins = await sb.from('signals').insert(signals.map((s) => toRow(s, uid)));
    if (ins.error) throw ins.error;
  }
  const up = await sb.from('user_settings').upsert({ owner: uid, settings, updated_at: new Date().toISOString() });
  if (up.error) throw up.error;
  const last = log.slice(0, 50).map((l) => ({ id: l.id, owner: uid, at: new Date(l.at).toISOString(), action: l.action, detail: l.detail }));
  if (last.length) {
    const lg = await sb.from('simulation_log').upsert(last);
    if (lg.error) throw lg.error;
  }
  return { count: signals.length };
}

export async function cloudPull(): Promise<{ signals: Signal[]; settings: AppSettings | null }> {
  const { sb, uid } = await session();
  const s = await sb.from('signals').select('*').eq('owner', uid).order('date').order('time');
  if (s.error) throw s.error;
  const st = await sb.from('user_settings').select('settings').eq('owner', uid).maybeSingle();
  if (st.error) throw st.error;
  return { signals: (s.data ?? []).map(fromRow), settings: (st.data?.settings as AppSettings) ?? null };
}
