import type { AppSettings } from '../lib/storage';
import type { IndicatorConfig, TieRule } from '../lib/types';
import { DEFAULT_INDICATORS } from '../lib/types';
import { TIMEZONES } from '../lib/time';
import { Card, NumberField } from './ui';

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}

const FIELDS: { k: keyof IndicatorConfig; label: string; step?: number; min: number; max: number }[] = [
  { k: 'emaPeriod', label: 'EMA periodo', min: 2, max: 400 },
  { k: 'fractalPeriod', label: 'Fractals periodo', min: 3, max: 15 },
  { k: 'bbPeriod', label: 'Bollinger periodo', min: 2, max: 200 },
  { k: 'bbStdDev', label: 'Bollinger desv.', step: 0.1, min: 0.5, max: 5 },
  { k: 'rsiPeriod', label: 'RSI periodo', min: 2, max: 100 },
  { k: 'rsiUpper', label: 'RSI sobrecompra', min: 50, max: 99 },
  { k: 'rsiLower', label: 'RSI sobreventa', min: 1, max: 50 },
  { k: 'stochK', label: 'Stoch %K', min: 2, max: 100 },
  { k: 'stochD', label: 'Stoch %D', min: 1, max: 50 },
  { k: 'stochSmooth', label: 'Stoch suavizado', min: 1, max: 10 },
  { k: 'stochUpper', label: 'Stoch sobrecompra', min: 50, max: 99 },
  { k: 'stochLower', label: 'Stoch sobreventa', min: 1, max: 50 },
  { k: 'lookback', label: 'Velas previas', min: 1, max: 10 },
];

export function SettingsPanel({ settings, onChange }: Props) {
  const ind = settings.indicators;
  const setInd = (k: keyof IndicatorConfig, v: number) => {
    const f = FIELDS.find((x) => x.k === k)!;
    const val = Number.isFinite(v) ? Math.min(f.max, Math.max(f.min, v)) : (DEFAULT_INDICATORS[k] as number);
    onChange({ ...settings, indicators: { ...ind, [k]: val } });
  };
  return (
    <Card title="Configuración" right={<button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => onChange({ ...settings, indicators: DEFAULT_INDICATORS })}>Restablecer indicadores</button>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {FIELDS.map((f) => (
          <NumberField key={f.k} id={`cfg-${f.k}`} label={f.label} value={ind[f.k] as number} step={f.step ?? 1} min={f.min} max={f.max} onChange={(n) => setInd(f.k, n)} />
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="cfg-tie">Ley 1 · regla de empate</label>
          <select id="cfg-tie" className="input" value={ind.tieRule} onChange={(e) => onChange({ ...settings, indicators: { ...ind, tieRule: e.target.value as TieRule } })}>
            <option value="REVISAR">Empate → REVISAR</option><option value="APROBADA">Empate → APROBADA</option><option value="DESCARTADA">Empate → DESCARTADA</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cfg-ltz">Zona horaria de la lista</label>
          <select id="cfg-ltz" className="input" value={settings.listTz} onChange={(e) => onChange({ ...settings, listTz: e.target.value })}>
            {TIMEZONES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cfg-src">Fuente de velas</label>
          <select id="cfg-src" className="input" value={settings.dataSource} onChange={(e) => onChange({ ...settings, dataSource: e.target.value as AppSettings['dataSource'] })}>
            <option value="MOCK">Mock determinista (offline)</option>
            <option value="BINANCE">Binance público (solo cripto REAL)</option>
          </select>
        </div>
        <div className="flex flex-col justify-end gap-1.5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-500" checked={settings.blockMarketMix} onChange={(e) => onChange({ ...settings, blockMarketMix: e.target.checked })} /> Bloquear mezcla REAL/OTC</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-500" checked={settings.operateOnReview} onChange={(e) => onChange({ ...settings, operateOnReview: e.target.checked })} /> Operar señales en REVISAR (modo filtro)</label>
        </div>
      </div>
    </Card>
  );
}
