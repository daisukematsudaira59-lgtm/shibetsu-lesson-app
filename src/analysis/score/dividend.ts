import type { Stock } from '../../types/stock';
import type { CategoryScore } from '../types';
import { aggregate, buildMetric, pct } from './common';

const MAX = 10;

export function scoreDividend(s: Stock): CategoryScore {
  const d = s.dividend;

  const metrics = [
    buildMetric({
      key: 'dividendYield',
      label: '配当利回り（予想）',
      term: 'dividendYield',
      max: 4,
      value: d.yield,
      dir: 'high',
      format: (v) => pct(v, 2),
      tiers: [
        { at: 6, ratio: 0.85, judgement: 'watch', comment: '利回りが極端に高い状態です。株価が大きく下がった結果である可能性もあり、減配リスクの確認が必要です。' },
        { at: 3.5, ratio: 1, judgement: 'good', comment: '日本株の平均（約2%）を上回る水準です。配当を目的に持つ選択肢があります。' },
        { at: 2, ratio: 0.7, judgement: 'ok', comment: '平均程度の配当利回りです。' },
        { at: 0.5, ratio: 0.4, judgement: 'ok', comment: '配当利回りは低めです。利益を成長投資に回している可能性があります。' },
      ],
      otherwise: { judgement: 'watch', comment: '配当はほとんど出していません。配当目的には向きません。' },
    }),
    buildMetric({
      key: 'payoutRatio',
      label: '配当性向',
      term: 'payoutRatio',
      max: 3,
      value: d.payoutRatio,
      dir: 'low',
      format: (v) => pct(v, 1),
      tiers: [
        { at: 20, ratio: 0.6, judgement: 'ok', comment: '利益に対して配当は控えめです。増配の余地はありますが、今の受取額は少なめです。' },
        { at: 50, ratio: 1, judgement: 'good', comment: '利益の範囲内で無理なく配当を出せています。' },
        { at: 70, ratio: 0.6, judgement: 'ok', comment: '利益のうち配当に回す割合が高めです。業績が落ちると配当維持が難しくなる可能性があります。' },
        { at: 100, ratio: 0.3, judgement: 'watch', comment: '利益のほとんどを配当に回しています。減益局面では減配リスクが高まります。' },
      ],
      otherwise: { judgement: 'bad', comment: '利益を超える配当を出しています。長く続けるのが難しい水準で、減配のリスクを意識する必要があります。' },
    }),
    buildMetric({
      key: 'consecutiveIncrease',
      label: '連続増配年数',
      term: 'consecutiveIncrease',
      max: 2,
      value: d.consecutiveIncreaseYears,
      dir: 'high',
      format: (v) => (v === 0 ? 'なし' : `${v}年`),
      tiers: [
        { at: 10, ratio: 1, judgement: 'good', comment: '長期にわたって配当を増やし続けており、株主還元の姿勢が明確です。' },
        { at: 3, ratio: 0.8, judgement: 'good', comment: '数年にわたり増配を続けています。' },
        { at: 1, ratio: 0.5, judgement: 'ok', comment: '直近は増配しています。' },
      ],
      otherwise: { judgement: 'watch', comment: '連続増配の実績はありません。配当は横ばい、または変動する可能性があります。' },
    }),
    buildMetric({
      key: 'cutHistory',
      label: '過去の減配',
      max: 1,
      value: d.hasCutHistory === undefined ? undefined : d.hasCutHistory ? 1 : 0,
      dir: 'low',
      format: (v) => (v === 1 ? 'あり' : 'なし（直近5期）'),
      tiers: [{ at: 0, ratio: 1, judgement: 'good', comment: '直近では減配していません。' }],
      otherwise: {
        judgement: 'watch',
        comment: '過去に配当を減らした実績があります。業績が悪化すると配当も動く銘柄だと理解しておく必要があります。',
      },
    }),
  ];

  const { score, coverage, stars } = aggregate(metrics, MAX);

  const comment =
    score === null
      ? '配当を判断するためのデータが不足しています。'
      : score >= 8
        ? '利回り・継続性ともに良好で、配当を目的に持つ選択肢がある銘柄です。'
        : score >= 5
          ? '配当は出ていますが、利回りか継続性のどちらかに物足りなさがあります。'
          : '配当を主目的に持つには不安が残ります。減配の可能性も含めて考える必要があります。';

  return { key: 'dividend', label: '配当', plainLabel: 'もらえる配当', score, max: MAX, stars, metrics, coverage, comment };
}
