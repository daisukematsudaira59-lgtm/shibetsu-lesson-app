import type { NewsItem, Stock } from '../types/stock';

export type NewsImpact = 'positive' | 'negative' | 'neutral' | 'unknown';

export interface AnalyzedNews extends NewsItem {
  impact: NewsImpact;
  impactLabel: string;
  /** 初心者向けに一言で説明 */
  plain: string;
  /** そう分類した根拠 */
  basis: string;
}

interface Rule {
  words: string[];
  impact: NewsImpact;
  plain: string;
}

/**
 * ニュース分類ルール。
 * ここはキーワードベースの単純なルールです。実運用では
 * この関数の中身だけを差し替えれば、より高度な分類に移行できます。
 */
const RULES: Rule[] = [
  {
    words: ['上方修正'],
    impact: 'positive',
    plain: '会社が予想していたより利益が増えそうだ、という発表です。一般的には株価にプラス材料となる可能性があります。',
  },
  {
    words: ['下方修正'],
    impact: 'negative',
    plain: '会社が予想していたより利益が減りそうだ、という発表です。一般的には株価にマイナス材料となる可能性があります。',
  },
  {
    words: ['自社株買い', '自己株式の取得', '増配'],
    impact: 'positive',
    plain: '株主に利益を返す動きです。1株あたりの価値が高まりやすく、一般にはプラス材料とされます。',
  },
  {
    words: ['減配', '無配'],
    impact: 'negative',
    plain: '配当が減る、または出なくなるという内容です。配当目的で持っている投資家の売りにつながりやすい材料です。',
  },
  {
    words: ['最高', '過去最高', '高値を更新', '好調', '拡大', '増加', '伸長', '回復'],
    impact: 'positive',
    plain: '事業が想定より順調に進んでいることを示す内容です。一般的にはプラス材料と受け取られやすい話題です。',
  },
  {
    words: ['受注', '契約', '提携', '承認'],
    impact: 'positive',
    plain: '将来の売上につながる可能性のある動きです。ただし金額や時期が不明な場合、株価への影響は限定的なこともあります。',
  },
  {
    words: ['急落', '下落', '低迷', '不振', '減少', '伸び悩み', '懸念', '警戒', '圧迫', '下回る', '延期', '遅れ'],
    impact: 'negative',
    plain: '想定より悪い状況を示す内容です。一般的にはマイナス材料と受け取られやすい話題です。',
  },
  {
    words: ['調整', '在庫'],
    impact: 'negative',
    plain: '製品が売れ残り気味で、生産や出荷を抑えている可能性を示す内容です。当面の業績には重しになりやすい話題です。',
  },
  {
    words: ['投資', '開発', '発表', '検討', '設立', '決定'],
    impact: 'neutral',
    plain: '将来に向けた動きですが、業績にいつ・どれだけ効くかはまだ分かりません。すぐに株価を動かすとは限りません。',
  },
];

export function analyzeNews(item: NewsItem): AnalyzedNews {
  const text = `${item.title} ${item.summary ?? ''}`;

  let impact: NewsImpact = 'unknown';
  let plain = '';
  let basis = '';

  if (item.impactHint && item.impactHint !== 'unknown') {
    impact = item.impactHint;
    basis = 'データ提供元の分類';
  }

  for (const rule of RULES) {
    const hit = rule.words.find((w) => text.includes(w));
    if (hit) {
      if (impact === 'unknown') impact = rule.impact;
      plain = rule.plain;
      basis = basis || `見出しに含まれる「${hit}」という表現から判断しています。`;
      break;
    }
  }

  if (impact === 'unknown') {
    plain = 'この見出しからは、株価にとってプラスかマイナスかを機械的に判断できませんでした。本文を確認してください。';
    basis = '判断に使えるキーワードが見つかりませんでした。';
  } else if (!plain) {
    plain = '株価への影響は内容次第です。本文を確認してください。';
  }

  const impactLabel =
    impact === 'positive'
      ? '株価にプラスの可能性'
      : impact === 'negative'
        ? '株価にマイナスの可能性'
        : impact === 'neutral'
          ? '影響は限定的とみられる'
          : '判断できません';

  return { ...item, impact, impactLabel, plain, basis };
}

export function analyzeAllNews(s: Stock): AnalyzedNews[] {
  return [...s.news]
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))
    .map(analyzeNews);
}
