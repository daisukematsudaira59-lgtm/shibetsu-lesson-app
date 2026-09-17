import type { Stock } from '../types/stock';
import type { CategoryScore } from './types';

export type Verdict = 'candidate' | 'watch' | 'caution' | 'hurdle' | 'insufficient';

export interface CrossCheck {
  title: string;
  detail: string;
  penalty: number;
}

export interface TotalScore {
  /** null = 判断材料不足（無理に点数を付けない） */
  score: number | null;
  stars: number;
  verdict: Verdict;
  verdictLabel: string;
  /** 点数だけでなく日本語での説明 */
  headline: string;
  coverage: number;
  /** 単一指標だけで評価しないための整合性チェック結果 */
  crossChecks: CrossCheck[];
  penalty: number;
}

const VERDICT_LABEL: Record<Verdict, string> = {
  candidate: '候補として調べる価値あり',
  watch: '様子見が無難',
  caution: '注意点が多い',
  hurdle: '初心者にはハードルが高い',
  insufficient: '判断材料不足',
};

/**
 * 単一の指標だけで高評価・低評価にならないようにする整合性チェック。
 * 「安い理由」「高い理由」を必ず考えるための仕組み。
 */
function crossCheck(s: Stock, cats: Record<string, CategoryScore>): CrossCheck[] {
  const out: CrossCheck[] = [];
  const val = cats.valuation?.score;
  const ern = cats.earnings?.score;
  const grw = cats.growth?.score;
  const tec = cats.technical?.score;
  const div = cats.dividend?.score;
  const fin = cats.financial?.score;

  if (val !== null && val !== undefined && val >= 14 && ern !== null && ern !== undefined && ern <= 9) {
    out.push({
      title: '「割安」の理由が業績の弱さかもしれません',
      detail:
        '株価指標では割安に見えますが、業績が伴っていません。安いのには理由があるケース（いわゆるバリュートラップ）があるため、割安さだけを理由に判断しないでください。',
      penalty: 5,
    });
  }

  if (tec !== null && tec !== undefined && tec >= 7 && ern !== null && ern !== undefined && ern <= 9) {
    out.push({
      title: '株価は上がっていますが業績は追いついていません',
      detail: '値動きの勢いは強い一方で、業績の裏付けが弱い状態です。株価が上がっていること自体は買う理由になりません。',
      penalty: 4,
    });
  }

  const yieldPct = s.dividend.yield ?? 0;
  const payout = s.dividend.payoutRatio;
  if (yieldPct >= 4 && ((payout !== undefined && payout > 80) || s.dividend.hasCutHistory)) {
    out.push({
      title: '高い配当利回りが続かない可能性があります',
      detail:
        '利回りは高いものの、利益に対する配当の割合が大きい、または過去に減配した実績があります。利回りの高さだけで選ぶと、減配と同時に株価も下がるリスクがあります。',
      penalty: 4,
    });
  }

  if (
    val !== null &&
    val !== undefined &&
    val <= 8 &&
    grw !== null &&
    grw !== undefined &&
    grw <= 10
  ) {
    out.push({
      title: '株価は高めですが成長は限定的です',
      detail: '割高な水準にある一方で、それを正当化するほどの成長は見えていません。期待が先行している可能性があります。',
      penalty: 5,
    });
  }

  if (fin !== null && fin !== undefined && fin <= 8 && ern !== null && ern !== undefined && ern <= 10) {
    out.push({
      title: '財務と業績の両方に不安があります',
      detail: '借入の重さと業績の弱さが重なっています。初心者が最初に持つ銘柄としては難易度が高い状態です。',
      penalty: 6,
    });
  }

  if (div !== null && div !== undefined && div >= 8 && grw !== null && grw !== undefined && grw <= 8) {
    out.push({
      title: '配当は魅力的ですが値上がりは期待しにくい構成です',
      detail: '配当中心のリターンになりやすい銘柄です。値上がり益を期待して持つと想定と違う結果になる可能性があります。',
      penalty: 0,
    });
  }

  return out;
}

