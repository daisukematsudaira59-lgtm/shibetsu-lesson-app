import type { PricePoint } from '../types/stock';

/** 単純移動平均。データが足りない期間は null。 */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[0] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** RSI(14) — 買われすぎ / 売られすぎの目安 */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let gain = 0;
  let loss = 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    const diff = values[i] - values[i - 1];
    const up = Math.max(diff, 0);
    const down = Math.max(-diff, 0);
    if (i <= period) {
      gain += up;
      loss += down;
      if (i === period) {
        gain /= period;
        loss /= period;
        out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
      } else {
        out.push(null);
      }
      continue;
    }
    gain = (gain * (period - 1) + up) / period;
    loss = (loss * (period - 1) + down) / period;
    out.push(loss === 0 ? 100 : 100 - 100 / (1 + gain / loss));
  }
  return out;
}

export interface MacdSeries {
  macd: number[];
  signal: number[];
  histogram: number[];
}

/** MACD(12,26,9) */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdSeries {
  const f = ema(values, fast);
  const s = ema(values, slow);
  const line = f.map((v, i) => v - s[i]);
  const signal = ema(line, signalPeriod);
  return { macd: line, signal, histogram: line.map((v, i) => v - signal[i]) };
}

export interface TechnicalSnapshot {
  price: number;
  sma25: number | null;
  sma75: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  high52w: number;
  low52w: number;
  /** 52週レンジの中での位置 0(安値)〜100(高値) */
  positionInRange: number;
  /** 直近20営業日の騰落率(%) */
  change20d: number | null;
  /** 直近60営業日の騰落率(%) */
  change60d: number | null;
  /** 25日線からの乖離率(%) */
  deviation25: number | null;
}

export function buildTechnical(history: PricePoint[]): TechnicalSnapshot | null {
  if (history.length < 30) return null;
  const closes = history.map((p) => p.close);
  const i = closes.length - 1;
  const s25 = sma(closes, 25)[i];
  const s75 = sma(closes, 75)[i];
  const s200 = sma(closes, 200)[i];
  const r = rsi(closes)[i];
  const m = macd(closes);
  const window = closes.slice(-250);
  const high52w = Math.max(...window);
  const low52w = Math.min(...window);
  const price = closes[i];

  return {
    price,
    sma25: s25,
    sma75: s75,
    sma200: s200,
    rsi14: r,
    macd: m.macd[i],
    macdSignal: m.signal[i],
    macdHistogram: m.histogram[i],
    high52w,
    low52w,
    positionInRange: high52w === low52w ? 50 : ((price - low52w) / (high52w - low52w)) * 100,
    change20d: closes.length > 20 ? ((price - closes[i - 20]) / closes[i - 20]) * 100 : null,
    change60d: closes.length > 60 ? ((price - closes[i - 60]) / closes[i - 60]) * 100 : null,
    deviation25: s25 ? ((price - s25) / s25) * 100 : null,
  };
}
