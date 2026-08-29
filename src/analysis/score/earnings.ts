import type { Stock } from '../../types/stock';
import type { CategoryScore } from '../types';
import { aggregate, buildMetric, cagr, pct, signedPct } from './common';

const MAX = 20;

export function scoreEarnings(s: Stock): CategoryScore {
  const actuals = s.fiscal.filter((f) => !f.isForecast);
  const oldest = actuals[0];
  const latest = actuals[actuals.length - 1];
  const years = Math.max(actuals.length - 1, 1);

  const revenueCagr = cagr(oldest?.revenue, latest?.revenue, years);
  const opCagr = cagr(oldest?.operatingIncome, latest?.operatingIncome, years);
  const epsCagr = cagr(oldest?.eps, latest?.eps, years);

  const metrics = [
    buildMetric({
      key: 'revenueGrowth',
      label: '売上成長（年平均）',
      term: 'revenue',
      max: 4,
      value: revenueCagr,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 15, ratio: 1, judgement: 'good', comment: '売上が年15%以上のペースで伸びています。事業が拡大していると読めます。' },
        { at: 7, ratio: 0.85, judgement: 'good', comment: '売上が着実に伸びています。' },
        { at: 2, ratio: 0.6, judgement: 'ok', comment: '売上はゆるやかに伸びています。' },
        { at: -2, ratio: 0.35, judgement: 'watch', comment: '売上はほぼ横ばいです。成長を期待する銘柄ではありません。' },
      ],
      otherwise: { judgement: 'bad', comment: '売上が減少傾向です。なぜ減っているのかを確認する必要があります。' },
    }),
    buildMetric({
      key: 'operatingIncomeGrowth',
      label: '営業利益成長（年平均）',
      term: 'operatingIncome',
      max: 4,
      value: opCagr,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 20, ratio: 1, judgement: 'good', comment: '本業の利益が大きく伸びています。' },
        { at: 8, ratio: 0.85, judgement: 'good', comment: '本業の利益が順調に伸びています。' },
        { at: 0, ratio: 0.55, judgement: 'ok', comment: '本業の利益は横ばい〜微増です。' },
        { at: -10, ratio: 0.25, judgement: 'watch', comment: '本業の利益が減っています。一時的な要因かどうか確認が必要です。' },
      ],
      otherwise: { judgement: 'bad', comment: '本業の利益が大きく減っています。事業環境の悪化に注意が必要です。' },
      naComment: '営業利益が開示されない業種（銀行など）のため、この項目は評価に使っていません。',
    }),
    buildMetric({
      key: 'operatingMargin',
      label: '営業利益率',
      term: 'operatingMargin',
      max: 3,
      value: s.financials.operatingMargin,
      dir: 'high',
      format: (v) => pct(v),
      tiers: [
        { at: 20, ratio: 1, judgement: 'good', comment: '売上に対する本業の利益率が高く、価格競争力があると読めます。' },
        { at: 10, ratio: 0.8, judgement: 'good', comment: '利益率は比較的高い水準です。' },
        { at: 5, ratio: 0.55, judgement: 'ok', comment: '利益率は平均的な水準です。' },
        { at: 2, ratio: 0.3, judgement: 'watch', comment: '利益率が低めです。コスト上昇の影響を受けやすい可能性があります。' },
      ],
      otherwise: { judgement: 'bad', comment: '利益率が非常に低く、わずかなコスト増で赤字になりやすい状態です。' },
    }),
    buildMetric({
      key: 'epsGrowth',
      label: 'EPS成長（年平均）',
      term: 'eps',
      max: 3,
      value: epsCagr,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 15, ratio: 1, judgement: 'good', comment: '1株あたりの利益が大きく伸びています。株主の取り分が増えています。' },
        { at: 5, ratio: 0.8, judgement: 'good', comment: '1株あたりの利益が伸びています。' },
        { at: 0, ratio: 0.5, judgement: 'ok', comment: '1株あたりの利益はほぼ横ばいです。' },
      ],
      otherwise: { judgement: 'watch', comment: '1株あたりの利益が減っています。増資や業績悪化の影響を確認しましょう。' },
    }),
    buildMetric({
      key: 'roe',
      label: 'ROE（自己資本利益率）',
      term: 'roe',
      max: 3,
      value: s.financials.roe,
      dir: 'high',
      format: (v) => pct(v),
      tiers: [
        { at: 15, ratio: 1, judgement: 'good', comment: '一般に優良とされる10%を大きく超えており、資本を効率よく使えています。' },
        { at: 10, ratio: 0.8, judgement: 'good', comment: '一般に優良とされる10%を超えています。' },
        { at: 5, ratio: 0.5, judgement: 'ok', comment: '平均的な水準です。' },
      ],
      otherwise: { judgement: 'watch', comment: '資本の使い方の効率が低めです。利益がしっかり出ているか確認しましょう。' },
    }),
    buildMetric({
      key: 'roa',
      label: 'ROA（総資産利益率）',
      term: 'roa',
      max: 3,
      value: s.financials.roa,
      dir: 'high',
      format: (v) => pct(v),
      tiers: [
        { at: 8, ratio: 1, judgement: 'good', comment: '持っている資産から効率よく利益を生み出しています。' },
        { at: 4, ratio: 0.75, judgement: 'good', comment: '資産あたりの利益は良好です。' },
        { at: 1.5, ratio: 0.5, judgement: 'ok', comment: '平均的な水準です。銀行など資産の大きい業種では低く出ます。' },
      ],
      otherwise: { judgement: 'watch', comment: '資産に対する利益が小さめです。業種特性か、収益力の問題かを見る必要があります。' },
    }),
  ];

  const { score, coverage, stars } = aggregate(metrics, MAX);

  const comment =
    score === null
      ? '業績を判断するためのデータが不足しています。'
      : score >= 16
        ? '売上・利益ともに伸びており、業績面は強みと言えます。'
        : score >= 11
          ? '業績は概ね安定していますが、突出した強さまでは見られません。'
          : score >= 6
            ? '業績はやや弱く、成長よりも回復を待つ局面と読めます。'
            : '業績が悪化傾向です。理由を確認せずに買うのは避けたい状況です。';

  return { key: 'earnings', label: '業績', plainLabel: 'ちゃんと儲かっているか', score, max: MAX, stars, metrics, coverage, comment };
}
