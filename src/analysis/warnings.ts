import type { Stock } from '../types/stock';
import type { TechnicalSnapshot } from './indicators';

export type WarningLevel = 'high' | 'medium' | 'low';

export interface Warning {
  id: string;
  level: WarningLevel;
  title: string;
  /** なぜ注意なのかを日本語で説明する（色で煽らない） */
  why: string;
  /** 初心者が具体的に何を確認すればよいか */
  todo: string;
}

const daysUntil = (dateStr?: string) => {
  if (!dateStr) return undefined;
  const d = new Date(dateStr + 'T00:00:00');
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

/** 「初心者が知らないと危険」ポイントを洗い出す（要件13） */
export function buildWarnings(s: Stock, t: TechnicalSnapshot | null): Warning[] {
  const w: Warning[] = [];

  const dte = daysUntil(s.nextEarningsDate);
  if (dte !== undefined && dte >= 0 && dte <= 14) {
    w.push({
      id: 'earnings-soon',
      level: dte <= 7 ? 'high' : 'medium',
      title: `決算発表が近い（あと約${dte}日）`,
      why: '決算の内容次第で株価は1日で大きく動きます。良い決算でも「期待ほどではない」と受け取られて下がることもあります。',
      todo: '決算をまたいで持つのか、決算後に内容を見てから買うのかを、あらかじめ決めておきましょう。',
    });
  }

  if (t?.change20d !== null && t?.change20d !== undefined && t.change20d >= 20) {
    w.push({
      id: 'surge',
      level: 'high',
      title: `直近1か月で${t.change20d.toFixed(0)}%上昇している`,
      why: '短期間に大きく上がった株は、利益確定の売りが出て急に下げることがあります。上がっているから安全、ということはありません。',
      todo: 'なぜ上がったのか（業績なのか、テーマ人気なのか）を確認し、一度に全額を買わない方法も検討しましょう。',
    });
  }

  if (t?.change20d !== null && t?.change20d !== undefined && t.change20d <= -15) {
    w.push({
      id: 'plunge',
      level: 'medium',
      title: `直近1か月で${t.change20d.toFixed(0)}%下落している`,
      why: '下落には理由があります。市場全体の下げなのか、その会社固有の悪材料なのかで、その後の意味がまったく変わります。',
      todo: '直近のニュースと決算を必ず確認し、「業績が悪化していないのに下げている」のかを見極めましょう。',
    });
  }

  if (t?.positionInRange !== undefined && t.positionInRange >= 90) {
    w.push({
      id: 'near-high',
      level: 'medium',
      title: '1年で最も高い水準に近い',
      why: '高値圏では、少しの悪材料でも下げ幅が大きくなりがちです。今の価格で買うと、しばらく含み損になる可能性があります。',
      todo: '「いくらまでなら待てるか」を先に決めてから買うか判断しましょう。',
    });
  }

  const { forwardPer, perAvg5y } = s.valuation;
  if (forwardPer !== undefined && perAvg5y !== undefined && forwardPer > perAvg5y * 1.3) {
    w.push({
      id: 'per-above-avg',
      level: 'medium',
      title: `PERが過去平均（${perAvg5y.toFixed(1)}倍）より高い`,
      why: 'この会社としては割高に評価されている状態です。期待どおりに利益が伸びないと、過去のPER水準まで株価が戻る形で調整することがあります。',
      todo: '会社予想の利益が本当に達成できそうか、直近の決算の進捗率を確認しましょう。',
    });
  }

  if (s.latestEarnings?.guidanceRevision === 'down') {
    w.push({
      id: 'guidance-down',
      level: 'high',
      title: '業績予想が下方修正された',
      why: '会社自身が「当初の見込みより利益が減りそう」と発表した状態です。株価が下がる要因になりやすく、追加の下方修正が続くこともあります。',
      todo: '下方修正の理由が一時的なもの（為替・特別損失など）か、事業そのものの不振かを確認しましょう。',
    });
  }

  const payout = s.dividend.payoutRatio;
  if (payout !== undefined && payout >= 80) {
    w.push({
      id: 'payout-high',
      level: payout >= 100 ? 'high' : 'medium',
      title: `配当性向が高い（${payout.toFixed(0)}%）`,
      why: '利益の大部分（または利益を超えて）配当を出している状態です。業績が落ちると配当を減らさざるを得ない可能性があります。',
      todo: '過去に減配していないか、来期も同じ配当を出せる利益が見込めるかを確認しましょう。',
    });
  }

  const { interestBearingDebt, cash, operatingCF, operatingCFPrev, equityRatio } = s.financials;
  if (
    interestBearingDebt !== undefined &&
    operatingCF !== undefined &&
    operatingCF > 0 &&
    (interestBearingDebt - (cash ?? 0)) / operatingCF > 10
  ) {
    w.push({
      id: 'debt-heavy',
      level: 'medium',
      title: '借入金が本業の稼ぎに対して多い',
      why: '本業で稼ぐ現金の10年分を超える実質的な借入があります。金利が上がると利払いが増え、利益が圧迫される可能性があります。',
      todo: '業種として当たり前の水準か（銀行・リース・不動産など）を確認しましょう。',
    });
  }

  if (equityRatio !== undefined && equityRatio < 20 && !['銀行業', '保険業', 'その他金融業'].includes(s.sector)) {
    w.push({
      id: 'thin-equity',
      level: 'medium',
      title: `自己資本比率が低い（${equityRatio.toFixed(1)}%）`,
      why: '自前の資本が薄く、借入に頼った経営です。業績が悪化したときに立て直す余力が小さくなります。',
      todo: '同じ業種の他社と比べて低すぎないかを確認しましょう。',
    });
  }

  if (operatingCF !== undefined && operatingCFPrev !== undefined && operatingCFPrev > 0) {
    const drop = ((operatingCF - operatingCFPrev) / operatingCFPrev) * 100;
    if (drop <= -25) {
      w.push({
        id: 'cf-worse',
        level: 'medium',
        title: `営業キャッシュフローが悪化（前期比${drop.toFixed(0)}%）`,
        why: '帳簿上の利益は出ていても、実際に入ってくる現金が減っている状態です。在庫の増加や代金回収の遅れが背景にある場合があります。',
        todo: '決算短信のキャッシュフロー計算書で、何が減少要因かを確認しましょう。',
      });
    }
  }

  if (s.marginRatio !== undefined && s.marginRatio >= 8) {
    w.push({
      id: 'margin-heavy',
      level: 'low',
      title: `信用買い残が多い（信用倍率 約${s.marginRatio.toFixed(1)}倍）`,
      why: '借りたお金で買っている人が多い状態です。この買いはいずれ売り戻されるため、株価の上値が重くなりやすいと言われます。',
      todo: 'すぐに危険という意味ではありませんが、短期の値動きが荒くなりやすい点は意識しておきましょう。',
    });
  }

  if (t?.rsi14 !== null && t?.rsi14 !== undefined && t.rsi14 >= 75) {
    w.push({
      id: 'overbought',
      level: 'low',
      title: 'RSIが買われすぎの水準',
      why: '短期間に買いが集中していることを示す数字です。必ず下がるわけではありませんが、一服しやすい局面とされています。',
      todo: '急いで買う必要があるかを一度考えてみましょう。',
    });
  }

  const order: Record<WarningLevel, number> = { high: 0, medium: 1, low: 2 };
  return w.sort((a, b) => order[a.level] - order[b.level]);
}
