import { useEffect, useRef } from 'react';
import {
  ColorType, CrosshairMode, LineStyle, createChart,
  type IChartApi, type IPriceLine, type ISeriesApi, type LogicalRange, type SeriesMarker, type Time, type UTCTimestamp, type WhitespaceData, type LineData,
} from 'lightweight-charts';
import type { IndicatorBundle } from '../lib/indicators';
import type { Candle, IndicatorConfig } from '../lib/types';

interface Props {
  candles: Candle[];
  bundle: IndicatorBundle | null;
  targetIndex: number;
  lookback: number;
  cfg: IndicatorConfig;
  shiftSec: number;
  placeholderTarget: boolean;
  onPickTarget: (utcTime: number) => void;
}

const base = {
  autoSize: true,
  layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8', fontSize: 11 },
  grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#334155' },
  timeScale: { borderColor: '#334155', timeVisible: true, secondsVisible: false, rightOffset: 4 },
};

type L = ISeriesApi<'Line'>;

export function PriceCharts({ candles, bundle, targetIndex, lookback, cfg, shiftSec, placeholderTarget, onPickTarget }: Props) {
  const priceBox = useRef<HTMLDivElement>(null);
  const oscBox = useRef<HTMLDivElement>(null);
  const refs = useRef<{
    price?: IChartApi; osc?: IChartApi; candle?: ISeriesApi<'Candlestick'>;
    ema?: L; bbU?: L; bbM?: L; bbL?: L; rsi?: L; k?: L; d?: L; lines?: IPriceLine[];
  }>({});
  const pickRef = useRef(onPickTarget);
  pickRef.current = onPickTarget;
  const shiftRef = useRef(shiftSec);
  shiftRef.current = shiftSec;

  useEffect(() => {
    if (!priceBox.current || !oscBox.current) return;
    const price = createChart(priceBox.current, base);
    const osc = createChart(oscBox.current, base);
    const r = refs.current;
    r.price = price; r.osc = osc;
    r.candle = price.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444', borderUpColor: '#22c55e', borderDownColor: '#ef4444', wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 5, minMove: 0.00001 },
    });
    const line = (c: IChartApi, color: string, width: 1 | 2 = 1, style: LineStyle = LineStyle.Solid) =>
      c.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    r.ema = line(price, '#f59e0b', 2);
    r.bbU = line(price, '#60a5fa', 1, LineStyle.Dashed);
    r.bbM = line(price, '#64748b', 1, LineStyle.Dotted);
    r.bbL = line(price, '#60a5fa', 1, LineStyle.Dashed);
    r.rsi = line(osc, '#c084fc', 2);
    r.k = line(osc, '#38bdf8', 1);
    r.d = line(osc, '#fb923c', 1, LineStyle.Dashed);
    const fixed = () => ({ priceRange: { minValue: 0, maxValue: 100 } });
    [r.rsi, r.k, r.d].forEach((x) => x.applyOptions({ autoscaleInfoProvider: fixed }));

    price.subscribeClick((param) => {
      if (param.time === undefined) return;
      pickRef.current((param.time as number) - shiftRef.current);
    });
    // Sincroniza el zoom/scroll de ambos paneles
    let syncing = false;
    const sync = (dst: IChartApi) => (range: LogicalRange | null) => {
      if (syncing || !range) return;
      syncing = true; dst.timeScale().setVisibleLogicalRange(range); syncing = false;
    };
    price.timeScale().subscribeVisibleLogicalRangeChange(sync(osc));
    osc.timeScale().subscribeVisibleLogicalRangeChange(sync(price));
    return () => { price.remove(); osc.remove(); refs.current = {}; };
  }, []);

  useEffect(() => {
    const r = refs.current;
    if (!r.candle || !bundle || !candles.length) return;
    const T = (t: number) => (t + shiftSec) as UTCTimestamp;
    const toLine = (vals: (number | null | undefined)[]): (LineData | WhitespaceData)[] =>
      candles.map((c, i) => (vals[i] === null || vals[i] === undefined ? { time: T(c.time) } : { time: T(c.time), value: vals[i] as number }));

    r.candle.setData(candles.map((c, i) => ({
      time: T(c.time), open: c.open, high: c.high, low: c.low, close: c.close,
      ...(i === targetIndex && placeholderTarget ? { color: '#475569', wickColor: '#475569', borderColor: '#475569' } : {}),
    })));
    r.ema!.setData(toLine(bundle.ema));
    r.bbU!.setData(toLine(bundle.bb.map((b) => b?.upper)));
    r.bbM!.setData(toLine(bundle.bb.map((b) => b?.middle)));
    r.bbL!.setData(toLine(bundle.bb.map((b) => b?.lower)));
    r.rsi!.setData(toLine(bundle.rsi));
    r.k!.setData(toLine(bundle.stoch.map((s) => s?.k)));
    r.d!.setData(toLine(bundle.stoch.map((s) => s?.d)));

    // líneas 80/20 en el panel de osciladores
    r.lines?.forEach((pl) => r.rsi!.removePriceLine(pl));
    r.lines = [
      r.rsi!.createPriceLine({ price: cfg.rsiUpper, color: '#ef4444', lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: '' }),
      r.rsi!.createPriceLine({ price: cfg.rsiLower, color: '#22c55e', lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: '' }),
    ];

    const markers: SeriesMarker<Time>[] = [];
    bundle.fractals.forEach((f, i) => {
      if (i >= targetIndex) return; // no mostrar fractales "futuros"
      if (f === 'UP' || f === 'BOTH') markers.push({ time: T(candles[i].time), position: 'aboveBar', color: '#f87171', shape: 'arrowDown', size: 0.6 });
      if (f === 'DOWN' || f === 'BOTH') markers.push({ time: T(candles[i].time), position: 'belowBar', color: '#4ade80', shape: 'arrowUp', size: 0.6 });
    });
    for (let k = 1; k <= lookback; k++) {
      const i = targetIndex - (lookback - k + 1);
      if (i >= 0) markers.push({ time: T(candles[i].time), position: 'aboveBar', color: '#facc15', shape: 'circle', text: String(k), size: 0.8 });
    }
    if (candles[targetIndex]) markers.push({ time: T(candles[targetIndex].time), position: 'aboveBar', color: '#e2e8f0', shape: 'square', text: 'OBJETIVO', size: 1 });
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    r.candle.setMarkers(markers);

    const to = Math.min(candles.length - 1, targetIndex + 6);
    const from = Math.max(0, to - 70);
    r.price!.timeScale().setVisibleLogicalRange({ from, to });
    r.osc!.timeScale().setVisibleLogicalRange({ from, to });
  }, [candles, bundle, targetIndex, lookback, shiftSec, placeholderTarget, cfg.rsiUpper, cfg.rsiLower]);

  return (
    <div>
      <div ref={priceBox} className="h-72 w-full sm:h-80" aria-label="Gráfico de velas con EMA y Bandas de Bollinger" role="img" />
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span><i className="mr-1 inline-block h-0.5 w-4 bg-amber-500 align-middle" />EMA {cfg.emaPeriod}</span>
        <span><i className="mr-1 inline-block h-0.5 w-4 border-t border-dashed border-blue-400 align-middle" />BB {cfg.bbPeriod},{cfg.bbStdDev}</span>
        <span className="text-green-400">▲ fractal inferior</span><span className="text-red-400">▼ fractal superior</span>
        <span className="text-yellow-300">● 1-2-3 velas evaluadas</span>
        <span>Clic en una vela = nueva vela objetivo</span>
      </div>
      <div ref={oscBox} className="mt-2 h-28 w-full" aria-label="Panel RSI y Estocástico" role="img" />
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span className="text-purple-400">— RSI {cfg.rsiPeriod}</span>
        <span className="text-sky-400">— %K {cfg.stochK}</span>
        <span className="text-orange-400">-- %D {cfg.stochD}</span>
        <span>zonas {cfg.rsiUpper}/{cfg.rsiLower}</span>
      </div>
    </div>
  );
}
