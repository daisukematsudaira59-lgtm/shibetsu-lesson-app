import type { PricePoint, Stock } from '../types/stock';

/**
 * 「売り時の目安」= あらかじめ決めておく出口ルール。
 *
 * 将来の売り時を予測するのではなく、「買う前に決めておく利益確定・損切り・
 * 見直しのルール」を、この銘柄の株価に当てはめて具体的な金額にする。
 * あわせて、そのルールを過去の値動きに機械的に当てはめた結果も示すが、
 * それは将来の勝率ではない（UI でも必ずそう表示する）。
 */

export interface ExitParams {
  /** 利益確定の目安（%） */
  takeProfitPct: number;
  /** 損切りの目安（%） */
  stopLossPct: number;
  /** 最長保有日数（営業日）。ここまでに決着しなければ見直す */
  maxHoldDays: number;
}

export const DEFAULT_EXIT: ExitParams = { takeProfitPct: 15, stopLossPct: 10, maxHoldDays: 90 };

export const EXIT_PRESETS: { key: string; label: string; params: ExitParams; note: string }[] = [
  {
    key: 'careful',
    label: '慎重',
    params: { takeProfitPct: 10, stopLossPct: 7, maxHoldDays: 60 },
    note: '小さく利益を取り、損も小さく抑える。決着が早いぶん売買回数は増えやすい。',
  },
  {
    key: 'standard',
    label: '標準',
    params: DEFAULT_EXIT,
    note: '初心者向けによく紹介される目安。利益幅を損失幅より大きく取る。',
  },
  {
    key: 'patient',
    label: 'じっくり',
    params: { takeProfitPct: 25, stopLossPct: 12, maxHoldDays: 180 },
    note: '半年程度は持つ前提。途中の上下に耐える必要がある。',
  },
];

export interface ExitSimulation {
  /** 検証した買い時点の数 */
  entries: number;
  tookProfit: number;
  stoppedOut: number;
  /** 最長保有日数に達した回数 */
  expired: number;
  /** そのうちプラスで終わった回数 */
  expiredPositive: number;
  avgReturnPct: number;
  bestPct: number;
  worstPct: number;
  avgHoldDays: number;
  /** 検証に使った期間 */
  from: string;
  to: string;
}

export interface ReviewTrigger {
  title: string;
  detail: string;
}

export interface ExitPlan {
  params: ExitParams;
  entryPrice: number;
  targetPrice: number;
  stopPrice: number;
  /** 利益確定で得られる1株あたりの金額 */
  gainPerShare: number;
  /** 損切りで失う1株あたりの金額 */
  lossPerShare: number;
  simulation: ExitSimulation | null;
  reviewTriggers: ReviewTrigger[];
  ruleText: string;
  simulationNote: string;
}

const round = (v: number) => (v >= 1000 ? Math.round(v) : Math.round(v * 10) / 10);

/**
 * 出口ルールを過去の値動きに機械的に当てはめる。
 * 5営業日おきに「その日の終値で買った」と仮定し、ルールどおりに手放した結果を集計する。
 */
export function simulateExitRule(history: PricePoint[], params: ExitParams, stepDays = 5): ExitSimulation | null {
  const closes = history.map((p) => p.close);
  const n = closes.length;
  const lastEntry = n - 1 - params.maxHoldDays;
  if (lastEntry < 20) return null;

  let tookProfit = 0;
  let stoppedOut = 0;
  let expired = 0;
  let expiredPositive = 0;
  const returns: number[] = [];
  const holds: number[] = [];

  for (let i = 0; i <= lastEntry; i += stepDays) {
    const entry = closes[i];
    let exitIdx = i + params.maxHoldDays;
    let outcome: 'tp' | 'sl' | 'ex' = 'ex';
    for (let j = i + 1; j <= i + params.maxHoldDays; j++) {
      const r = ((closes[j] - entry) / entry) * 100;
      if (r >= params.takeProfitPct) {
        outcome = 'tp';
        exitIdx = j;
        break;
      }
      if (r <= -params.stopLossPct) {
        outcome = 'sl';
        exitIdx = j;
        break;
      }
    }
    const ret = ((closes[exitIdx] - entry) / entry) * 100;
    returns.push(ret);
    holds.push(exitIdx - i);
    if (outcome === 'tp') tookProfit++;
    else if (outcome === 'sl') stoppedOut++;
    else {
      expired++;
      if (ret > 0) expiredPositive++;
    }
  }

  const entries = returns.length;
  if (entries === 0) return null;
  return {
    entries,
    tookProfit,
    stoppedOut,
    expired,
    expiredPositive,
    avgReturnPct: returns.reduce((a, b) => a + b, 0) / entries,
    bestPct: Math.max(...returns),
    worstPct: Math.min(...returns),
    avgHoldDays: holds.reduce((a, b) => a + b, 0) / entries,
    from: history[0].date,
    to: history[lastEntry].date,
  };
}

export function buildExitPlan(s: Stock, params: ExitParams = DEFAULT_EXIT): ExitPlan {
  const entry = s.quote.price;
  const target = round(entry * (1 + params.takeProfitPct / 100));
  const stop = round(entry * (1 - params.stopLossPct / 100));

  const reviewTriggers: ReviewTrigger[] = [
    {
      title: `株価が ${target.toLocaleString()}円（+${params.takeProfitPct}%）に達した`,
      detail: '利益確定の目安です。全部売る必要はなく、半分だけ売って残りを持ち続ける方法もあります。',
    },
    {
      title: `株価が ${stop.toLocaleString()}円（−${params.stopLossPct}%）を下回った`,
      detail:
        '損切りの目安です。「戻るまで待つ」は初心者が最も損を大きくしやすい行動です。先に決めた金額で機械的に手放すことを検討してください。',
    },
    {
      title: '会社予想が下方修正された',
      detail: '買ったときの前提（業績が伸びる・配当が続く）が変わったサインです。理由を確認し、前提が崩れたなら株価に関係なく見直します。',
    },
    {
      title: '買った理由を人に説明できなくなった',
      detail: '「配当目的で買った」のに減配された、「成長を期待した」のに減収が続く、など。理由が消えた株を持ち続ける根拠はありません。',
    },
    {
      title: `${params.maxHoldDays}営業日（約${Math.round(params.maxHoldDays / 21)}か月）たっても決着しない`,
      detail: '上がりも下がりもしない場合は、資金が動かないままになります。持ち続けるか、他の候補に移すかを一度考える節目です。',
    },
  ];
  if (s.nextEarningsDate) {
    reviewTriggers.splice(2, 0, {
      title: `次回決算（${s.nextEarningsDate}）の内容を確認する`,
      detail: '決算は保有理由が続いているかを確認する定期健診です。売る・持つの判断材料として必ず目を通してください。',
    });
  }

  return {
    params,
    entryPrice: entry,
    targetPrice: target,
    stopPrice: stop,
    gainPerShare: round(target - entry),
    lossPerShare: round(entry - stop),
    simulation: simulateExitRule(s.history, params),
    reviewTriggers,
    ruleText: `今の株価 ${entry.toLocaleString()}円で買った場合：${target.toLocaleString()}円まで上がったら利益確定を検討、${stop.toLocaleString()}円まで下がったら損切りを検討、${params.maxHoldDays}営業日たっても決着しなければ見直す。`,
    simulationNote:
      'これは「過去の値動きにこのルールを機械的に当てはめた結果」であり、将来の勝率ではありません。同じ銘柄でも、買う時期によって結果が大きく違うことを確認するための表示です。',
  };
}
