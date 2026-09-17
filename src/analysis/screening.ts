import type { Stock } from '../types/stock';
import { analyze, type StockAnalysis } from './index';

export interface Pick {
  analysis: StockAnalysis;
  /** なぜこのリストに入っているのか */
  reason: string;
  /** 並べ替えに使ったスコア */
  rank: number;
}

export interface PickList {
  key: string;
  title: string;
  subtitle: string;
  /** 何を基準に選んだか（初心者に「なぜ」を示す） */
  criteria: string;
  picks: Pick[];
}

const cat = (a: StockAnalysis, k: string) => a.categories.find((c) => c.key === k);
const sc = (a: StockAnalysis, k: string) => cat(a, k)?.score ?? null;
const ratio = (a: StockAnalysis, k: string) => {
  const c = cat(a, k);
  return c && c.score !== null ? c.score / c.max : 0;
};

/** ホーム画面の7カテゴリ（要件3） */
export function buildHomeLists(stocks: Stock[]): PickList[] {
  const all = stocks.map(analyze);

  const attention: PickList = {
    key: 'attention',
    title: '① 今日注目されている株',
    subtitle: '値動きが大きい銘柄',
    criteria: '前日比の変動幅が大きい順。値動きが大きい＝良い銘柄という意味ではありません。',
    picks: [...all]
      .sort((a, b) => Math.abs(b.stock.quote.changePercent) - Math.abs(a.stock.quote.changePercent))
      .slice(0, 5)
      .map((a) => ({
        analysis: a,
        rank: Math.abs(a.stock.quote.changePercent),
        reason: `前日比 ${a.stock.quote.changePercent >= 0 ? '+' : ''}${a.stock.quote.changePercent.toFixed(2)}% と値動きが大きくなっています。`,
      })),
  };

  const value: PickList = {
    key: 'value',
    title: '② 割安株候補',
    subtitle: '株価指標が控えめな銘柄',
    criteria: '割安度スコアが高く、かつ業績スコアが一定以上の銘柄。安さだけでは選びません。',
    picks: all
      .filter((a) => ratio(a, 'valuation') >= 0.6 && ratio(a, 'earnings') >= 0.4)
      .sort((a, b) => ratio(b, 'valuation') - ratio(a, 'valuation'))
      .slice(0, 5)
      .map((a) => ({
        analysis: a,
        rank: ratio(a, 'valuation'),
        reason: `予想PER ${a.stock.valuation.forwardPer?.toFixed(1) ?? 'ー'}倍・PBR ${a.stock.valuation.pbr?.toFixed(2) ?? 'ー'}倍。${cat(a, 'valuation')?.comment ?? ''}`,
      })),
  };

  const growth: PickList = {
    key: 'growth',
    title: '③ 成長株候補',
    subtitle: '売上・利益が伸びている銘柄',
    criteria: '成長性スコアが高く、業績スコアも一定以上の銘柄。株価上昇率では選んでいません。',
    picks: all
      .filter((a) => ratio(a, 'growth') >= 0.6 && ratio(a, 'earnings') >= 0.5)
      .sort((a, b) => ratio(b, 'growth') - ratio(a, 'growth'))
      .slice(0, 5)
      .map((a) => ({ analysis: a, rank: ratio(a, 'growth'), reason: cat(a, 'growth')?.comment ?? '' })),
  };

  const dividend: PickList = {
    key: 'dividend',
    title: '④ 高配当株候補',
    subtitle: '配当利回りが高めの銘柄',
    criteria: '配当利回りが3%以上で、かつ配当性向が極端に高くない銘柄。利回りの高さだけでは選びません。',
    picks: all
      .filter((a) => (a.stock.dividend.yield ?? 0) >= 3 && (a.stock.dividend.payoutRatio ?? 0) < 100)
      .sort((a, b) => (b.stock.dividend.yield ?? 0) - (a.stock.dividend.yield ?? 0))
      .slice(0, 5)
      .map((a) => ({
        analysis: a,
        rank: a.stock.dividend.yield ?? 0,
        reason: `予想配当利回り ${a.stock.dividend.yield?.toFixed(2)}%、配当性向 ${a.stock.dividend.payoutRatio?.toFixed(0) ?? 'ー'}%。${cat(a, 'dividend')?.comment ?? ''}`,
      })),
  };

  const oversold: PickList = {
    key: 'oversold',
    title: '⑤ 急落しているが業績が悪化していない可能性がある株',
    subtitle: '下げの理由を確認する価値がある銘柄',
    criteria: '直近1か月で大きく下落した一方、財務スコアが高い銘柄。「下がったから買い」ではありません。',
    picks: all
      .filter((a) => (a.technical?.change20d ?? 0) <= -8 && ratio(a, 'financial') >= 0.6)
      .sort((a, b) => (a.technical?.change20d ?? 0) - (b.technical?.change20d ?? 0))
      .slice(0, 5)
      .map((a) => ({
        analysis: a,
        rank: -(a.technical?.change20d ?? 0),
        reason: `直近1か月で ${a.technical?.change20d?.toFixed(1)}%下落。一方で財務スコアは ${cat(a, 'financial')?.score}/20 と高めです。下落の理由をニュースと決算で確認してください。`,
      })),
  };

  const earningsSoon: PickList = {
    key: 'earnings-soon',
    title: '⑥ 決算注目銘柄',
    subtitle: '2週間以内に決算発表がある銘柄',
    criteria: '次回決算発表日が近い順。決算前後は株価が大きく動きます。',
    picks: all
      .filter((a) => {
        if (!a.stock.nextEarningsDate) return false;
        const d = (new Date(a.stock.nextEarningsDate + 'T00:00:00').getTime() - Date.now()) / 86400000;
        return d >= 0 && d <= 21;
      })
      .sort((a, b) => (a.stock.nextEarningsDate! < b.stock.nextEarningsDate! ? -1 : 1))
      .slice(0, 5)
      .map((a) => ({
        analysis: a,
        rank: 0,
        reason: `次回決算は ${a.stock.nextEarningsDate}。内容次第で株価が大きく動く可能性があります。`,
      })),
  };

  const worthResearch: PickList = {
    key: 'worth-research',
    title: '⑦ 調べる価値ありと判断した銘柄',
    subtitle: '複数の指標がバランスよく良好な銘柄',
    criteria: '総合スコアが高い順。ただし高スコア＝儲かるという意味ではありません。',
    picks: all
      .filter((a) => a.total.score !== null)
      .sort((a, b) => (b.total.score ?? 0) - (a.total.score ?? 0))
      .slice(0, 5)
      .map((a) => ({ analysis: a, rank: a.total.score ?? 0, reason: a.narrative.oneLiner })),
  };

  return [attention, value, growth, dividend, oversold, earningsSoon, worthResearch];
}

