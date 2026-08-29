import type { Stock } from '../types/stock';
import type { TechnicalSnapshot } from '../analysis/indicators';
import type { CategoryScore } from '../analysis/types';

export interface CheckPoint {
  id: string;
  label: string;
  value: string;
  /** なぜこれを見るのか */
  why: string;
}

export interface PreBuyGuide {
  /** 「この株を買う前に確認する5項目」 */
  points: CheckPoint[];
  /** 現在の株価水準で注意すべきポイント */
  priceLevelNote: string;
}

const fmtDate = (d?: string) => {
  if (!d) return '未定・取得できていません';
  const dt = new Date(d + 'T00:00:00');
  const days = Math.ceil((dt.getTime() - Date.now()) / 86400000);
  return `${d}（あと約${days}日）`;
};

export function buildPreBuyGuide(s: Stock, cats: CategoryScore[], t: TechnicalSnapshot | null): PreBuyGuide {
  const forecast = s.fiscal.find((f) => f.isForecast);
  const val = cats.find((c) => c.key === 'valuation');

  const points: CheckPoint[] = [
    {
      id: 'earnings-date',
      label: '① 次回決算日',
      value: fmtDate(s.nextEarningsDate),
      why: '決算の前後は株価が大きく動きます。買った翌日に決算、という状況を避けるだけでも慌てにくくなります。',
    },
    {
      id: 'forecast',
      label: '② 会社予想',
      value: forecast
        ? `${forecast.label}：売上 ${forecast.revenue ? Math.round(forecast.revenue / 100).toLocaleString() + '億円' : 'ー'} / 純利益 ${forecast.netIncome ? Math.round(forecast.netIncome / 100).toLocaleString() + '億円' : 'ー'}`
        : '会社予想が取得できていません',
      why: '株価は「これからの利益」で動きます。過去の実績より、会社自身が出している今期の見通しが重要です。',
    },
    {
      id: 'per',
      label: '③ PER（株価が利益の何倍か）',
      value:
        s.valuation.forwardPer !== undefined
          ? `予想PER ${s.valuation.forwardPer.toFixed(1)}倍${s.valuation.perAvg5y ? `（過去平均 ${s.valuation.perAvg5y.toFixed(1)}倍）` : ''}`
          : '算出できません（会社予想EPSが未取得か赤字予想）',
      why: '同じ会社でも、買う値段が高すぎると利益が出ません。過去の平均と比べて今が高いか安いかを見ます。',
    },
    {
      id: 'dividend',
      label: '④ 配当',
      value:
        s.dividend.yield !== undefined
          ? `予想利回り ${s.dividend.yield.toFixed(2)}% / 1株 ${s.dividend.perShare ?? 'ー'}円${s.dividend.payoutRatio !== undefined ? ` / 配当性向 ${s.dividend.payoutRatio.toFixed(0)}%` : ''}`
          : '配当データが取得できていません',
      why: '配当は受け取れる現金です。ただし配当性向が高すぎると、業績が落ちたときに減配される可能性があります。',
    },
    {
      id: 'chart',
      label: '⑤ チャート（株価の位置）',
      value: t
        ? `52週レンジ ${Math.round(t.low52w).toLocaleString()}〜${Math.round(t.high52w).toLocaleString()}円のうち ${t.positionInRange.toFixed(0)}% の位置 / 直近1か月 ${t.change20d === null ? 'ー' : (t.change20d >= 0 ? '+' : '') + t.change20d.toFixed(1) + '%'}`
        : 'チャートデータが不足しています',
      why: '同じ会社でも、1年の高値圏で買うか安値圏で買うかで結果は変わります。急上昇の直後は特に注意が必要です。',
    },
  ];

  const surge = (t?.change20d ?? 0) >= 15;
  const nearHigh = (t?.positionInRange ?? 50) >= 85;
  const nearLow = (t?.positionInRange ?? 50) <= 15;
  const richValuation = val?.score !== null && val !== undefined && val.score !== null && val.score <= 8;

  let priceLevelNote: string;
  if (surge && nearHigh) {
    priceLevelNote =
      '直近で急上昇し、1年の高値圏にあります。この水準で買うと、少しの悪材料でも含み損になりやすい状態です。買う場合でも一度に全額を投じない方法を検討してください。';
  } else if (nearHigh || richValuation) {
    priceLevelNote =
      '株価は高めの水準にあります。今の価格は「今後も業績が伸びること」を前提にしていると考えられるため、会社予想の達成度合いを確認することが特に重要です。';
  } else if (nearLow) {
    priceLevelNote =
      '株価は1年の安値圏にあります。安く見えますが、業績悪化が理由で下がっている場合はさらに下げることもあります。「なぜ安いのか」を先に確認してください。';
  } else {
    priceLevelNote =
      '株価は極端に高い位置でも安い位置でもありません。焦って判断する必要はない水準です。決算や配当の内容を確認したうえで検討してください。';
  }

  return { points, priceLevelNote };
}

export interface ChecklistItem {
  id: string;
  label: string;
  hint: string;
}

/** 「この株を初心者が買う前に」チェックリスト（要件19） */
export const PRE_BUY_CHECKLIST: ChecklistItem[] = [
  { id: 'earnings', label: '業績を確認した', hint: '売上と利益が伸びているか、減っているかを見ましたか。' },
  { id: 'per', label: 'PERを確認した', hint: '過去の平均と比べて、今の株価が高いか安いかを見ましたか。' },
  { id: 'dividend', label: '配当を確認した', hint: '利回りだけでなく、配当性向（無理をしていないか）も見ましたか。' },
  { id: 'date', label: '決算日を確認した', hint: '買った直後に決算が来ないかを確認しましたか。' },
  { id: 'surge', label: '株価が急騰していないか確認した', hint: '直近1か月の値動きを見ましたか。' },
  { id: 'budget', label: '自分の予算内か確認した', hint: '生活に必要なお金まで使っていませんか。' },
  { id: 'concentration', label: '1銘柄に資金を集中していない', hint: '同じ会社・同じ業種に偏っていませんか。' },
  { id: 'reason', label: 'なぜこの会社に投資するのか説明できる', hint: '人に一言で説明できないなら、まだ調べ足りないサインです。' },
];
