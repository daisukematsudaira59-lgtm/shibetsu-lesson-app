import type { Stock } from '../../types/stock';
import type { CategoryScore } from '../types';
import { aggregate, buildMetric, pct, signedPct, times } from './common';

const MAX = 20;
const oku = (mil: number) => `${Math.round(mil / 100).toLocaleString()}億円`;

export function scoreFinancial(s: Stock): CategoryScore {
  const f = s.financials;

  // ネット有利子負債 ÷ 営業CF（何年分の稼ぎで返せるか）
  const netDebt =
    f.interestBearingDebt !== undefined && f.cash !== undefined ? f.interestBearingDebt - f.cash : undefined;
  const debtYears =
    netDebt !== undefined && f.operatingCF !== undefined && f.operatingCF > 0
      ? netDebt <= 0
        ? 0
        : netDebt / f.operatingCF
      : undefined;

  const cfChange =
    f.operatingCF !== undefined && f.operatingCFPrev !== undefined && f.operatingCFPrev > 0
      ? ((f.operatingCF - f.operatingCFPrev) / f.operatingCFPrev) * 100
      : undefined;

  const metrics = [
    buildMetric({
      key: 'equityRatio',
      label: '自己資本比率',
      term: 'equityRatio',
      max: 6,
      value: f.equityRatio,
      dir: 'high',
      format: (v) => pct(v),
      tiers: [
        { at: 60, ratio: 1, judgement: 'good', comment: '借金に頼らず自前のお金で経営できており、財務は非常に安定しています。' },
        { at: 40, ratio: 0.8, judgement: 'good', comment: '一般に安全とされる40%を超えています。' },
        { at: 25, ratio: 0.55, judgement: 'ok', comment: '平均的な水準です。' },
        { at: 10, ratio: 0.35, judgement: 'watch', comment: '自己資本の比率が低めです。ただし銀行・通信など借入前提の業種では正常な場合もあります。' },
      ],
      otherwise: { judgement: 'watch', comment: '自己資本が薄い状態です。業種特性かどうかを必ず確認してください。' },
    }),
    buildMetric({
      key: 'netDebtYears',
      label: '実質借入の返済年数',
      term: 'netDebt',
      max: 5,
      value: debtYears,
      dir: 'low',
      format: (v) => (v <= 0 ? '実質無借金' : `${v.toFixed(1)}年分`),
      tiers: [
        { at: 0, ratio: 1, judgement: 'good', comment: '手元の現金が借入を上回る「実質無借金」の状態です。' },
        { at: 2, ratio: 0.85, judgement: 'good', comment: '本業の稼ぎ2年分以内で返せる借入額です。無理のない範囲と読めます。' },
        { at: 5, ratio: 0.55, judgement: 'ok', comment: '借入はありますが、本業の稼ぎで返済できる範囲です。' },
        { at: 10, ratio: 0.3, judgement: 'watch', comment: '借入が本業の稼ぎに対してやや重めです。金利が上がると負担が増えます。' },
      ],
      otherwise: { judgement: 'bad', comment: '借入が本業の稼ぎに対してかなり大きい状態です。金利上昇に弱い点に注意が必要です。' },
      naComment: '有利子負債・現金・営業CFのいずれかが取得できていないため、評価に使っていません。',
    }),
    buildMetric({
      key: 'operatingCF',
      label: '営業キャッシュフロー',
      term: 'operatingCF',
      max: 4,
      value: f.operatingCF,
      dir: 'high',
      format: (v) => oku(v),
      tiers: [
        { at: 1, ratio: 1, judgement: 'good', comment: '本業できちんと現金が入ってきています。利益が「絵に描いた餅」になっていない証拠です。' },
      ],
      otherwise: { judgement: 'bad', comment: '本業で現金が出ていっています。利益が出ていても資金繰りには注意が必要です。' },
    }),
    buildMetric({
      key: 'operatingCFTrend',
      label: '営業CFの前期比',
      max: 3,
      value: cfChange,
      dir: 'high',
      format: (v) => signedPct(v),
      tiers: [
        { at: 10, ratio: 1, judgement: 'good', comment: '本業で稼ぐ現金が増えています。' },
        { at: -5, ratio: 0.65, judgement: 'ok', comment: '本業の現金収入はほぼ横ばいです。' },
        { at: -20, ratio: 0.3, judgement: 'watch', comment: '本業で入ってくる現金が減っています。在庫や売掛金が増えていないか確認したい点です。' },
      ],
      otherwise: { judgement: 'bad', comment: '本業の現金収入が大きく減っています。決算の中身を確認したいポイントです。' },
    }),
    buildMetric({
      key: 'cashRatio',
      label: '現金 ÷ 有利子負債',
      max: 2,
      value:
        f.cash !== undefined && f.interestBearingDebt !== undefined && f.interestBearingDebt > 0
          ? f.cash / f.interestBearingDebt
          : f.cash !== undefined && f.interestBearingDebt === 0
            ? 99
            : undefined,
      dir: 'high',
      format: (v) => (v >= 99 ? '借入なし' : times(v, 2)),
      tiers: [
        { at: 1, ratio: 1, judgement: 'good', comment: '借入額以上の現金を持っています。' },
        { at: 0.4, ratio: 0.65, judgement: 'ok', comment: '借入に対して一定の現金を確保しています。' },
        { at: 0.15, ratio: 0.35, judgement: 'watch', comment: '借入に対して手元現金は少なめです。' },
      ],
      otherwise: { judgement: 'watch', comment: '手元現金が借入に対してかなり少ない状態です。' },
    }),
  ];

  const { score, coverage, stars } = aggregate(metrics, MAX);

  const comment =
    score === null
      ? '財務の安全性を判断するためのデータが不足しています。'
      : score >= 16
        ? '自己資本が厚く借入も軽いため、財務の安全性は高いと読めます。'
        : score >= 11
          ? '財務は概ね安定していますが、借入の重さは意識しておきたい水準です。'
          : score >= 6
            ? '財務にはやや不安が残ります。金利や業績悪化の影響を受けやすい可能性があります。'
            : '財務の負担が重い状態です。業績が崩れたときの耐久力に注意が必要です。';

  return {
    key: 'financial',
    label: '財務安全性',
    plainLabel: 'つぶれにくいか',
    score,
    max: MAX,
    stars,
    metrics,
    coverage,
    comment,
  };
}