export type RankingKey =
  | 'value'
  | 'growth'
  | 'dividend'
  | 'dividendGrowth'
  | 'financial'
  | 'earningsGrowth'
  | 'today'
  | 'plunge'
  | 'goodEarnings'
  | 'beginner';

export interface RankingDef {
  key: RankingKey;
  title: string;
  criteria: string;
}

export const RANKINGS: RankingDef[] = [
  { key: 'value', title: '割安株ランキング', criteria: '割安度スコア × 業績スコアの組み合わせ。PERの低さだけでは並べません。' },
  { key: 'growth', title: '成長株ランキング', criteria: '成長性スコアと業績スコアを組み合わせた順位。' },
  { key: 'dividend', title: '高配当株ランキング', criteria: '配当利回りと配当の持続性（配当性向・減配実績）を組み合わせた順位。' },
  { key: 'dividendGrowth', title: '増配株ランキング', criteria: '連続増配年数と直近5期の増配率。' },
  { key: 'financial', title: '財務優良株ランキング', criteria: '自己資本比率・実質借入・営業CFを合わせた財務スコア順。' },
  { key: 'earningsGrowth', title: '業績成長株ランキング', criteria: '売上・利益の年平均成長率を中心とした業績スコア順。' },
  { key: 'today', title: '今日の注目株', criteria: '前日比の変動幅が大きい順。' },
  { key: 'plunge', title: '急落株', criteria: '直近1か月の下落率が大きい順。下落理由の確認が必要です。' },
  { key: 'goodEarnings', title: '好決算株', criteria: '直近決算の評価が「良い」と判定された銘柄。' },
  { key: 'beginner', title: '初心者向け銘柄ランキング', criteria: '総合スコアに加え、値動きの穏やかさ・財務の安定・データの揃い具合を加味した順位。' },
];

const dividendGrowthRate = (a: StockAnalysis) => {
  const h = a.stock.dividend.historyPerShare;
  if (!h || h.length < 2 || h[0] <= 0) return 0;
  return (h[h.length - 1] / h[0] - 1) * 100;
};

const beginnerFriendliness = (a: StockAnalysis) => {
  if (a.total.score === null) return -1;
  const volPenalty = Math.min(Math.abs(a.technical?.change20d ?? 0) / 2, 15);
  const sizeBonus = a.stock.sizeClass === 'large' ? 8 : a.stock.sizeClass === 'mid' ? 3 : 0;
  const finBonus = ratio(a, 'financial') * 10;
  const coverageBonus = a.total.coverage * 10;
  return a.total.score + sizeBonus + finBonus + coverageBonus - volPenalty;
};

