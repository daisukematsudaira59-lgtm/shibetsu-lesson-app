import type { Stock } from '../types/stock';

export type EarningsVerdict = 'good' | 'fair' | 'caution' | 'bad' | 'unknown';

export interface EarningsAnalysis {
  verdict: EarningsVerdict;
  label: string;
  /** なぜそう評価したかを3行で */
  reasons: string[];
  rows: { label: string; value: string; sub?: string }[];
  note: string;
}

const oku = (mil?: number) => (mil === undefined ? 'ー' : `${Math.round(mil / 100).toLocaleString()}億円`);
const yoy = (v?: number) => (v === undefined ? 'ー' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

/** 決算を「良い / まずまず / 注意 / 悪い」に分類する（要件15） */
export function analyzeEarnings(s: Stock): EarningsAnalysis | null {
  const e = s.latestEarnings;
  if (!e) return null;

  const rows = [
    { label: '売上高', value: oku(e.revenue), sub: `前年同期比 ${yoy(e.revenueYoY)}` },
    { label: '営業利益', value: oku(e.operatingIncome), sub: `前年同期比 ${yoy(e.operatingIncomeYoY)}` },
    { label: '純利益', value: oku(e.netIncome), sub: `前年同期比 ${yoy(e.netIncomeYoY)}` },
    {
      label: '通期会社予想への進捗率',
      value: e.progressRate === undefined ? 'ー' : `${e.progressRate.toFixed(1)}%`,
      sub: e.progressRate === undefined ? 'データなし' : '四半期あたり25%が一つの目安',
    },
    {
      label: '市場予想との比較',
      value: e.vsConsensus === undefined ? '取得できていません' : `${e.vsConsensus >= 0 ? '+' : ''}${e.vsConsensus.toFixed(1)}%`,
      sub: e.vsConsensus === undefined ? '市場予想データが未接続のため比較していません' : undefined,
    },
    {
      label: '会社予想の修正',
      value:
        e.guidanceRevision === 'up'
          ? '上方修正'
          : e.guidanceRevision === 'down'
            ? '下方修正'
            : e.guidanceRevision === 'none'
              ? '修正なし'
              : 'ー',
    },
  ];

  const signals: number[] = [];
  const reasons: string[] = [];

  if (e.revenueYoY !== undefined) {
    signals.push(e.revenueYoY >= 8 ? 2 : e.revenueYoY >= 0 ? 1 : -1);
    reasons.push(
      e.revenueYoY >= 0
        ? `売上は前年同期比 ${yoy(e.revenueYoY)} と増加しています。`
        : `売上は前年同期比 ${yoy(e.revenueYoY)} と減少しています。`
    );
  }

  const profitYoY = e.operatingIncomeYoY ?? e.netIncomeYoY;
  if (profitYoY !== undefined) {
    signals.push(profitYoY >= 15 ? 2 : profitYoY >= 0 ? 1 : profitYoY >= -15 ? -1 : -2);
    reasons.push(
      profitYoY >= 0
        ? `利益は前年同期比 ${yoy(profitYoY)} と伸びており、本業の状況は改善しています。`
        : `利益は前年同期比 ${yoy(profitYoY)} と減っており、コストや需要の影響が出ています。`
    );
  }

  if (e.progressRate !== undefined) {
    const quarterHint = e.period.includes('第1') ? 25 : e.period.includes('第2') ? 50 : e.period.includes('第3') ? 75 : 100;
    const diff = e.progressRate - quarterHint;
    signals.push(diff >= 3 ? 2 : diff >= -3 ? 1 : diff >= -8 ? -1 : -2);
    reasons.push(
      diff >= -3
        ? `通期予想に対する進捗率は${e.progressRate.toFixed(1)}%で、順調なペースです。`
        : `通期予想に対する進捗率は${e.progressRate.toFixed(1)}%で、目安（${quarterHint}%）を下回っています。`
    );
  }

  if (e.guidanceRevision === 'up') {
    signals.push(2);
    reasons.unshift('会社が通期の業績予想を上方修正しました。');
  } else if (e.guidanceRevision === 'down') {
    signals.push(-3);
    reasons.unshift('会社が通期の業績予想を下方修正しました。株価にはマイナス材料になりやすい内容です。');
  }

  if (e.vsConsensus !== undefined) {
    signals.push(e.vsConsensus >= 3 ? 1 : e.vsConsensus >= -3 ? 0 : -1);
  }

  if (signals.length === 0) {
    return {
      verdict: 'unknown',
      label: '判断材料不足',
      reasons: ['決算の比較に使える数値が取得できていないため、評価していません。'],
      rows,
      note: 'データが揃っていない決算に、無理に評価は付けません。',
    };
  }

  const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
  const verdict: EarningsVerdict = avg >= 1.5 ? 'good' : avg >= 0.5 ? 'fair' : avg >= -0.5 ? 'caution' : 'bad';
  const label = { good: '良い', fair: 'まずまず', caution: '注意', bad: '悪い', unknown: '判断材料不足' }[verdict];

  return {
    verdict,
    label,
    reasons: reasons.slice(0, 3),
    rows,
    note: '決算が良くても株価が下がることはあります（すでに株価に織り込まれていた場合など）。評価は決算内容そのものに対するものです。',
  };
}
