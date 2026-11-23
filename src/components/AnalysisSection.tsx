import { useEffect, useMemo, useState } from 'react';
import { applyLaws, voteIndicators } from '../lib/evaluation';
import { computeAll } from '../lib/indicators';
import { KNOWN_ASSETS, type DataSource } from '../lib/marketData';
import { loadSignalContext, type SignalContext } from '../lib/simulate';
import { formatInTz, todayInTz, hhmm, tzOffsetMinutes } from '../lib/time';
import type { Direction, Expiry, IndicatorConfig, Market, OperatingMode, Signal } from '../lib/types';
import { PriceCharts } from './PriceCharts';
import { Card, DirBadge, MarketBadge, RiskBadge, VerdictBadge } from './ui';

interface Props {
  signal: Signal | null;
  listTz: string;
  displayTz: string;
  cfg: IndicatorConfig;
  mode: OperatingMode;
  dataSource: DataSource;
  onClose: () => void;
}

/** Señal "sonda" cuando no hay una seleccionada: evalúa la PRÓXIMA vela del activo elegido. */
function probeSignal(asset: string, market: Market, expiry: Expiry, direction: Direction, listTz: string): Signal {
  const tf = expiry === 'M5' ? 300 : 60;
  const next = (Math.floor(Date.now() / 1000 / tf) + 1) * tf * 1000;
  return { id: 'probe', date: todayInTz(listTz, next), time: hhmm(next, listTz), asset, market, expiry, direction, status: 'Pendiente', createdAt: Date.now() };
}

