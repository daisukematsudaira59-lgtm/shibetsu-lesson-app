import type { Stock } from '../types/stock';
import type { TechnicalSnapshot } from './indicators';

export interface PriceBand {
  key: 'deep' | 'cheap' | 'current' | 'rich';
  label: string;
  value: number | null;
  /** 現在株価との差(%) */
  diffPercent: number | null;
  note: string;
}

export interface PriceReference {
  current: number;
  bands: PriceBand[];
  /** どの根拠から計算したか（初心者に「なぜ」を示すため） */
  basis: string[];
  available: boolean;
  disclaimer: string;
  /** 0(割安)〜100(割高) の位置。null なら判定不能 */
  levelPosition: number | null;
  levelLabel: '割安より' | '適正圏' | '割高より' | '判定できません';
}

const round = (v: number) => (v >= 1000 ? Math.round(v) : Math.round(v * 10) / 10);

/**
 * 「いくらなら買いやすい？」の参考レンジ（要件10）。
 * 適正株価を断定するものではなく、複数の根拠からレンジを示すだけ。
 */
export function buildPriceReference(s: Stock, t: TechnicalSnapshot | null): PriceReference {
  const price = s.quote.price;
  const basis: string[] = [];
  /** 「過去の評価水準に戻った場合の株価」の候補。平均を中心値として使う。 */
  const fairCandidates: number[] = [];

  const forecast = s.fiscal.find((f) => f.isForecast);
  const eps = forecast?.eps;
  const { perAvg5y, pbrAvg5y } = s.valuation;

  if (eps !== undefined && eps > 0 && perAvg5y !== undefined) {
    fairCandidates.push(eps * perAvg5y);
    basis.push(`会社予想EPS ${eps.toFixed(1)}円 × 過去平均PER ${perAvg5y.toFixed(1)}倍 = ${Math.round(eps * perAvg5y).toLocaleString()}円`);
  }

  const bps = forecast?.bps;
  if (bps !== undefined && bps > 0 && pbrAvg5y !== undefined) {
    fairCandidates.push(bps * pbrAvg5y);
    basis.push(`会社予想BPS ${bps.toFixed(0)}円 × 過去平均PBR ${pbrAvg5y.toFixed(2)}倍 = ${Math.round(bps * pbrAvg5y).toLocaleString()}円`);
  }

  // 配当利回りから：予想配当が「日本株の平均的な利回り水準」になる株価。
  // 利益・資産ベースの根拠が取れないときの代替としてのみ使う
  // （高配当銘柄では中心値を大きく押し上げてしまうため）。
  const dps = forecast?.dividendPerShare;
  const hist = s.dividend.historyPerShare;
  if (fairCandidates.length === 0 && dps !== undefined && dps > 0 && hist && hist.length >= 3) {
    const targetYield = 2.5;
    fairCandidates.push(dps / (targetYield / 100));
    basis.push(`予想配当 ${dps}円 が利回り ${targetYield.toFixed(1)}% になる株価 = ${Math.round(dps / (targetYield / 100)).toLocaleString()}円`);
  }

  if (t) {
    fairCandidates.push((t.high52w + t.low52w) / 2);
    basis.push(`過去52週レンジ ${Math.round(t.low52w).toLocaleString()}円 〜 ${Math.round(t.high52w).toLocaleString()}円 の中央値`);
  }

  const available = fairCandidates.length >= 2;
  const fair = fairCandidates.length ? fairCandidates.reduce((a, b) => a + b, 0) / fairCandidates.length : null;

  const deep = fair === null ? null : fair * 0.75;
  const cheap = fair === null ? null : fair * 0.9;
  const rich = fair === null ? null : fair * 1.2;

  // 参考中心値からの乖離を 0〜100 に。±20% で端に振り切る。
  const levelPosition =
    !available || fair === null || fair <= 0
      ? null
      : Math.max(0, Math.min(100, 50 + (price / fair - 1) * 250));

  const levelLabel =
    levelPosition === null
      ? '判定できません'
      : levelPosition < 38
        ? '割安より'
        : levelPosition <= 62
          ? '適正圏'
          : '割高より';

  const bands: PriceBand[] = [
    {
      key: 'deep',
      label: 'かなり割安な水準（参考）',
      value: deep === null ? null : round(deep),
      diffPercent: deep === null ? null : Math.round(((deep - price) / price) * 100),
      note: '過去の評価水準を大きく下回る価格帯です。ここまで下がるとは限りません。',
    },
    {
      key: 'cheap',
      label: '比較的割安な水準（参考）',
      value: cheap === null ? null : round(cheap),
      diffPercent: cheap === null ? null : Math.round(((cheap - price) / price) * 100),
      note: '過去の平均的な評価水準よりやや低い価格帯です。',
    },
    {
      key: 'current',
      label: '現在株価',
      value: price,
      diffPercent: 0,
      note: '今の市場価格です。',
    },
    {
      key: 'rich',
      label: '割高に見えやすい水準（参考）',
      value: rich === null ? null : round(rich),
      diffPercent: rich === null ? null : Math.round(((rich - price) / price) * 100),
      note: '過去の評価水準を上回る価格帯です。',
    },
  ];

  return {
    current: price,
    bands,
    basis,
    available,
    levelPosition,
    levelLabel: levelLabel as PriceReference['levelLabel'],
    disclaimer:
      'これは「適正株価」ではなく、過去の指標から機械的に計算した分析上の参考レンジです。この価格になることを保証するものではありません。',
  };
}
