import type { Stock } from '../../types/stock';
import type { CategoryScore } from '../types';
import { aggregate, buildMetric, cagr, signedPct } from './common';

const MAX = 20;

const growthOf = (a?: number, b?: number) =>
  a !== undefined && b !== undefined && b > 0 ? ((a - b) / b) * 100 : undefined;

export function scoreGrowth(s: Stock): CategoryScore {
  const actuals = s.fiscal.filter((f) => !f.isForecast);
  const forecast = s.fiscal.find((f) => f.isForecast);
  const latest = actuals[actuals.length - 1];
  const years = Math.max(actuals.length - 1, 1);

  const revCagr = cagr(actuals[0]?.revenue, latest?.revenue, years);
  const profitCagr = cagr(actuals[0]?.netIncome, latest?.netIncome, years);
  const fcRevGrowth = growthOf(forecast?.revenue, latest?.revenue);
  const fcProfitGrowth = growthOf(forecast?.netIncome, latest?.netIncome);

  // 何期連続で増収したか（成長の一貫性）
  let streak = 0;
  for (let i = actuals.length - 1; i > 0; i--) {
    const cur = actuals[i].revenue;
    const prev = actuals[i - 1].revenue;
    if (cur !== undefined && prev !== undefined && cur > prev) streak++;
    else break;
  }

  const metrics = [
    buildMetric({
      key: 'pastRevenueGrowth',
      label: '過去の売上成長率（年平均）',
      max: 5,
      value: revCagr,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 15, ratio: 1, judgement: 'good', comment: '過去数年で売上を大きく伸ばしてきた実績があります。' },
        { at: 7, ratio: 0.8, judgement: 'good', comment: '売上は着実に拡大してきました。' },
        { at: 2, ratio: 0.55, judgement: 'ok', comment: '売上はゆるやかな拡大にとどまります。' },
      ],
      otherwise: { judgement: 'watch', comment: '売上の拡大は見られません。成長株というより安定・割安株として見る銘柄です。' },
    }),
    buildMetric({
      key: 'pastProfitGrowth',
      label: '過去の利益成長率（年平均）',
      max: 5,
      value: profitCagr,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 20, ratio: 1, judgement: 'good', comment: '利益の伸びが売上を上回っており、稼ぐ力が強まっています。' },
        { at: 8, ratio: 0.8, judgement: 'good', comment: '利益は順調に伸びてきました。' },
        { at: 0, ratio: 0.5, judgement: 'ok', comment: '利益は横ばい圏です。' },
      ],
      otherwise: { judgement: 'watch', comment: '利益は減少傾向です。構造的な問題か一時的な要因かの確認が必要です。' },
      naComment: '過去に赤字の期があるため、年平均成長率を計算できません。',
    }),
    buildMetric({
      key: 'forecastRevenue',
      label: '今期の会社予想（売上）',
      term: 'companyForecast',
      max: 4,
      value: fcRevGrowth,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 10, ratio: 1, judgement: 'good', comment: '会社自身が二桁の増収を見込んでいます。' },
        { at: 3, ratio: 0.75, judgement: 'good', comment: '会社は増収を見込んでいます。' },
        { at: -1, ratio: 0.5, judgement: 'ok', comment: '会社予想は横ばいです。' },
      ],
      otherwise: { judgement: 'watch', comment: '会社自身が減収を見込んでいます。理由の確認が必要です。' },
      naComment: '会社予想が公表されていない（または未定）ため評価できません。',
    }),
    buildMetric({
      key: 'forecastProfit',
      label: '今期の会社予想（純利益）',
      term: 'companyForecast',
      max: 4,
      value: fcProfitGrowth,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 15, ratio: 1, judgement: 'good', comment: '会社自身が大幅な増益を見込んでいます。' },
        { at: 3, ratio: 0.75, judgement: 'good', comment: '会社は増益を見込んでいます。' },
        { at: -3, ratio: 0.5, judgement: 'ok', comment: '会社予想はほぼ横ばいです。' },
        { at: -20, ratio: 0.2, judgement: 'watch', comment: '会社自身が減益を見込んでいます。今の株価がそれを織り込んでいるか確認が必要です。' },
      ],
      otherwise: { judgement: 'bad', comment: '会社自身が大幅な減益を見込んでいます。株価が下がる要因になりやすい点に注意してください。' },
      naComment: '会社予想が公表されていない（または未定）ため評価できません。',
    }),
    buildMetric({
      key: 'growthConsistency',
      label: '連続増収',
      max: 2,
      value: streak,
      dir: 'high',
      format: (v) => (v === 0 ? 'なし' : `${v}期連続`),
      tiers: [
        { at: 3, ratio: 1, judgement: 'good', comment: '毎期きちんと売上を伸ばしてきており、成長に再現性があります。' },
        { at: 1, ratio: 0.6, judgement: 'ok', comment: '直近は増収を維持しています。' },
      ],
      otherwise: { judgement: 'watch', comment: '直近は増収が途切れています。' },
    }),
  ];

  const { score, coverage, stars } = aggregate(metrics, MAX);

  const comment =
    score === null
      ? '成長性を判断するためのデータが不足しています。'
      : score >= 16
        ? '過去の実績・会社予想ともに成長が見込まれており、成長性は強みです。'
        : score >= 11
          ? '一定の成長は見込まれますが、爆発的な伸びを期待する段階ではありません。'
          : score >= 6
            ? '成長のペースは緩やかです。値上がりより配当や割安さで見る銘柄かもしれません。'
            : '成長は期待しにくい状況です。株価が上がる材料が何かを考える必要があります。';

  return { key: 'growth', label: '成長性', plainLabel: 'これから伸びそうか', score, max: MAX, stars, metrics, coverage, comment };
}