export function AnalysisSection({ signal, listTz, displayTz, cfg, mode, dataSource, onClose }: Props) {
  const [probe, setProbe] = useState({ asset: 'EUR/AUD', market: 'REAL' as Market, expiry: 'M1' as Expiry });
  const [dirOverride, setDirOverride] = useState<Direction | null>(null);
  const [pickedTime, setPickedTime] = useState<number | null>(null);
  const [ctx, setCtx] = useState<SignalContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const baseSignal = useMemo(
    () => signal ?? probeSignal(probe.asset, probe.market, probe.expiry, 'CALL', listTz),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signal, probe, listTz, refreshKey],
  );
  const direction: Direction = dirOverride ?? baseSignal.direction;

  useEffect(() => { setDirOverride(null); setPickedTime(null); }, [signal?.id]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    loadSignalContext(baseSignal, listTz, cfg, mode, dataSource)
      .then((c) => { if (alive) setCtx(c); })
      .catch((e: Error) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [baseSignal, listTz, cfg, mode, dataSource]);

  const bundle = useMemo(() => (ctx ? computeAll(ctx.candles, cfg) : null), [ctx, cfg]);

  const targetIndex = useMemo(() => {
    if (!ctx) return -1;
    if (pickedTime !== null) {
      const i = ctx.candles.findIndex((c) => c.time === pickedTime);
      if (i >= cfg.lookback) return i;
    }
    return ctx.targetIndex;
  }, [ctx, pickedTime, cfg.lookback]);

  const evaluation = useMemo(() => {
    if (!ctx || !bundle || targetIndex < cfg.lookback) return null;
    const votes = voteIndicators(ctx.candles, targetIndex, cfg, bundle);
    return { votes, ...applyLaws(votes, direction, cfg, mode) };
  }, [ctx, bundle, targetIndex, direction, cfg, mode]);

  const shiftSec = tzOffsetMinutes(displayTz, Date.now()) * 60;
  const target = ctx?.candles[targetIndex];
  const placeholder = Boolean(ctx?.placeholder && targetIndex === ctx.targetIndex);

  return (
    <Card
      title="Motor de evaluación · 3 velas + Ley 1 / Ley 2"
      right={signal ? <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={onClose}>Modo sonda</button> : null}
    >
      <div className="mb-3 flex flex-wrap items-end gap-2">
        {signal ? (
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="text-slate-400">Señal:</span>
            <span className="font-mono">{signal.date} {signal.time}</span>
            <span className="font-semibold">{signal.asset}</span>
            <MarketBadge m={signal.market} />
            <span className="text-slate-400">{signal.expiry}</span>
            <DirBadge d={signal.direction} />
          </div>
        ) : (
          <>
            <div><label className="label" htmlFor="p-asset">Activo (sonda)</label>
              <select id="p-asset" className="input" value={probe.asset} onChange={(e) => setProbe({ ...probe, asset: e.target.value })}>
                {KNOWN_ASSETS.map((a) => <option key={a}>{a}</option>)}
              </select></div>
            <div><label className="label" htmlFor="p-mkt">Mercado</label>
              <select id="p-mkt" className="input" value={probe.market} onChange={(e) => setProbe({ ...probe, market: e.target.value as Market })}><option>REAL</option><option>OTC</option></select></div>
            <div><label className="label" htmlFor="p-exp">Velas</label>
              <select id="p-exp" className="input" value={probe.expiry} onChange={(e) => setProbe({ ...probe, expiry: e.target.value as Expiry })}><option>M1</option><option>M5</option></select></div>
            <button type="button" className="btn-ghost" onClick={() => { setPickedTime(null); setRefreshKey((k) => k + 1); }}>↻ Actualizar</button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Dirección a evaluar">
          {(['CALL', 'PUT'] as const).map((d) => (
            <button key={d} type="button" aria-pressed={direction === d}
              className={`btn px-3 ${direction === d ? (d === 'CALL' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white') : 'border border-slate-700 text-slate-300'}`}
              onClick={() => setDirOverride(d)}>{d === 'CALL' ? '▲' : '▼'} {d}</button>
          ))}
        </div>
      </div>

      {ctx?.note && <p className="mb-2 text-xs text-amber-300">{ctx.note}</p>}
      {ctx?.preliminary && pickedTime === null && (
        <p className="mb-2 text-xs text-amber-300">La vela objetivo aún está lejos en el futuro: la evaluación usa las últimas velas cerradas y es preliminar.</p>
      )}
      {error && <p className="mb-2 text-xs text-red-400">Error cargando velas: {error}</p>}

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="relative xl:col-span-3">
          {loading && <div className="absolute inset-0 z-10 grid place-items-center bg-slate-900/60 text-sm text-slate-300">Cargando velas…</div>}
          {ctx && (
            <PriceCharts candles={ctx.candles} bundle={bundle} targetIndex={targetIndex} lookback={cfg.lookback} cfg={cfg}
              shiftSec={shiftSec} placeholderTarget={placeholder} onPickTarget={(t) => setPickedTime(t)} />
          )}
          <div className="mt-1 text-[11px] text-slate-500">
            Fuente: {ctx?.source === 'BINANCE' ? 'Binance (público)' : 'Mock determinista'} · Vela objetivo:{' '}
            {target ? formatInTz(target.time * 1000, displayTz, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—'}
            {pickedTime !== null && <button type="button" className="ml-2 underline" onClick={() => setPickedTime(null)}>restablecer objetivo</button>}
          </div>
        </div>

        <div className="xl:col-span-2" aria-live="polite">
          {!evaluation ? (
            <p className="text-sm text-slate-500">Sin datos suficientes para evaluar.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-emerald-950/50 p-2 ring-1 ring-emerald-800"><div className="text-[11px] text-emerald-300">A favor CALL</div><div className="font-mono text-2xl font-bold">{evaluation.forCall}</div></div>
                <div className="rounded-xl bg-red-950/50 p-2 ring-1 ring-red-800"><div className="text-[11px] text-red-300">A favor PUT</div><div className="font-mono text-2xl font-bold">{evaluation.forPut}</div></div>
                <div className="rounded-xl bg-slate-950/70 p-2 ring-1 ring-slate-700"><div className="text-[11px] text-slate-400">Neutros</div><div className="font-mono text-2xl font-bold">{evaluation.neutral}</div></div>
              </div>

              <ul className="mt-3 divide-y divide-slate-800 rounded-xl ring-1 ring-slate-800">
                {evaluation.votes.map((v) => {
                  const agrees = v.vote === direction;
                  const against = v.vote !== 'NEUTRAL' && !agrees;
                  return (
                    <li key={v.key} className={`flex items-start gap-2 px-3 py-2 ${agrees ? 'bg-emerald-950/30' : against ? 'bg-red-950/30' : ''}`}>
                      <div className="w-24 shrink-0"><DirBadge d={v.vote} /></div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{v.label}</div>
                        <div className="text-xs text-slate-400">{v.reason}</div>
                        <div className="truncate font-mono text-[10px] text-slate-500">{v.values}</div>
                      </div>
                      <span className="text-xs" aria-label={agrees ? 'a favor' : against ? 'en contra' : 'neutro'}>{agrees ? '✔' : against ? '✖' : '–'}</span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-slate-400">Ley 1 · Dirección</span><VerdictBadge v={evaluation.verdict} /></div>
                  <p className="mt-1 text-sm">{evaluation.ley1Reason}</p>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-800" aria-hidden>
                    <div className="bg-emerald-500" style={{ width: `${(evaluation.inFavor / 5) * 100}%` }} />
                    <div className="bg-slate-600" style={{ width: `${(evaluation.neutral / 5) * 100}%` }} />
                    <div className="bg-red-500" style={{ width: `${(evaluation.against / 5) * 100}%` }} />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-slate-500"><span>{evaluation.inFavor} a favor</span><span>{evaluation.against} en contra</span></div>
                </div>
                <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase text-slate-400">Ley 2 · Confluencia</span><RiskBadge r={evaluation.risk} /></div>
                  <p className="mt-1 text-sm">{evaluation.ley2Reason}</p>
                  <div className="mt-2 flex gap-1" aria-label={`${evaluation.confluence} de 5 indicadores`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2 flex-1 rounded ${n <= evaluation.confluence ? (evaluation.confluence >= 3 ? 'bg-emerald-500' : evaluation.confluence === 2 ? 'bg-amber-500' : 'bg-red-500') : 'bg-slate-800'}`} />
                    ))}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">1-2 = Alto/Moderado · 3-5 = Bajo relativo · {mode === 'FILTER_G1' ? 'máx. Gale 1' : 'hasta Gale 2'}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