export function computeTotal(s: Stock, categories: CategoryScore[]): TotalScore {
  const map: Record<string, CategoryScore> = {};
  for (const c of categories) map[c.key] = c;

  const available = categories.filter((c) => c.score !== null);
  const availMax = available.reduce((a, c) => a + c.max, 0);
  const totalMax = categories.reduce((a, c) => a + c.max, 0);
  const gained = available.reduce((a, c) => a + (c.score ?? 0), 0);
  const coverage = totalMax === 0 ? 0 : availMax / totalMax;

  const checks = crossCheck(s, map);
  const penalty = checks.reduce((a, c) => a + c.penalty, 0);

  // 判断材料が足りないときは点数を付けない（要件27）
  const missingCore = ['earnings', 'financial', 'valuation'].filter((k) => map[k]?.score === null).length;
  if (coverage < 0.6 || missingCore >= 2) {
    return {
      score: null,
      stars: 0,
      verdict: 'insufficient',
      verdictLabel: VERDICT_LABEL.insufficient,
      headline:
        '公開データが十分に取得できていないため、この銘柄には点数を付けていません。数字が揃っていない銘柄を無理に判断するのは避けてください。',
      coverage,
      crossChecks: checks,
      penalty,
    };
  }

  const raw = (gained / availMax) * 100;
  const score = Math.max(0, Math.min(100, Math.round(raw - penalty)));
  const stars = Math.round((score / 100) * 10) / 2;

  const verdict: Verdict = score >= 70 ? 'candidate' : score >= 55 ? 'watch' : score >= 40 ? 'caution' : 'hurdle';

  const headline =
    verdict === 'candidate'
      ? '複数の指標がバランスよく良好で、初心者でも内容を理解しやすい銘柄です。ただし「買うべき」という意味ではありません。'
      : verdict === 'watch'
        ? '悪くはありませんが、いくつか気になる点があります。理由を確認してから判断したい銘柄です。'
        : verdict === 'caution'
          ? '注意すべき点が複数あります。なぜその状態なのかを理解できるまでは見送るという選択肢もあります。'
          : '業績・財務・株価水準のいずれかに大きな課題があり、初心者が最初に選ぶ銘柄としては難易度が高い状態です。';

  return { score, stars, verdict, verdictLabel: VERDICT_LABEL[verdict], headline, coverage, crossChecks: checks, penalty };
}

export type EvidenceLevel = '強い' | 'ふつう' | '弱い' | '不足';

export interface EvidenceStrength {
  level: EvidenceLevel;
  /** なぜその強さなのか */
  detail: string;
  /** 6項目中いくつが良好か */
  goodCount: number;
  /** 6項目中いくつが弱いか */
  weakCount: number;
}

/**
 * 「この判断はどれくらい信頼してよいか」。
 * 将来の勝率ではなく、分析の材料が揃っていて指標どうしが矛盾していないか、
 * という「根拠の強さ」を示す。勝率は誰にも出せないため、代わりにこれを表示する。
 */
export function evidenceStrength(total: TotalScore, categories: CategoryScore[]): EvidenceStrength {
  const scored = categories.filter((c) => c.score !== null);
  const ratio = (c: CategoryScore) => (c.score ?? 0) / c.max;
  const goodCount = scored.filter((c) => ratio(c) >= 0.65).length;
  const weakCount = scored.filter((c) => ratio(c) <= 0.4).length;
  const conflicts = total.crossChecks.length;
  const coveragePct = Math.round(total.coverage * 100);

  if (total.score === null) {
    return {
      level: '不足',
      goodCount,
      weakCount,
      detail: `評価に必要なデータが揃っていません（取得率 ${coveragePct}%）。判断材料が足りない銘柄は、そもそも検討の対象から外すのが安全です。`,
    };
  }

  const base = `6項目中 ${goodCount}項目が良好、${weakCount}項目が弱め。データ取得率 ${coveragePct}%、矛盾する指標の組み合わせ ${conflicts}件。`;

  if (total.coverage >= 0.9 && conflicts === 0 && (goodCount >= 4 || weakCount >= 4)) {
    return {
      level: '強い',
      goodCount,
      weakCount,
      detail: `${base}指標の向きが揃っており、分析としてはぶれの少ない結果です。ただし将来を保証するものではありません。`,
    };
  }
  if (total.coverage >= 0.7 && conflicts <= 1 && (goodCount >= 3 || weakCount >= 3)) {
    return {
      level: 'ふつう',
      goodCount,
      weakCount,
      detail: `${base}おおむね方向は揃っていますが、一部に気になる点があります。「注意点」を読んだうえで判断してください。`,
    };
  }
  return {
    level: '弱い',
    goodCount,
    weakCount,
    detail: `${base}良い指標と悪い指標が混在しており、分析だけでは判断が定まりません。初心者が最初に選ぶ銘柄としては難しい部類です。`,
  };
}