export function buildRanking(stocks: Stock[], key: RankingKey): Pick[] {
  const all = stocks.map(analyze);
  const withReason = (list: StockAnalysis[], reason: (a: StockAnalysis) => string, rank: (a: StockAnalysis) => number) =>
    list.slice(0, 10).map((a) => ({ analysis: a, reason: reason(a), rank: rank(a) }));

  switch (key) {
    case 'value': {
      const score = (a: StockAnalysis) => ratio(a, 'valuation') * 0.65 + ratio(a, 'earnings') * 0.35;
      return withReason(
        [...all].sort((x, y) => score(y) - score(x)),
        (a) => `予想PER ${a.stock.valuation.forwardPer?.toFixed(1) ?? 'ー'}倍 / PBR ${a.stock.valuation.pbr?.toFixed(2) ?? 'ー'}倍 / 業績 ${sc(a, 'earnings') ?? 'ー'}点`,
        (a) => Math.round(score(a) * 100)
      );
    }
    case 'growth': {
      const score = (a: StockAnalysis) => ratio(a, 'growth') * 0.65 + ratio(a, 'earnings') * 0.35;
      return withReason(
        [...all].sort((x, y) => score(y) - score(x)),
        (a) => `成長性 ${sc(a, 'growth') ?? 'ー'}/20点、業績 ${sc(a, 'earnings') ?? 'ー'}/20点`,
        (a) => Math.round(score(a) * 100)
      );
    }
    case 'dividend': {
      const score = (a: StockAnalysis) => (a.stock.dividend.yield ?? 0) * 0.6 + ratio(a, 'dividend') * 4;
      return withReason(
        [...all].filter((a) => (a.stock.dividend.yield ?? 0) > 0).sort((x, y) => score(y) - score(x)),
        (a) => `利回り ${a.stock.dividend.yield?.toFixed(2)}% / 配当性向 ${a.stock.dividend.payoutRatio?.toFixed(0) ?? 'ー'}%`,
        (a) => Math.round(score(a) * 10)
      );
    }
    case 'dividendGrowth':
      return withReason(
        [...all].sort(
          (x, y) =>
            (y.stock.dividend.consecutiveIncreaseYears ?? 0) - (x.stock.dividend.consecutiveIncreaseYears ?? 0) ||
            dividendGrowthRate(y) - dividendGrowthRate(x)
        ),
        (a) => `連続増配 ${a.stock.dividend.consecutiveIncreaseYears ?? 0}年 / 5期の配当増加率 ${dividendGrowthRate(a).toFixed(0)}%`,
        (a) => a.stock.dividend.consecutiveIncreaseYears ?? 0
      );
    case 'financial':
      return withReason(
        [...all].sort((x, y) => ratio(y, 'financial') - ratio(x, 'financial')),
        (a) => `自己資本比率 ${a.stock.financials.equityRatio?.toFixed(1) ?? 'ー'}% / 財務スコア ${sc(a, 'financial') ?? 'ー'}/20点`,
        (a) => sc(a, 'financial') ?? 0
      );
    case 'earningsGrowth':
      return withReason(
        [...all].sort((x, y) => ratio(y, 'earnings') - ratio(x, 'earnings')),
        (a) => `業績スコア ${sc(a, 'earnings') ?? 'ー'}/20点。${cat(a, 'earnings')?.comment ?? ''}`,
        (a) => sc(a, 'earnings') ?? 0
      );
    case 'today':
      return withReason(
        [...all].sort((x, y) => Math.abs(y.stock.quote.changePercent) - Math.abs(x.stock.quote.changePercent)),
        (a) => `前日比 ${a.stock.quote.changePercent >= 0 ? '+' : ''}${a.stock.quote.changePercent.toFixed(2)}%`,
        (a) => Math.abs(a.stock.quote.changePercent)
      );
    case 'plunge':
      return withReason(
        [...all].sort((x, y) => (x.technical?.change20d ?? 0) - (y.technical?.change20d ?? 0)),
        (a) => `直近1か月 ${a.technical?.change20d?.toFixed(1) ?? 'ー'}%。下落の理由の確認が必要です。`,
        (a) => -(a.technical?.change20d ?? 0)
      );
    case 'goodEarnings':
      return withReason(
        all.filter((a) => a.earnings?.verdict === 'good' || a.earnings?.verdict === 'fair')
           .sort((x, y) => (x.earnings?.verdict === 'good' ? -1 : 1) - (y.earnings?.verdict === 'good' ? -1 : 1)),
        (a) => `直近決算の評価：${a.earnings?.label}。${a.earnings?.reasons[0] ?? ''}`,
        (a) => (a.earnings?.verdict === 'good' ? 2 : 1)
      );
    case 'beginner':
      return withReason(
        [...all].sort((x, y) => beginnerFriendliness(y) - beginnerFriendliness(x)),
        (a) =>
          `総合 ${a.total.score ?? 'ー'}点 / ${a.stock.sizeClass === 'large' ? '大型株' : a.stock.sizeClass === 'mid' ? '中型株' : '小型株'} / 直近1か月の値動き ${a.technical?.change20d?.toFixed(1) ?? 'ー'}%`,
        (a) => Math.round(beginnerFriendliness(a))
      );
  }
}

