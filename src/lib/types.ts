export type Direction = 'CALL' | 'PUT';
export type Market = 'REAL' | 'OTC';
export type Expiry = 'M1' | 'M5';
export type SignalStatus =
  | 'Pendiente'
  | 'Ganada Base'
  | 'Ganada Gale 1'
  | 'Ganada Gale 2'
  | 'Perdida'
  | 'Omitida';

export interface Signal {
  id: string;
  /** Fecha de la señal en la zona horaria de la lista (YYYY-MM-DD). */
  date: string;
  /** Hora HH:MM en la zona horaria de la lista (por defecto UTC-3). */
  time: string;
  asset: string;
  market: Market;
  expiry: Expiry;
  direction: Direction;
  status: SignalStatus;
  /** Resultado "en bruto" del mercado simulado, independiente del filtro. */
  rawOutcome?: Exclude<SignalStatus, 'Pendiente' | 'Omitida'>;
  /** Veredicto Ley 1 al momento de simular. */
  verdict?: Verdict;
  confluence?: number;
  note?: string;
  createdAt: number;
}

export interface Candle {
  /** epoch en segundos (UTC) del inicio de la vela */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type Vote = 'CALL' | 'PUT' | 'NEUTRAL';

export interface IndicatorVote {
  key: 'EMA' | 'FRACTALS' | 'BB' | 'RSI' | 'STOCH';
  label: string;
  vote: Vote;
  reason: string;
  values: string;
}

export type Verdict = 'APROBADA' | 'REVISAR' | 'DESCARTADA';
export type TieRule = 'REVISAR' | 'APROBADA' | 'DESCARTADA';
export type RiskLevel = 'Sin confluencia' | 'Riesgo Alto' | 'Riesgo Moderado' | 'Riesgo Bajo relativo';

export interface Evaluation {
  targetTime: number;
  windowTimes: number[];
  votes: IndicatorVote[];
  forCall: number;
  forPut: number;
  neutral: number;
  inFavor: number;
  against: number;
  verdict: Verdict;
  ley1Reason: string;
  confluence: number;
  risk: RiskLevel;
  maxGale: 0 | 1 | 2;
  ley2Reason: string;
}

export type OperatingMode = 'COPY_G2' | 'FILTER_G1';

export interface RiskConfig {
  capital: number;
  baseAmount: number;
  multiplier: number;
  payoutPct: number;
  mode: OperatingMode;
}

export interface IndicatorConfig {
  emaPeriod: number;
  fractalPeriod: number;
  bbPeriod: number;
  bbStdDev: number;
  rsiPeriod: number;
  rsiUpper: number;
  rsiLower: number;
  stochK: number;
  stochD: number;
  stochSmooth: number;
  stochUpper: number;
  stochLower: number;
  lookback: number; // número de velas previas analizadas (3)
  tieRule: TieRule;
}

export const DEFAULT_INDICATORS: IndicatorConfig = {
  emaPeriod: 100,
  fractalPeriod: 6,
  bbPeriod: 20,
  bbStdDev: 2,
  rsiPeriod: 6,
  rsiUpper: 80,
  rsiLower: 20,
  stochK: 6,
  stochD: 3,
  stochSmooth: 3,
  stochUpper: 80,
  stochLower: 20,
  lookback: 3,
  tieRule: 'REVISAR',
};

export const DEFAULT_RISK: RiskConfig = {
  capital: 1000,
  baseAmount: 10,
  multiplier: 2.2,
  payoutPct: 85,
  mode: 'FILTER_G1',
};
