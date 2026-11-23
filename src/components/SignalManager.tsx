import { useMemo, useState, type FormEvent } from 'react';
import { KNOWN_ASSETS } from '../lib/marketData';
import { detectMarketMix, normalizeAsset, parseSignals } from '../lib/parser';
import { uid } from '../lib/uid';
import { todayInTz } from '../lib/time';
import type { Direction, Expiry, Market, Signal, SignalStatus } from '../lib/types';
import { SAMPLE_OTC, SAMPLE_REAL } from '../data/sampleSignals';
import { Card, DirBadge, MarketBadge, VerdictBadge, statusClass } from './ui';

const STATUSES: SignalStatus[] = ['Pendiente', 'Ganada Base', 'Ganada Gale 1', 'Ganada Gale 2', 'Perdida', 'Omitida'];

interface Props {
  signals: Signal[];
  listTz: string;
  blockMarketMix: boolean;
  selectedId: string | null;
  busy: boolean;
  onAdd: (s: Signal[]) => void;
  onUpdate: (id: string, patch: Partial<Signal>) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  onSimulate: (all: boolean) => void;
}

export function SignalManager(p: Props) {
  const [tab, setTab] = useState<'paste' | 'manual'>('paste');
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const today = todayInTz(p.listTz);
  const [form, setForm] = useState({ date: today, time: '', asset: 'EUR/AUD', market: 'REAL' as Market, expiry: 'M5' as Expiry, direction: 'CALL' as Direction });
  const [filter, setFilter] = useState<'ALL' | SignalStatus>('ALL');

  const mixed = useMemo(() => detectMarketMix(p.signals), [p.signals]);
  const existingMarket = p.signals[0]?.market;

  const guardMix = (incoming: Signal[]): Signal[] | null => {
    const all = [...p.signals, ...incoming];
    if (p.blockMarketMix && detectMarketMix(all)) {
      const target = existingMarket ?? incoming[0]?.market;
      setMsg({ tone: 'err', text: `Regla "no mezclar mercados": la sesión es ${target}. Se rechazaron las señales de otro mercado. Limpia la lista o desactiva la regla en Configuración.` });
      const kept = incoming.filter((s) => s.market === target);
      return kept.length ? kept : null;
    }
    return incoming;
  };

  const loadText = (t: string) => {
    const r = parseSignals(t, today);
    const ok = guardMix(r.signals);
    if (ok) p.onAdd(ok);
    const errs = r.errors.map((e) => `L${e.line}: ${e.reason}`).join(' · ');
    if (!p.blockMarketMix || !detectMarketMix([...p.signals, ...r.signals])) {
      setMsg(r.errors.length ? { tone: 'err', text: `${r.signals.length} señales cargadas, ${r.errors.length} con error → ${errs}` } : { tone: 'ok', text: `${r.signals.length} señales cargadas.` });
    }
    if (r.signals.length) setText('');
  };

  const addManual = (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{2}:\d{2}$/.test(form.time)) return setMsg({ tone: 'err', text: 'Hora inválida (HH:MM).' });
    const a = normalizeAsset(form.asset);
    if (!a) return setMsg({ tone: 'err', text: 'Activo inválido. Usa el formato EUR/AUD.' });
    const s: Signal = { id: uid(), date: form.date, time: form.time, asset: a.asset, market: form.market, expiry: form.expiry, direction: form.direction, status: 'Pendiente', createdAt: Date.now() };
    const ok = guardMix([s]);
    if (ok) { p.onAdd(ok); setMsg({ tone: 'ok', text: `Señal ${s.time} ${s.asset} ${s.direction} agregada.` }); }
  };

  const rows = useMemo(
    () => [...p.signals].filter((s) => filter === 'ALL' || s.status === filter).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [p.signals, filter],
  );

  return (
    <Card
      title={<span>Gestor de señales (tuplas) <span className="ml-1 font-normal normal-case text-slate-500">· {p.signals.length}</span></span>}
      right={
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="btn-primary" disabled={p.busy || !p.signals.length} onClick={() => p.onSimulate(false)}>
            {p.busy ? 'Simulando…' : '▶ Simular pendientes'}
          </button>
          <button type="button" className="btn-ghost" disabled={p.busy || !p.signals.length} onClick={() => p.onSimulate(true)}>↻ Re-simular todo</button>
          <button type="button" className="btn-danger" disabled={p.busy || !p.signals.length} onClick={() => { if (confirm('¿Eliminar todas las señales?')) p.onClear(); }}>Limpiar</button>
        </div>
      }
    >
      {mixed && (
        <div className="mb-3 rounded-lg border border-amber-600/60 bg-amber-950/50 px-3 py-2 text-xs text-amber-200" role="alert">
          ⚠ La lista mezcla mercados <b>REAL</b> y <b>OTC</b>. Regla operativa: no mezclar mercados en una misma sesión (precios OTC provienen del broker y no son comparables).
        </div>
      )}

      <div className="mb-3 flex gap-1 rounded-lg bg-slate-950/60 p-1 text-sm" role="tablist">
        {(['paste', 'manual'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t}
            className={`flex-1 rounded-md px-3 py-1.5 ${tab === t ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setTab(t)}>
            {t === 'paste' ? 'Pegar lista' : 'Añadir manual'}
          </button>
        ))}
      </div>

      {tab === 'paste' ? (
        <div>
          <label className="label" htmlFor="paste">Una señal por línea · horas en {p.listTz === 'America/Sao_Paulo' ? 'UTC-3' : p.listTz}. Formatos: <code>M5;EUR/AUD;14:30;CALL</code> · <code>14:30 - EUR/GBP OTC - PUT - M1</code> · <code>EURUSD-OTC 09:15 CALL M5</code></label>
          <textarea id="paste" rows={5} className="input font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={'M5;EUR/AUD;14:30;CALL\nM1;GBP/CHF;14:45;PUT'} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className="btn-primary" disabled={!text.trim()} onClick={() => loadText(text)}>Cargar lista</button>
            <button type="button" className="btn-ghost" onClick={() => setText(SAMPLE_REAL)}>Ejemplo REAL</button>
            <button type="button" className="btn-ghost" onClick={() => setText(SAMPLE_OTC)}>Ejemplo OTC</button>
          </div>
        </div>
      ) : (
        <form className="grid grid-cols-2 gap-2 sm:grid-cols-7" onSubmit={addManual}>
          <div className="col-span-2 sm:col-span-1"><label className="label" htmlFor="f-date">Fecha</label><input id="f-date" type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></div>
          <div><label className="label" htmlFor="f-time">Hora (lista)</label><input id="f-time" type="time" className="input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></div>
          <div className="col-span-1 sm:col-span-2"><label className="label" htmlFor="f-asset">Activo</label>
            <input id="f-asset" list="assets" className="input uppercase" value={form.asset} onChange={(e) => setForm({ ...form, asset: e.target.value })} required />
            <datalist id="assets">{KNOWN_ASSETS.map((a) => <option key={a} value={a} />)}</datalist>
          </div>
          <div><label className="label" htmlFor="f-mkt">Mercado</label><select id="f-mkt" className="input" value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as Market })}><option>REAL</option><option>OTC</option></select></div>
          <div><label className="label" htmlFor="f-exp">Expiración</label><select id="f-exp" className="input" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value as Expiry })}><option>M1</option><option>M5</option></select></div>
          <div><label className="label" htmlFor="f-dir">Dirección</label><select id="f-dir" className="input" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as Direction })}><option>CALL</option><option>PUT</option></select></div>
          <div className="col-span-2 sm:col-span-7"><button type="submit" className="btn-primary">+ Añadir señal</button></div>
        </form>
      )}

      {msg && <p className={`mt-2 text-xs ${msg.tone === 'ok' ? 'text-emerald-400' : 'text-red-400'}`} aria-live="polite">{msg.text}</p>}

      <div className="mt-4 flex items-center justify-between gap-2">
        <label className="text-xs text-slate-400" htmlFor="flt">Filtrar estado</label>
        <select id="flt" className="input max-w-[12rem]" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="ALL">Todos</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="mt-2 max-h-[26rem] overflow-auto rounded-xl ring-1 ring-slate-800">
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="sticky top-0 bg-slate-900">
            <tr>
              <th className="th">Hora (UTC-3)</th><th className="th">Activo</th><th className="th">Mercado</th><th className="th">Exp.</th>
              <th className="th">Dirección</th><th className="th">Filtro</th><th className="th">Estado</th><th className="th text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className={`border-t border-slate-800 ${p.selectedId === s.id ? 'bg-emerald-950/40' : 'hover:bg-slate-800/40'}`}>
                <td className="td font-mono">{s.time}<div className="text-[10px] text-slate-500">{s.date}</div></td>
                <td className="td font-semibold">{s.asset}</td>
                <td className="td"><MarketBadge m={s.market} /></td>
                <td className="td text-slate-300">{s.expiry}</td>
                <td className="td"><DirBadge d={s.direction} /></td>
                <td className="td"><VerdictBadge v={s.verdict} />{s.confluence ? <span className="ml-1 text-[10px] text-slate-400">{s.confluence}/5</span> : null}</td>
                <td className="td">
                  <select aria-label={`Estado ${s.time} ${s.asset}`} className={`rounded-md border-0 px-1.5 py-1 text-xs font-semibold ${statusClass(s.status)}`}
                    value={s.status} onChange={(e) => p.onUpdate(s.id, { status: e.target.value as SignalStatus })}>
                    {STATUSES.map((st) => <option key={st} className="bg-slate-900 text-slate-100">{st}</option>)}
                  </select>
                  {s.rawOutcome && s.status === 'Omitida' && <div className="text-[10px] text-slate-500">mercado: {s.rawOutcome}</div>}
                </td>
                <td className="td text-right">
                  <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => p.onSelect(s.id)}>Analizar</button>
                  <button type="button" className="ml-1 btn-ghost px-2 py-1 text-xs" aria-label="Eliminar" onClick={() => p.onDelete(s.id)}>✕</button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={8} className="td py-8 text-center text-slate-500">Sin señales. Pega una lista o usa un ejemplo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