export type BudgetStyle = '成長型' | '配当型' | '安定型' | '割安型';

export interface BudgetPick extends Pick {
  style: BudgetStyle;
  /** 予算内で買える株数（S株＝1株から買える前提） */
  shares: number;
  cost: number;
}

/** 少額投資モード（要件11） */
export function buildBudgetPicks(stocks: Stock[], budget: number): BudgetPick[] {
  const all = stocks.map(analyze).filter((a) => a.stock.quote.price <= budget);

  const styleOf = (a: StockAnalysis): BudgetStyle => {
    const g = ratio(a, 'growth');
    const v = ratio(a, 'valuation');
    const y = a.stock.dividend.yield ?? 0;
    if (y >= 3.2) return '配当型';
    if (g >= 0.7 && v < 0.6) return '成長型';
    if (v >= 0.65) return '割安型';
    return '安定型';
  };

  return all
    .filter((a) => a.total.score !== null)
    .sort((a, b) => (b.total.score ?? 0) - (a.total.score ?? 0))
    .slice(0, 12)
    .map((a) => {
      const shares = Math.floor(budget / a.stock.quote.price);
      return {
        analysis: a,
        style: styleOf(a),
        shares,
        cost: Math.round(shares * a.stock.quote.price),
        rank: a.total.score ?? 0,
        reason: a.narrative.oneLiner,
      };
    });
}

export interface BudgetPlanLine {
  analysis: StockAnalysis;
  style: BudgetStyle;
  shares: number;
  cost: number;
  /** 年間の予想配当（株数 × 1株配当）。取得できない場合 undefined */
  annualDividend?: number;
  /** この銘柄がプラン全体に占める割合 */
  weightPct: number;
}

export interface BudgetPlan {
  key: 'diversified' | 'dividend' | 'growth' | 'stable';
  title: string;
  description: string;
  lines: BudgetPlanLine[];
  total: number;
  remaining: number;
  annualDividend: number;
  /** 偏りなどの注意 */
  warnings: string[];
  /** 何を基準に選んだか */
  criteria: string;
}

function allocate(
  candidates: StockAnalysis[],
  budget: number,
  slots: number,
  styleOf: (a: StockAnalysis) => BudgetStyle
): Omit<BudgetPlan, 'key' | 'title' | 'description' | 'criteria'> {
  const perSlot = budget / slots;
  const lines: BudgetPlanLine[] = [];
  for (const a of candidates) {
    if (lines.length >= slots) break;
    const shares = Math.floor(perSlot / a.stock.quote.price);
    if (shares <= 0) continue;
    const cost = Math.round(shares * a.stock.quote.price);
    const dps = a.stock.dividend.perShare;
    lines.push({
      analysis: a,
      style: styleOf(a),
      shares,
      cost,
      annualDividend: dps !== undefined ? Math.round(shares * dps) : undefined,
      weightPct: 0,
    });
  }
  const total = lines.reduce((s, l) => s + l.cost, 0);
  for (const l of lines) l.weightPct = total > 0 ? Math.round((l.cost / total) * 100) : 0;

  const warnings: string[] = [];
  const sectors = new Map<string, number>();
  for (const l of lines) sectors.set(l.analysis.stock.sector, (sectors.get(l.analysis.stock.sector) ?? 0) + 1);
  for (const [sec, n] of sectors) if (n >= 2) warnings.push(`「${sec}」の銘柄が${n}つ入っています。同じ業種は同じ理由で一緒に下がることがあります。`);
  const heavy = lines.find((l) => l.weightPct >= 50);
  if (heavy && lines.length > 1) warnings.push(`${heavy.analysis.stock.name}だけで全体の${heavy.weightPct}%を占めています。1銘柄への集中は値動きの影響を大きくします。`);
  if (lines.length === 1) warnings.push('1銘柄だけのプランです。この銘柄が下がると資産全体が下がります。');
  if (lines.length === 0) warnings.push('この予算では条件に合う銘柄を組み合わせられませんでした。');
  const highWarn = lines.filter((l) => l.analysis.warnings.some((w) => w.level === 'high'));
  for (const l of highWarn) warnings.push(`${l.analysis.stock.name}には重要度の高い注意点があります（${l.analysis.warnings[0].title}）。`);

  return {
    lines,
    total,
    remaining: budget - total,
    annualDividend: lines.reduce((s, l) => s + (l.annualDividend ?? 0), 0),
    warnings,
  };
}

