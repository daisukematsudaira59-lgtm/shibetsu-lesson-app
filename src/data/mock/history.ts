import type { PricePoint } from '../../types/stock';

/** 決定的な擬似乱数（同じ seed なら常に同じ系列 = 再読み込みでチャートが変わらない） */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HistorySeed {
  /** 直近終値の目安 */
  base: number;
  /** 1日あたりの平均ドリフト（0.0005 = 年+12%程度） */
  drift: number;
  /** 1日あたりのボラティリティ */
  vol: number;
  seed: number;
  /** 直近 n 日に加える追加の変化率（急騰・急落の演出） */
  recentShock?: { days: number; totalPct: number };
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * デモ用の日足を生成する。
 * 実データ接続時はこの関数ごと不要になる（provider が実データを返す）。
 */
export function generateHistory(spec: HistorySeed, days = 300, endDate = new Date()): PricePoint[] {
  const rnd = mulberry32(spec.seed);
  // 一度「過去→現在」に生成してから、最終値が base になるよう正規化する
  const raw: number[] = [];
  let p = spec.base;
  for (let i = 0; i < days; i++) {
    const shock = (rnd() - 0.5) * 2 * spec.vol;
    p = p * (1 + spec.drift + shock);
    raw.push(p);
  }

  if (spec.recentShock) {
    const { days: sd, totalPct } = spec.recentShock;
    const per = Math.pow(1 + totalPct / 100, 1 / sd) - 1;
    for (let i = days - sd; i < days; i++) {
      const k = i - (days - sd) + 1;
      raw[i] = raw[i] * Math.pow(1 + per, k);
    }
  }

  const scale = spec.base / raw[raw.length - 1];
  const closes = raw.map((v) => v * scale);

  const points: PricePoint[] = [];
  const cursor = new Date(endDate);
  const dates: string[] = [];
  while (dates.length < days) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dates.unshift(toDateStr(cursor));
    cursor.setDate(cursor.getDate() - 1);
  }

  for (let i = 0; i < days; i++) {
    const close = closes[i];
    const prev = i === 0 ? close : closes[i - 1];
    const open = prev * (1 + (rnd() - 0.5) * spec.vol * 0.5);
    const hi = Math.max(open, close) * (1 + rnd() * spec.vol * 0.6);
    const lo = Math.min(open, close) * (1 - rnd() * spec.vol * 0.6);
    const round = (v: number) => (spec.base >= 1000 ? Math.round(v) : Math.round(v * 10) / 10);
    points.push({
      date: dates[i],
      open: round(open),
      high: round(hi),
      low: round(lo),
      close: round(close),
      volume: Math.round((500000 + rnd() * 3000000) * (spec.base > 5000 ? 0.3 : 1)),
    });
  }
  return points;
}
