import type { Stock } from '../types/stock';
import type { CategoryScore, Metric } from '../analysis/types';
import type { TotalScore } from '../analysis/total';
import type { Warning } from '../analysis/warnings';
import type { PriceReference } from '../analysis/priceBands';

export interface ThreeLineSummary {
  /** ① 良いところ */
  good: string;
  /** ② 悪いところ */
  bad: string;
  /** ③ 注意点 */
  caution: string;
}

export interface Highlight {
  label: string;
  detail: string;
}

export interface StockNarrative {
  /** データ不足で総合評価を出していない状態か */
  insufficient: boolean;
  /** 判断材料が足りない場合に画面で示す注記 */
  insufficientNote?: string;
  /** 【一言でいうと】 */
  oneLiner: string;
  threeLines: ThreeLineSummary;
  goodPoints: Highlight[];
  cautionPoints: Highlight[];
  /** 初心者向けの読み解き（専門用語なし） */
  beginnerRead: string[];
}

const topMetrics = (cats: CategoryScore[], judgements: Metric['judgement'][], limit: number): Highlight[] => {
  const out: Highlight[] = [];
  for (const c of cats) {
    for (const m of c.metrics) {
      if (judgements.includes(m.judgement)) {
        out.push({ label: `${m.label}：${m.display}`, detail: m.comment });
      }
    }
  }
  // 重み（max）が大きい指標を優先
  const weight = new Map<string, number>();
  for (const c of cats) for (const m of c.metrics) weight.set(`${m.label}：${m.display}`, m.max);
  return out.sort((a, b) => (weight.get(b.label) ?? 0) - (weight.get(a.label) ?? 0)).slice(0, limit);
};

const catByKey = (cats: CategoryScore[], key: string) => cats.find((c) => c.key === key);

export function buildNarrative(
  s: Stock,
  cats: CategoryScore[],
  total: TotalScore,
  warnings: Warning[],
  price: PriceReference
): StockNarrative {
  const ern = catByKey(cats, 'earnings');
  const fin = catByKey(cats, 'financial');
  const val = catByKey(cats, 'valuation');
  const grw = catByKey(cats, 'growth');
  const div = catByKey(cats, 'dividend');

  const ratio = (c?: CategoryScore) => (c && c.score !== null ? c.score / c.max : null);
  const strong = (c?: CategoryScore) => (ratio(c) ?? 0) >= 0.7;
  const weak = (c?: CategoryScore) => ratio(c) !== null && (ratio(c) as number) <= 0.45;

  // ---- 一言でいうと ----
  const earningsWord = strong(ern) ? '業績は良好' : weak(ern) ? '業績は弱め' : '業績は平均的';
  const priceWord =
    price.levelLabel === '割安より'
      ? '株価は落ち着いた水準'
      : price.levelLabel === '割高より'
        ? '株価はやや割高'
        : price.levelLabel === '適正圏'
          ? '株価はほぼ妥当な水準'
          : '株価水準は判断しづらい';
  const oneLiner =
    total.score === null ? 'データが足りず、この銘柄は評価を出していません。' : `${earningsWord}。ただし${priceWord}。`;

  // ---- 3行まとめ ----
  const goodBits: string[] = [];
  if (strong(ern)) goodBits.push('売上・利益ともに成長しています');
  if (strong(fin)) goodBits.push('財務も比較的安定しています');
  if (strong(grw)) goodBits.push('今後の成長も会社予想に織り込まれています');
  if (strong(div)) goodBits.push('配当も安定して出ています');
  if (strong(val)) goodBits.push('株価は過去と比べて割安な水準です');
  if (goodBits.length === 0) goodBits.push('現時点で目立った強みは見つかりませんでした');

  const badBits: string[] = [];
  if (weak(ern)) badBits.push('業績の伸びが鈍く、利益が伸び悩んでいます');
  if (weak(fin)) badBits.push('借入が重く、財務にはやや不安があります');
  if (weak(val)) badBits.push('現在の株価は割安とは言い切れません');
  if (weak(grw)) badBits.push('今後の成長は限定的と見られます');
  if (weak(div)) badBits.push('配当を目的に持つには物足りません');
  if (badBits.length === 0) badBits.push('大きな弱点は見当たりませんが、完璧な銘柄はありません');

  const topWarning = warnings[0];
  const cautionText = topWarning
    ? `${topWarning.title}。${topWarning.todo}`
    : total.crossChecks[0]
      ? total.crossChecks[0].detail
      : '短期間で大きく値上がりした直後に買うと、含み損を抱えやすい点には注意してください。';

  const insufficient = total.score === null;

  const threeLines: ThreeLineSummary = insufficient
    ? {
        good: '公開データが揃っている項目だけを見ると、上記の指標には強みが見られます。ただし全体像は判断できません。',
        bad: '業績・財務・成長性のいずれかで必要なデータが取得できておらず、弱点の有無を確認できません。',
        caution:
          'データが揃っていない銘柄は、初心者が最初に選ぶ対象としては向きません。決算資料などで直接内容を確認できる場合にのみ検討してください。',
      }
    : {
        good: goodBits.slice(0, 2).join('。') + '。',
        bad: badBits.slice(0, 2).join('。') + '。',
        caution: cautionText,
      };

  // ---- 良いところ / 注意点 ----
  const goodPoints = topMetrics(cats, ['good'], 5);
  const cautionPoints: Highlight[] = [
    ...warnings.slice(0, 3).map((w) => ({ label: w.title, detail: w.why })),
    ...topMetrics(cats, ['bad', 'watch'], 3),
  ].slice(0, 5);

  // ---- 初心者向けの読み解き ----
  const beginnerRead: string[] = [];
  beginnerRead.push(`${s.name}は${s.business}`);
  if (ern?.score !== null && ern) {
    beginnerRead.push(
      `「ちゃんと儲かっているか」という点では、${ern.max}点満点中${ern.score}点でした。${ern.comment}`
    );
  }
  if (fin?.score !== null && fin) {
    beginnerRead.push(`「つぶれにくいか」という点では、${fin.max}点満点中${fin.score}点でした。${fin.comment}`);
  }
  if (val?.score !== null && val) {
    beginnerRead.push(`「今の株価が高いか安いか」という点では、${val.max}点満点中${val.score}点でした。${val.comment}`);
  }
  if (div?.score !== null && div) {
    beginnerRead.push(`配当については、${div.max}点満点中${div.score}点でした。${div.comment}`);
  }
  if (insufficient) {
    beginnerRead.push(
      'この銘柄は、評価に必要な数字の一部が取得できていません。足りない数字を推測して補うことはしないため、総合評価は表示していません。'
    );
  }
  beginnerRead.push(
    'ここまでの内容は、公開されている数字を決められたルールで機械的に整理したものです。将来の株価を予測したものではありません。'
  );

  return {
    insufficient,
    insufficientNote: insufficient
      ? '取得できた項目だけを表示しています。全体としての評価は出していないため、下記の「良いところ」だけを根拠に判断しないでください。'
      : undefined,
    oneLiner,
    threeLines,
    goodPoints,
    cautionPoints,
    beginnerRead,
  };
}
