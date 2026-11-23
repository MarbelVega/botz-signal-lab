import { describe, expect, it } from 'vitest';
import { ema, rsi, bollinger, stochastic, fractals } from '../indicators';
import { applyLaws } from '../evaluation';
import { cycleTable, breakevenWinRate, cycleExpectedValue } from '../risk';
import { parseSignals, detectMarketMix } from '../parser';
import { zonedToEpoch } from '../time';
import { mockCandles } from '../marketData';
import { rawOutcome, resolveStatus } from '../simulate';
import { DEFAULT_INDICATORS, type IndicatorVote, type Candle } from '../types';

const v = (vote: IndicatorVote['vote']): IndicatorVote => ({ key: 'EMA', label: '', vote, reason: '', values: '' });

describe('indicadores', () => {
  it('EMA de serie constante = constante', () => {
    const e = ema(Array(150).fill(5), 100);
    expect(e[98]).toBeNull();
    expect(e[149]).toBeCloseTo(5);
  });
  it('RSI = 100 en serie estrictamente creciente', () => {
    const r = rsi(Array.from({ length: 30 }, (_, i) => i), 6);
    expect(r[29]).toBe(100);
  });
  it('Bollinger: banda superior > media > inferior', () => {
    const b = bollinger(Array.from({ length: 40 }, (_, i) => Math.sin(i)), 20, 2)[39]!;
    expect(b.upper).toBeGreaterThan(b.middle);
    expect(b.middle).toBeGreaterThan(b.lower);
  });
  it('Estocástico en rango [0,100]', () => {
    const c = mockCandles('EUR/AUD', 'REAL', 'M1', 1_700_000_000, 120);
    for (const p of stochastic(c, 6, 3, 3)) if (p) { expect(p.k).toBeGreaterThanOrEqual(0); expect(p.k).toBeLessThanOrEqual(100); }
  });
  it('Fractal inferior detectado (periodo 6 = 3 velas por lado)', () => {
    const lows = [5, 4, 3, 1, 3, 4, 5];
    const c: Candle[] = lows.map((l, i) => ({ time: i, open: l + 1, close: l + 1, high: l + 2, low: l }));
    expect(fractals(c, 6)[3]).toBe('DOWN');
  });
});

describe('Ley 1 / Ley 2', () => {
  it('mayoría a favor => APROBADA, riesgo bajo con 3+', () => {
    const r = applyLaws([v('CALL'), v('CALL'), v('CALL'), v('NEUTRAL'), v('PUT')], 'CALL', DEFAULT_INDICATORS, 'FILTER_G1');
    expect(r.verdict).toBe('APROBADA');
    expect(r.confluence).toBe(3);
    expect(r.risk).toBe('Riesgo Bajo relativo');
    expect(r.maxGale).toBe(1);
  });
  it('mayoría en contra => DESCARTADA', () => {
    expect(applyLaws([v('PUT'), v('PUT'), v('CALL'), v('NEUTRAL'), v('NEUTRAL')], 'CALL', DEFAULT_INDICATORS, 'FILTER_G1').verdict).toBe('DESCARTADA');
  });
  it('empate usa regla configurable', () => {
    const votes = [v('PUT'), v('CALL'), v('NEUTRAL'), v('NEUTRAL'), v('NEUTRAL')];
    expect(applyLaws(votes, 'CALL', { ...DEFAULT_INDICATORS, tieRule: 'APROBADA' }, 'COPY_G2').verdict).toBe('APROBADA');
    expect(applyLaws(votes, 'CALL', DEFAULT_INDICATORS, 'COPY_G2').verdict).toBe('REVISAR');
  });
});

describe('ciclos', () => {
  it('montos con multiplicador 2.2', () => {
    const t = cycleTable({ capital: 1000, baseAmount: 10, multiplier: 2.2, payoutPct: 85, mode: 'COPY_G2' });
    expect(t.map((r) => r.amount)).toEqual([10, 22, 48.4]);
    expect(t[2].cumulative).toBe(80.4);
    expect(t[1].netIfWin).toBeCloseTo(22 * 0.85 - 10);
  });
  it('break-even con payout 85% ≈ 54.05%', () => {
    expect(breakevenWinRate(85)).toBeCloseTo(0.5405, 3);
  });
  it('con q=0.5 el ciclo tiene EV negativo (payout < 100%)', () => {
    expect(cycleExpectedValue({ capital: 1000, baseAmount: 10, multiplier: 2.2, payoutPct: 85, mode: 'FILTER_G1' }, 0.5).ev).toBeLessThan(0);
  });
  it('modo filtro limita a Gale 1', () => {
    expect(resolveStatus('Ganada Gale 2', null, { mode: 'FILTER_G1', operateOnReview: false })).toBe('Perdida');
  });
});

describe('parser y tiempo', () => {
  it('parsea formatos mixtos', () => {
    const r = parseSignals('M5;EUR/AUD;14:30;CALL\n14:30 - EUR/GBP OTC - PUT - M1\nEURUSD-OTC 09:15 CALL M5\nbasura', '2026-11-23');
    expect(r.signals).toHaveLength(3);
    expect(r.signals[1]).toMatchObject({ asset: 'EUR/GBP', market: 'OTC', direction: 'PUT', expiry: 'M1' });
    expect(r.errors).toHaveLength(1);
    expect(detectMarketMix(r.signals)).toBe(true);
  });
  it('UTC-3 -> epoch', () => {
    expect(new Date(zonedToEpoch('2026-11-23', '14:30', 'America/Sao_Paulo')).toISOString()).toBe('2026-11-23T17:30:00.000Z');
  });
  it('mock determinista', () => {
    const a = mockCandles('EUR/AUD', 'REAL', 'M5', 1_800_000_000, 50);
    const b = mockCandles('EUR/AUD', 'REAL', 'M5', 1_800_000_000 + 600, 52);
    expect(b[0]).toEqual(a[0]);
    expect(rawOutcome(a, 10, 'CALL')).not.toBeNull();
  });
});
