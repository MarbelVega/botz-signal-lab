import { useMemo } from 'react';
import { useNow } from '../hooks/useNow';
import { TIMEZONES, formatCountdown, formatInTz, offsetLabel, zonedToEpoch } from '../lib/time';
import type { Signal } from '../lib/types';
import { Card, DirBadge, MarketBadge } from './ui';

interface Props {
  displayTz: string;
  listTz: string;
  onTzChange: (tz: string) => void;
  signals: Signal[];
}

export function TimezoneClock({ displayTz, listTz, onTzChange, signals }: Props) {
  const now = useNow(1000);
  const toClose = (tf: number) => tf * 1000 - (now % (tf * 1000));

  const next = useMemo(() => {
    return signals
      .filter((s) => s.status === 'Pendiente')
      .map((s) => ({ s, at: zonedToEpoch(s.date, s.time, listTz) }))
      .filter((x) => x.at > now - 60_000)
      .sort((a, b) => a.at - b.at)[0];
  }, [signals, listTz, now]);

  const untilNext = next ? next.at - now : NaN;
  const urgent = next && untilNext <= 15_000 && untilNext > 0;

  return (
    <Card title="Reloj operativo" right={<span className="text-[11px] font-normal normal-case text-slate-500">Lista en {offsetLabel(listTz, now)}</span>}>
      <label className="label" htmlFor="tz">Zona horaria de visualización</label>
      <select id="tz" className="input mb-3" value={displayTz} onChange={(e) => onTzChange(e.target.value)}>
        {TIMEZONES.map((t) => (
          <option key={t.id} value={t.id}>{'featured' in t && t.featured ? '★ ' : ''}{t.label}</option>
        ))}
      </select>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-mono text-4xl font-bold tabular-nums text-white" aria-live="off">
            {formatInTz(now, displayTz, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-xs text-slate-400">
            {formatInTz(now, displayTz, { weekday: 'long', day: '2-digit', month: 'short' })} · {offsetLabel(displayTz, now)}
          </div>
        </div>
        {displayTz !== 'America/Sao_Paulo' && (
          <div className="text-right">
            <div className="font-mono text-lg tabular-nums text-amber-300">{formatInTz(now, 'America/Sao_Paulo', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
            <div className="text-[11px] text-slate-500">UTC-3 (señales)</div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {[{ l: 'Cierre vela M1', tf: 60 }, { l: 'Cierre vela M5', tf: 300 }].map((x) => (
          <div key={x.l} className="rounded-xl bg-slate-950/70 p-2.5 text-center ring-1 ring-slate-800">
            <div className="text-[11px] text-slate-400">{x.l}</div>
            <div className="font-mono text-xl tabular-nums">{formatCountdown(toClose(x.tf))}</div>
          </div>
        ))}
      </div>

      <div className={`mt-2 rounded-xl p-2.5 ring-1 ${urgent ? 'animate-pulse bg-emerald-900/40 ring-emerald-500' : 'bg-slate-950/70 ring-slate-800'}`} aria-live="polite">
        <div className="text-[11px] text-slate-400">Próxima señal pendiente</div>
        {next ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm">
              <span className="font-mono">{next.s.time}</span>
              <span className="font-semibold">{next.s.asset}</span>
              <MarketBadge m={next.s.market} />
              <DirBadge d={next.s.direction} />
              <span className="text-xs text-slate-400">{next.s.expiry}</span>
            </div>
            <span className="font-mono text-xl tabular-nums">{untilNext > 0 ? formatCountdown(untilNext) : 'EN CURSO'}</span>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Sin señales pendientes próximas.</div>
        )}
      </div>
    </Card>
  );
}