/**
 * 「この予算ならこう分ける」という組み合わせの例（要件11の発展）。
 * 「買うべき銘柄」ではなく、分散のしかたを具体的な株数で見せるためのもの。
 */
export function buildBudgetPlans(stocks: Stock[], budget: number): BudgetPlan[] {
  const all = stocks
    .map(analyze)
    .filter((a) => a.total.score !== null && a.stock.quote.price <= budget / 2);

  const styleOf = (a: StockAnalysis): BudgetStyle => {
    const g = ratio(a, 'growth');
    const v = ratio(a, 'valuation');
    const y = a.stock.dividend.yield ?? 0;
    if (y >= 3.2) return '配当型';
    if (g >= 0.7 && v < 0.6) return '成長型';
    if (v >= 0.65) return '割安型';
    return '安定型';
  };
  const byScore = [...all].sort((a, b) => (b.total.score ?? 0) - (a.total.score ?? 0));

  // 分散：総合スコア順に、業種が重ならないよう4銘柄
  const diversified: StockAnalysis[] = [];
  const usedSectors = new Set<string>();
  for (const a of byScore) {
    if (usedSectors.has(a.stock.sector)) continue;
    diversified.push(a);
    usedSectors.add(a.stock.sector);
  }

  const dividend = byScore.filter((a) => (a.stock.dividend.yield ?? 0) >= 3.2 && (a.stock.dividend.payoutRatio ?? 0) < 100)
    .sort((a, b) => ratio(b, 'dividend') - ratio(a, 'dividend'));
  const growth = byScore
    .filter((a) => styleOf(a) === '成長型' && ratio(a, 'earnings') >= 0.6)
    .sort((a, b) => ratio(b, 'growth') - ratio(a, 'growth'));
  // 安定：財務が堅く、値動きが穏やかで、成長期待で株価が高くなっている銘柄は除く
  const stable = byScore
    .filter(
      (a) =>
        ratio(a, 'financial') >= 0.7 &&
        Math.abs(a.technical?.change20d ?? 0) < 8 &&
        styleOf(a) !== '成長型' &&
        (a.stock.valuation.forwardPer ?? 99) <= 25 &&
        a.stock.sizeClass === 'large'
    )
    .sort((a, b) => ratio(b, 'financial') - ratio(a, 'financial'));

  return [
    {
      key: 'diversified',
      title: '分散プラン（業種をばらす）',
      description: '総合スコアの高い銘柄を、業種が重ならないように4つ選び、予算を4等分しています。初心者に最も一般的な考え方です。',
      criteria: '総合スコア順・業種重複なし・予算を均等配分',
      ...allocate(diversified, budget, 4, styleOf),
    },
    {
      key: 'dividend',
      title: '配当プラン（受け取りを重視）',
      description: '配当利回り3.2%以上で、配当性向が無理のない範囲の銘柄から3つ。年間にいくら配当が見込めるかを株数から計算しています。',
      criteria: '利回り3.2%以上・配当性向100%未満・配当スコア順',
      ...allocate(dividend, budget, 3, styleOf),
    },
    {
      key: 'growth',
      title: '成長プラン（値上がりを狙う）',
      description: '成長性と業績のスコアがともに高い銘柄から3つ。値動きが大きくなりやすいため、損切りの目安を先に決めておくことが特に重要です。',
      criteria: '成長型（成長性スコア70%以上）・業績スコア60%以上',
      ...allocate(growth, budget, 3, styleOf),
    },
    {
      key: 'stable',
      title: '安定プラン（値動きを抑える）',
      description: '財務が堅く、直近1か月の値動きが穏やかな銘柄から3つ。大きく増えにくいかわりに、大きく減りにくいことを重視しています。',
      criteria: '財務スコア70%以上・直近1か月の変動8%未満・予想PER25倍以下・大型株・成長型は除外',
      ...allocate(stable, budget, 3, styleOf),
    },
  ];
}
