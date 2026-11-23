import { useEffect, useRef } from 'react';
import { ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from 'lightweight-charts';
import type { SessionMetrics as M } from '../lib/metrics';
import { tzOffsetMinutes } from '../lib/time';
import { Card, money } from './ui';

function Kpi({ label, value, sub, tone = 'text-white' }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-slate-950/70 p-3 ring-1 ring-slate-800">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`font-mono text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function SessionMetrics({ m, capital, displayTz, breakeven }: { m: M; capital: number; displayTz: string; breakeven: number }) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<'Baseline'> | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const c = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      rightPriceScale: { borderColor: '#334155' },
      timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false },
    });
    series.current = c.addBaselineSeries({
      baseValue: { type: 'price', price: capital },
      topLineColor: '#22c55e', topFillColor1: 'rgba(34,197,94,0.25)', topFillColor2: 'rgba(34,197,94,0.02)',
      bottomLineColor: '#ef4444', bottomFillColor1: 'rgba(239,68,68,0.02)', bottomFillColor2: 'rgba(239,68,68,0.25)',
    });
    chart.current = c;
    return () => { c.remove(); chart.current = null; series.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!series.current) return;
    series.current.applyOptions({ baseValue: { type: 'price', price: capital } });
    const pts = m.equity.map((p) => ({
      time: (p.time + tzOffsetMinutes(displayTz, p.time * 1000) * 60) as UTCTimestamp,
      value: p.value,
    }));
    const start = pts.length ? [{ time: (pts[0].time - 60) as UTCTimestamp, value: capital }, ...pts] : [];
    series.current.setData(start);
    chart.current?.timeScale().fitContent();
  }, [m.equity, capital, displayTz]);

  const wr = m.winRate;
  return (
    <Card title="Métricas de sesión (simuladas)">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Kpi label="Win rate" value={wr === null ? '—' : `${wr.toFixed(1)}%`}
          sub={`break-even por entrada ≈ ${(breakeven * 100).toFixed(1)}%`}
          tone={wr === null ? 'text-slate-400' : wr >= breakeven * 100 ? 'text-emerald-400' : 'text-red-400'} />
        <Kpi label="Ganadas" value={String(m.wins)} sub={`Base ${m.winsBase} · G1 ${m.winsG1} · G2 ${m.winsG2}`} tone="text-emerald-400" />
        <Kpi label="Pérdidas" value={String(m.losses)} sub={`DD máx ${money(m.maxDrawdown)}`} tone="text-red-400" />
        <Kpi label="Filtradas / evitadas" value={String(m.filtered)} sub={`${m.filteredWouldLose} habrían perdido`} tone="text-violet-300" />
        <Kpi label="P&L simulado" value={`${m.pnl >= 0 ? '+' : ''}${money(m.pnl)}`} sub={`capital ${money(capital)}`} tone={m.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'} />
        <Kpi label="Pendientes" value={String(m.pending)} sub={`total ${m.total}`} />
      </div>
      <div className="mt-3">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-400">Curva de equity simulada</div>
        <div ref={box} className="h-44 w-full" />
        {!m.equity.length && <p className="-mt-24 mb-16 text-center text-xs text-slate-500">Simula resultados para ver la curva.</p>}
      </div>
    </Card>
  );
}
