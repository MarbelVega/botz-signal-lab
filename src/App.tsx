import { useCallback, useMemo, useState } from 'react';
import { AnalysisSection } from './components/AnalysisSection';
import { Disclaimer } from './components/Disclaimer';
import { RiskCalculator } from './components/RiskCalculator';
import { SessionMetrics } from './components/SessionMetrics';
import { SettingsPanel } from './components/SettingsPanel';
import { SignalManager } from './components/SignalManager';
import { TimezoneClock } from './components/TimezoneClock';
import { Card } from './components/ui';
import { usePersistentState } from './hooks/usePersistentState';
import { computeMetrics } from './lib/metrics';
import { breakevenWinRate, sanitizeRisk } from './lib/risk';
import { simulateSignal } from './lib/simulate';
import { cloudPull, cloudPush, loadLocal, loadLocalArray, type AppSettings, type SimLogEntry } from './lib/storage';
import { supabaseEnabled } from './lib/supabase';
import { formatInTz } from './lib/time';
import { DEFAULT_INDICATORS, DEFAULT_RISK, type Signal } from './lib/types';
import { uid } from './lib/uid';

const DEFAULT_SETTINGS: AppSettings = {
  displayTz: 'America/Sao_Paulo',
  listTz: 'America/Sao_Paulo',
  risk: DEFAULT_RISK,
  indicators: DEFAULT_INDICATORS,
  dataSource: 'MOCK',
  blockMarketMix: true,
  operateOnReview: false,
  winProbAssumption: 50,
};

