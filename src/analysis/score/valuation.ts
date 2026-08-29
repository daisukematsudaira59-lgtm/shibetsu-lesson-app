import type { Stock } from '../../types/stock';
import type { CategoryScore } from '../types';
import { aggregate, buildMetric, pct, signedPct, times } from './common';

const MAX = 20;

export function scoreValuation(s: Stock): CategoryScore {
  const v = s.valuation;
  const perVsAvg =
    v.forwardPer !== undefined && v.perAvg5y !== undefined && v.perAvg5y > 0
      ? ((v.forwardPer - v.perAvg5y) / v.perAvg5y) * 100
      : undefined;
  const pbrVsAvg =
    v.pbr !== undefined && v.pbrAvg5y !== undefined && v.pbrAvg5y > 0
      ? ((v.pbr - v.pbrAvg5y) / v.pbrAvg5y) * 100
      : undefined;

  const metrics = [
    buildMetric({
      key: 'forwardPer',
      label: '予想PER',
      term: 'per',
      max: 6,
      value: v.forwardPer,
      dir: 'low',
      format: (x) => times(x),
      tiers: [
        { at: 10, ratio: 1, judgement: 'good', comment: '利益に対して株価が低く抑えられており、数字の上では割安な水準です。ただし「安いには理由がある」場合もあります。' },
        { at: 15, ratio: 0.8, judgement: 'good', comment: '日本株の平均的な水準（15倍前後）より低めです。' },
        { at: 22, ratio: 0.55, judgement: 'ok', comment: '平均的な水準です。極端に割安でも割高でもありません。' },
        { at: 35, ratio: 0.3, judgement: 'watch', comment: '利益に対して株価は高めです。今後の成長が前提になっている価格と言えます。' },
      ],
      otherwise: { judgement: 'bad', comment: '利益に対して株価がかなり高い水準です。期待どおり伸びなかった場合の下落幅に注意が必要です。' },
      naComment: '会社予想EPSが公表されていない（または赤字予想）ため、PERでは評価できません。',
    }),
    buildMetric({
      key: 'perVsAvg',
      label: '過去平均PERとの比較',
      term: 'perAvg',
      max: 4,
      value: perVsAvg,
      dir: 'low',
      format: (x) => `${signedPct(x, 0)}（過去平均比）`,
      tiers: [
        { at: -25, ratio: 1, judgement: 'good', comment: 'この銘柄自身の過去の平均と比べても、かなり低い評価にとどまっています。' },
        { at: -8, ratio: 0.8, judgement: 'good', comment: 'この銘柄の過去平均より低い水準です。' },
        { at: 10, ratio: 0.55, judgement: 'ok', comment: 'この銘柄の過去平均と同じくらいの水準です。' },
        { at: 35, ratio: 0.25, judgement: 'watch', comment: 'この銘柄の過去平均より高く評価されています。期待が先行している可能性があります。' },
      ],
      otherwise: { judgement: 'bad', comment: '過去平均を大きく上回る評価です。過去のレンジに戻る形で調整するリスクがあります。' },
      naComment: '過去平均PERのデータがないため比較できていません。',
    }),
    buildMetric({
      key: 'pbr',
      label: 'PBR',
      term: 'pbr',
      max: 4,
      value: v.pbr,
      dir: 'low',
      format: (x) => times(x, 2),
      tiers: [
        { at: 0.8, ratio: 1, judgement: 'good', comment: '会社の純資産より株価が安い状態です。ただし収益力が弱いために安いケースもあります。' },
        { at: 1.5, ratio: 0.75, judgement: 'good', comment: '純資産に対して株価は控えめな水準です。' },
        { at: 3, ratio: 0.5, judgement: 'ok', comment: '平均的な水準です。' },
        { at: 6, ratio: 0.25, judgement: 'watch', comment: '純資産に対して株価はかなり高い水準です。' },
      ],
      otherwise: { judgement: 'bad', comment: '純資産に対して株価が極端に高い水準です。ブランド力や成長期待が価格に強く織り込まれています。' },
    }),
    buildMetric({
      key: 'pbrVsAvg',
      label: '過去平均PBRとの比較',
      max: 2,
      value: pbrVsAvg,
      dir: 'low',
      format: (x) => `${signedPct(x, 0)}（過去平均比）`,
      tiers: [
        { at: -15, ratio: 1, judgement: 'good', comment: '過去平均より低い水準です。' },
        { at: 15, ratio: 0.6, judgement: 'ok', comment: '過去平均と同程度です。' },
      ],
      otherwise: { judgement: 'watch', comment: '過去平均より高い水準です。' },
      naComment: '過去平均PBRのデータがないため比較できていません。',
    }),
    buildMetric({
      key: 'dividendYieldValue',
      label: '配当利回り（割安さの目安として）',
      term: 'dividendYield',
      max: 2,
      value: v.dividendYield,
      dir: 'high',
      format: (x) => pct(x, 2),
      tiers: [
        { at: 4, ratio: 1, judgement: 'good', comment: '株価に対して受け取れる配当が多く、株価が安めに置かれている可能性があります。' },
        { at: 2.5, ratio: 0.7, judgement: 'ok', comment: '日本株の平均程度の配当利回りです。' },
        { at: 1, ratio: 0.4, judgement: 'ok', comment: '配当利回りは低めです。成長投資を優先する会社に多い傾向です。' },
      ],
      otherwise: { judgement: 'watch', comment: '配当はほとんど出ていません。値上がり益を狙う銘柄になります。' },
    }),
    buildMetric({
      key: 'psr',
      label: 'PSR',
      term: 'psr',
      max: 2,
      value: v.psr,
      dir: 'low',
      format: (x) => times(x, 2),
      tiers: [
        { at: 1, ratio: 1, judgement: 'good', comment: '売上規模に対して株価は控えめです。' },
        { at: 3, ratio: 0.6, judgement: 'ok', comment: '売上規模に対して平均的な水準です。' },
        { at: 8, ratio: 0.3, judgement: 'watch', comment: '売上に対して株価は高めです。' },
      ],
      otherwise: { judgement: 'bad', comment: '売上に対して株価がかなり高い水準です。' },
    }),
  ];

  const { score, coverage, stars } = aggregate(metrics, MAX);

  const comment =
    score === null
      ? '割安かどうかを判断するためのデータが不足しています。'
      : score >= 16
        ? '数字の上では割安な水準です。ただし「安い理由」がないかは必ず確認してください。'
        : score >= 11
          ? '株価は概ね妥当なレンジにあります。極端な割安・割高ではありません。'
          : score >= 6
            ? '株価はやや割高な水準です。買うタイミングには注意したい局面です。'
            : '株価は過去や利益水準と比べて高い位置にあります。期待が外れたときの下落に注意が必要です。';

  return {
    key: 'valuation',
    label: '割安度',
    plainLabel: '今の株価は高い？安い？',
    score,
    max: MAX,
    stars,
    metrics,
    coverage,
    comment,
  };
}
