import type { Stock } from '../types/stock';
import type { CategoryScore } from './types';
import type { TechnicalSnapshot } from './indicators';
import type { TotalScore } from './total';

export interface BuyPattern {
  key: 'lump' | 'split' | 'wait';
  label: string;
  fit: '検討しやすい' | '条件つき' | '慎重に';
  pros: string[];
  cons: string[];
  comment: string;
}

export interface TimingAnalysis {
  comment: string;
  patterns: BuyPattern[];
  disclaimer: string;
}

/** 「今買うのが良いか？」への回答（断定しない・要件9） */
export function buildTiming(
  s: Stock,
  categories: CategoryScore[],
  total: TotalScore,
  t: TechnicalSnapshot | null
): TimingAnalysis {
  const by = Object.fromEntries(categories.map((c) => [c.key, c])) as Record<string, CategoryScore>;
  const val = by.valuation?.score ?? null;
  const ern = by.earnings?.score ?? null;
  const chart = by.technical?.score ?? null;
  const surge = (t?.change20d ?? 0) >= 15;
  const plunge = (t?.change20d ?? 0) <= -12;
  const nearHigh = (t?.positionInRange ?? 50) >= 85;

  const parts: string[] = [];
  if (ern !== null && ern >= 14) parts.push('業績面では魅力があります');
  else if (ern !== null && ern <= 9) parts.push('業績には物足りなさがあります');
  else parts.push('業績は平均的な水準です');

  if (surge) parts.push('短期的に株価が大きく上昇しているため、購入タイミングには注意が必要です');
  else if (plunge) parts.push('直近で大きく下落しているため、まず下落の理由を確認したい局面です');
  else if (nearHigh) parts.push('株価は1年の高値圏にあるため、買う価格には注意が必要です');
  else if (val !== null && val >= 14) parts.push('株価水準は過去と比べて落ち着いています');
  else parts.push('株価水準は特別に安いとは言えません');

  if (total.score === null) {
    parts.length = 0;
    parts.push('データが不足しているため、タイミングについても判断材料が足りません');
  }

  const comment = parts.join('。') + '。';

  const heat = surge || nearHigh || (chart !== null && chart <= 4);
  const quality = total.score !== null && total.score >= 70;

  const patterns: BuyPattern[] = [
    {
      key: 'lump',
      label: '一括購入',
      fit: quality && !heat ? '条件つき' : '慎重に',
      pros: ['予定した株数をすぐに保有できる', '手数料の回数が少なくて済む'],
      cons: ['買った直後に下がると、含み損が一度に大きくなる', '「もっと下で買えたのに」と後悔しやすい'],
      comment: heat
        ? '株価が高い位置にある、または急に動いている局面です。一度にすべて買うのは、初心者にとって負担が大きくなりやすい方法です。'
        : '内容を理解したうえで、金額が自分の許容範囲に収まっているなら選択肢になります。',
    },
    {
      key: 'split',
      label: '分散購入（何回かに分けて買う）',
      fit: '検討しやすい',
      pros: ['買う価格が平均化され、高値づかみの影響が小さくなる', '判断を1回に賭けなくて済む'],
      cons: ['上がり続けた場合は平均取得価格が上がる', '売買回数が増える'],
      comment:
        'SBI証券のS株（単元未満株）なら1株から買えるため、少額でも複数回に分けて買う方法が取りやすくなっています。タイミングを当てる自信がない段階では現実的な方法です。',
    },
    {
      key: 'wait',
      label: '様子見（今は買わない）',
      fit: heat || total.score === null || (total.score !== null && total.score < 50) ? '検討しやすい' : '条件つき',
      pros: ['決算やニュースを確認してから判断できる', '資金を他の候補にも回せる'],
      cons: ['上昇した場合に買えなくなる', '待っている間に判断基準が変わってしまうことがある'],
      comment:
        s.nextEarningsDate
          ? `次回決算（${s.nextEarningsDate}）の内容を見てから判断する、という考え方もあります。`
          : '判断に必要な情報が揃うまで待つ、という選択も立派な判断です。',
    },
  ];

  return {
    comment,
    patterns,
    disclaimer:
      'ここに書かれているのは分析結果の整理であり、売買を推奨するものではありません。最終的な判断はご自身で行ってください。',
  };
}
