export type Judgement = 'good' | 'ok' | 'watch' | 'bad' | 'na';

export interface Metric {
  key: string;
  label: string;
  /** 用語解説（初心者モードの「？」ボタン）のキー */
  term?: string;
  display: string;
  judgement: Judgement;
  /** なぜその判定なのかを日本語で */
  comment: string;
  points: number;
  max: number;
  /** false = データ欠損。満点計算から除外する（無理に減点しない） */
  counted: boolean;
}

export type CategoryKey = 'earnings' | 'financial' | 'valuation' | 'growth' | 'dividend' | 'technical';

export interface CategoryScore {
  key: CategoryKey;
  label: string;
  /** 初心者向けの言い換え */
  plainLabel: string;
  /** null = 判断材料不足（無理に点数を付けない） */
  score: number | null;
  max: number;
  /** 0〜5（0.5刻み）。score が null のときは 0 */
  stars: number;
  metrics: Metric[];
  /** データが揃っている割合 0〜1 */
  coverage: number;
  comment: string;
}
