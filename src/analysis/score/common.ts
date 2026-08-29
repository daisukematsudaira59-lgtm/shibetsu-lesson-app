import type { Judgement, Metric } from '../types';

export type Tier = {
  /** dir='high' なら「この値以上」、dir='low' なら「この値以下」 */
  at: number;
  ratio: number;
  judgement: Judgement;
  comment: string;
};

export interface MetricSpec {
  key: string;
  label: string;
  term?: string;
  max: number;
  value: number | undefined | null;
  format: (v: number) => string;
  dir: 'high' | 'low';
  tiers: Tier[];
  otherwise: { judgement: Judgement; comment: string };
  naComment?: string;
}

export function buildMetric(spec: MetricSpec): Metric {
  const v = spec.value;
  if (v === undefined || v === null || Number.isNaN(v) || !Number.isFinite(v)) {
    return {
      key: spec.key,
      label: spec.label,
      term: spec.term,
      display: 'ー',
      judgement: 'na',
      comment: spec.naComment ?? 'このデータが取得できていないため、評価には使っていません。',
      points: 0,
      max: spec.max,
      counted: false,
    };
  }
  const hit =
    spec.dir === 'high'
      ? [...spec.tiers].sort((a, b) => b.at - a.at).find((t) => v >= t.at)
      : [...spec.tiers].sort((a, b) => a.at - b.at).find((t) => v <= t.at);

  const ratio = hit ? hit.ratio : 0;
  return {
    key: spec.key,
    label: spec.label,
    term: spec.term,
    display: spec.format(v),
    judgement: hit ? hit.judgement : spec.otherwise.judgement,
    comment: hit ? hit.comment : spec.otherwise.comment,
    points: Math.round(spec.max * ratio * 10) / 10,
    max: spec.max,
    counted: true,
  };
}

/**
 * 欠損指標を満点計算から除外したうえでカテゴリ点数を算出する。
 * データが半分も揃わない場合は score = null（＝判断材料不足）とし、点数を付けない。
 */
export function aggregate(metrics: Metric[], categoryMax: number, minCoverage = 0.5) {
  const totalMax = metrics.reduce((a, m) => a + m.max, 0);
  const availMax = metrics.reduce((a, m) => a + (m.counted ? m.max : 0), 0);
  const gained = metrics.reduce((a, m) => a + m.points, 0);
  const coverage = totalMax === 0 ? 0 : availMax / totalMax;
  if (coverage < minCoverage || availMax === 0) {
    return { score: null as number | null, coverage, stars: 0 };
  }
  const score = Math.round((gained / availMax) * categoryMax);
  return { score: score as number | null, coverage, stars: toStars(score / categoryMax) };
}

/** 割合(0〜1)を 0〜5 の星（0.5刻み）に */
export function toStars(ratio: number) {
  const r = Math.max(0, Math.min(1, ratio));
  return Math.round(r * 10) / 2;
}

/** 年平均成長率(%)。起点が 0 以下だと計算できないので undefined。 */
export function cagr(first: number | undefined, last: number | undefined, years: number): number | undefined {
  if (first === undefined || last === undefined || first <= 0 || last <= 0 || years <= 0) return undefined;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

export const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
export const signedPct = (v: number, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;
export const times = (v: number, d = 1) => `${v.toFixed(d)}倍`;