export default function App() {
  const [signals, setSignals] = usePersistentState<Signal[]>('signals', () => loadLocalArray<Signal>('signals'));
  const [settings, setSettings] = usePersistentState<AppSettings>('settings', () => {
    const s = loadLocal<AppSettings>('settings', DEFAULT_SETTINGS);
    return { ...s, risk: { ...DEFAULT_RISK, ...s.risk }, indicators: { ...DEFAULT_INDICATORS, ...s.indicators } };
  });
  const [log, setLog] = usePersistentState<SimLogEntry[]>('log', () => loadLocalArray<SimLogEntry>('log'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cloudMsg, setCloudMsg] = useState<string | null>(null);

  const addLog = useCallback((action: string, detail: string) => {
    setLog((l) => [{ id: uid(), at: Date.now(), action, detail }, ...l].slice(0, 200));
  }, [setLog]);

  const risk = useMemo(() => sanitizeRisk(settings.risk), [settings.risk]);
  const metrics = useMemo(() => computeMetrics(signals, risk, settings.listTz), [signals, risk, settings.listTz]);
  const selected = signals.find((s) => s.id === selectedId) ?? null;

  const simulate = async (all: boolean) => {
    setBusy(true);
    try {
      const out: Signal[] = [];
      let resolved = 0;
      for (const s of signals) {
        if (!all && s.status !== 'Pendiente') { out.push(s); continue; }
        const r = await simulateSignal(s, settings.listTz, settings.indicators,
          { mode: risk.mode, operateOnReview: settings.operateOnReview }, settings.dataSource);
        if (r.status !== 'Pendiente') resolved++;
        out.push(r);
      }
      setSignals(out);
      addLog('Simulación', `${resolved} señales resueltas (${risk.mode === 'FILTER_G1' ? 'con filtro, máx. G1' : 'copia, hasta G2'}; fuente ${settings.dataSource}).`);
    } finally {
      setBusy(false);
    }
  };

  const cloud = async (dir: 'push' | 'pull') => {
    setCloudMsg('Sincronizando…');
    try {
      if (dir === 'push') {
        const r = await cloudPush(signals, settings, log);
        setCloudMsg(`☁ ${r.count} señales guardadas en Supabase.`);
      } else {
        const r = await cloudPull();
        setSignals(r.signals);
        if (r.settings) setSettings({ ...DEFAULT_SETTINGS, ...r.settings });
        setCloudMsg(`☁ ${r.signals.length} señales cargadas desde Supabase.`);
      }
    } catch (e) {
      setCloudMsg(`Error: ${(e as Error).message}`);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ signals, settings, log }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `botz-session-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="min-h-screen">
      <Disclaimer />
      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-3 px-4 pt-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            BOT Z Signal Lab <span className="ml-1 rounded bg-emerald-600/20 px-1.5 py-0.5 align-middle text-xs font-semibold text-emerald-300">PoC educativo</span>
          </h1>
          <p className="text-sm text-slate-400">Señales (tuplas) · Confluencia de 5 indicadores sobre 3 velas · Ley 1 / Ley 2 · Simulador de ciclos</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn-ghost" onClick={exportJson}>⬇ Exportar JSON</button>
          {supabaseEnabled ? (
            <>
              <button type="button" className="btn-ghost" onClick={() => cloud('push')}>☁ Guardar</button>
              <button type="button" className="btn-ghost" onClick={() => cloud('pull')}>☁ Cargar</button>
            </>
          ) : (
            <span className="rounded-lg border border-slate-800 px-2 py-1 text-xs text-slate-500" title="Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para habilitar la nube">Modo local (localStorage)</span>
          )}
        </div>
        {cloudMsg && <p className="w-full text-right text-xs text-slate-400" aria-live="polite">{cloudMsg}</p>}
      </header>

      <main className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <TimezoneClock displayTz={settings.displayTz} listTz={settings.listTz} signals={signals}
            onTzChange={(tz) => setSettings({ ...settings, displayTz: tz })} />
        </div>
        <div className="lg:col-span-8">
          <SessionMetrics m={metrics} capital={risk.capital} displayTz={settings.displayTz} breakeven={breakevenWinRate(risk.payoutPct)} />
        </div>

        <div className="lg:col-span-12">
          <SignalManager
            signals={signals} listTz={settings.listTz} blockMarketMix={settings.blockMarketMix} selectedId={selectedId} busy={busy}
            onAdd={(s) => { setSignals((prev) => [...prev, ...s]); addLog('Carga', `${s.length} señal(es) añadidas.`); }}
            onUpdate={(id, patch) => setSignals((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))}
            onDelete={(id) => { setSignals((prev) => prev.filter((x) => x.id !== id)); if (selectedId === id) setSelectedId(null); }}
            onClear={() => { setSignals([]); setSelectedId(null); addLog('Limpieza', 'Lista de señales vaciada.'); }}
            onSelect={(id) => { setSelectedId(id); document.getElementById('analysis')?.scrollIntoView({ behavior: 'smooth' }); }}
            onSimulate={simulate}
          />
        </div>

        <div id="analysis" className="scroll-mt-4 lg:col-span-12">
          <AnalysisSection signal={selected} listTz={settings.listTz} displayTz={settings.displayTz} cfg={settings.indicators}
            mode={risk.mode} dataSource={settings.dataSource} onClose={() => setSelectedId(null)} />
        </div>

        <div className="lg:col-span-8">
          <RiskCalculator risk={settings.risk} onChange={(r) => setSettings({ ...settings, risk: r })}
            winProb={settings.winProbAssumption} onWinProb={(n) => setSettings({ ...settings, winProbAssumption: n })} />
        </div>
        <div className="lg:col-span-4">
          <Card title="Bitácora de simulación" right={log.length ? <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setLog([])}>Vaciar</button> : null}>
            <ol className="max-h-80 space-y-1.5 overflow-auto text-xs">
              {log.slice(0, 60).map((l) => (
                <li key={l.id} className="rounded-lg bg-slate-950/60 px-2 py-1.5 ring-1 ring-slate-800">
                  <span className="font-mono text-slate-500">{formatInTz(l.at, settings.displayTz, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>{' '}
                  <span className="font-semibold text-slate-200">{l.action}</span> · <span className="text-slate-400">{l.detail}</span>
                </li>
              ))}
              {!log.length && <li className="text-slate-500">Sin eventos todavía.</li>}
            </ol>
          </Card>
        </div>

        <div className="lg:col-span-12">
          <SettingsPanel settings={settings} onChange={setSettings} />
        </div>
      </main>

      <footer className="mx-auto max-w-[1500px] px-4 pb-8 pt-2">
        <Disclaimer compact />
      </footer>
    </div>
  );
}
