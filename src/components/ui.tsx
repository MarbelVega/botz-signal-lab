import type { ReactNode } from 'react';
import type { Direction, Market, RiskLevel, SignalStatus, Verdict, Vote } from '../lib/types';

export function Card({ title, right, children, className = '' }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="card-title">
          <h2>{title}</h2>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function DirBadge({ d }: { d: Direction | Vote }) {
  const cls = d === 'CALL' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
    : d === 'PUT' ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/40'
    : 'bg-slate-700/50 text-slate-300 ring-1 ring-slate-600';
  const icon = d === 'CALL' ? '▲' : d === 'PUT' ? '▼' : '•';
  return <span className={`badge ${cls}`}>{icon} {d === 'NEUTRAL' ? 'NEUTRO' : d}</span>;
}

export function MarketBadge({ m }: { m: Market }) {
  return m === 'OTC'
    ? <span className="badge bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/50" title="Mercado OTC: precios del broker, fuera de mercado interbancario">OTC</span>
    : <span className="badge bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/40" title="Mercado REAL (interbancario)">REAL</span>;
}

const STATUS_CLS: Record<SignalStatus, string> = {
  Pendiente: 'bg-slate-700/60 text-slate-200',
  'Ganada Base': 'bg-emerald-600/30 text-emerald-200',
  'Ganada Gale 1': 'bg-emerald-700/25 text-emerald-300',
  'Ganada Gale 2': 'bg-lime-700/25 text-lime-300',
  Perdida: 'bg-red-700/30 text-red-200',
  Omitida: 'bg-violet-700/25 text-violet-200',
};
export const statusClass = (s: SignalStatus) => STATUS_CLS[s];

export function VerdictBadge({ v }: { v?: Verdict }) {
  if (!v) return <span className="text-slate-500">—</span>;
  const cls = v === 'APROBADA' ? 'bg-emerald-600 text-white' : v === 'DESCARTADA' ? 'bg-red-600 text-white' : 'bg-amber-500 text-slate-950';
  return <span className={`badge ${cls}`}>{v}</span>;
}

export function RiskBadge({ r }: { r: RiskLevel }) {
  const cls = r === 'Riesgo Bajo relativo' ? 'bg-emerald-500/20 text-emerald-300'
    : r === 'Riesgo Moderado' ? 'bg-amber-500/20 text-amber-300'
    : r === 'Riesgo Alto' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-300';
  return <span className={`badge ${cls}`}>{r}</span>;
}

export function NumberField({ label, value, onChange, step = 1, min, max, suffix, id }: {
  label: string; value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string; id: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input
          id={id} type="number" inputMode="decimal" className="input pr-8" step={step} min={min} max={max}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        />
        {suffix && <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  );
}

export const money = (n: number) =>
  Number.isFinite(n) ? n.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
