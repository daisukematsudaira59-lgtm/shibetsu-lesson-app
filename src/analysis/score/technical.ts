import type { Stock } from '../../types/stock';
import type { CategoryScore } from '../types';
import type { TechnicalSnapshot } from '../indicators';
import { aggregate, buildMetric, signedPct } from './common';

const MAX = 10;

export function scoreTechnical(_s: Stock, t: TechnicalSnapshot | null): CategoryScore {
  if (!t) {
    return {
      key: 'technical',
      label: 'チャート',
      plainLabel: '株価の位置と勢い',
      score: null,
      max: MAX,
      stars: 0,
      metrics: [],
      coverage: 0,
      comment: '株価データが不足しているため、チャートからは判断できません。',
    };
  }

  // 移動平均の並び：株価>25日>75日>200日 なら強い上昇トレンド
  const lines = [t.sma25, t.sma75, t.sma200];
  let trendScore: number | undefined;
  if (lines.every((v) => v !== null)) {
    const [m25, m75, m200] = lines as number[];
    let pts = 0;
    if (t.price > m25) pts++;
    if (m25 > m75) pts++;
    if (m75 > m200) pts++;
    if (t.price > m200) pts++;
    trendScore = pts; // 0〜4
  }

  const macdDiff = t.macd !== null && t.macdSignal !== null ? t.macd - t.macdSignal : undefined;

  const metrics = [
    buildMetric({
      key: 'trend',
      label: '移動平均線の並び（25日/75日/200日）',
      term: 'movingAverage',
      max: 3,
      value: trendScore,
      dir: 'high',
      format: (v) =>
        v >= 4 ? '上昇トレンド' : v === 3 ? 'やや上昇' : v === 2 ? '方向感なし' : v === 1 ? 'やや下降' : '下降トレンド',
      tiers: [
        { at: 4, ratio: 1, judgement: 'good', comment: '短期・中期・長期のすべてが上向きに並んでおり、上昇の勢いが続いています。' },
        { at: 3, ratio: 0.75, judgement: 'ok', comment: '概ね上向きですが、一部の期間では勢いが落ちています。' },
        { at: 2, ratio: 0.5, judgement: 'ok', comment: '上にも下にもはっきりした方向が出ていません。' },
        { at: 1, ratio: 0.3, judgement: 'watch', comment: '下向きの並びが目立ちます。下落基調にある可能性があります。' },
      ],
      otherwise: { judgement: 'watch', comment: '株価がすべての移動平均線を下回っており、下落基調です。' },
      naComment: '株価の履歴が短く、200日移動平均などが計算できません。',
    }),
    buildMetric({
      key: 'rsi',
      label: 'RSI（14日）',
      term: 'rsi',
      max: 2,
      value: t.rsi14 ?? undefined,
      dir: 'low',
      format: (v) => v.toFixed(0),
      tiers: [
        { at: 30, ratio: 0.8, judgement: 'ok', comment: '売られすぎの目安（30以下）です。反発することもありますが、下落理由の確認が先です。' },
        { at: 45, ratio: 1, judgement: 'good', comment: '過熱感のない水準です。' },
        { at: 60, ratio: 0.8, judgement: 'good', comment: '落ち着いた水準です。' },
        { at: 70, ratio: 0.5, judgement: 'ok', comment: 'やや買われすぎ気味です。' },
      ],
      otherwise: { judgement: 'watch', comment: '買われすぎの目安（70以上）です。短期的に一服する可能性を意識したい水準です。' },
    }),
    buildMetric({
      key: 'macd',
      label: 'MACD',
      term: 'macd',
      max: 2,
      value: macdDiff,
      dir: 'high',
      format: (v) => (v >= 0 ? '買いシグナル寄り' : '売りシグナル寄り'),
      tiers: [{ at: 0, ratio: 1, judgement: 'good', comment: '短期の勢いが中期を上回っており、上昇に傾いています。' }],
      otherwise: { judgement: 'watch', comment: '短期の勢いが中期を下回っており、下降に傾いています。' },
    }),
    buildMetric({
      key: 'rangePosition',
      label: '52週レンジ内の位置',
      term: 'range52w',
      max: 2,
      value: t.positionInRange,
      dir: 'low',
      format: (v) => `${v.toFixed(0)}%（0=安値 / 100=高値）`,
      tiers: [
        { at: 25, ratio: 0.9, judgement: 'ok', comment: '1年の値動きの中では安い位置にあります。ただし下げ続けている最中の可能性もあります。' },
        { at: 60, ratio: 1, judgement: 'good', comment: '1年の値動きの中では中位です。高値づかみのリスクは相対的に低い位置です。' },
        { at: 85, ratio: 0.5, judgement: 'ok', comment: '1年の高値圏に近づいています。' },
      ],
      otherwise: { judgement: 'watch', comment: '1年の高値圏にあります。今から買うと高値づかみになる可能性を意識してください。' },
    }),
    buildMetric({
      key: 'deviation25',
      label: '25日移動平均からの乖離',
      term: 'deviation',
      max: 1,
      value: t.deviation25 === null ? undefined : Math.abs(t.deviation25),
      dir: 'low',
      format: (v) => `${v.toFixed(1)}%`,
      tiers: [
        { at: 5, ratio: 1, judgement: 'good', comment: '平均的な株価水準から大きく離れていません。' },
        { at: 12, ratio: 0.5, judgement: 'ok', comment: '直近の平均からやや離れています。' },
      ],
      otherwise: { judgement: 'watch', comment: '直近の平均から大きく離れています。短期的な行き過ぎの反動が出やすい状態です。' },
    }),
  ];

  const { score, coverage, stars } = aggregate(metrics, MAX);

  const change20 = t.change20d ?? 0;
  const comment =
    score === null
      ? 'チャートを判断するためのデータが不足しています。'
      : change20 > 20
        ? `直近1か月で${signedPct(change20)}と急ピッチで上昇しています。買うタイミングは特に慎重に考えたい局面です。`
        : change20 < -15
          ? `直近1か月で${signedPct(change20)}と大きく下落しています。下落の理由（業績なのか市場全体なのか）の確認が先です。`
          : score >= 8
            ? '株価の位置・勢いともに落ち着いており、極端な高値づかみになりにくい状態です。'
            : score >= 5
              ? '株価は方向感がはっきりしません。慌てて判断する必要はない局面です。'
              : '株価の勢いは弱い、または高値圏で過熱気味です。タイミングには注意が必要です。';

  return { key: 'technical', label: 'チャート', plainLabel: '株価の位置と勢い', score, max: MAX, stars, metrics, coverage, comment };
}

