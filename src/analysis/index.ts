import type { Stock } from '../types/stock';
import { buildTechnical, type TechnicalSnapshot } from './indicators';
import { scoreEarnings } from './score/earnings';
import { scoreFinancial } from './score/financial';
import { scoreValuation } from './score/valuation';
import { scoreGrowth } from './score/growth';
import { scoreDividend } from './score/dividend';
import { scoreTechnical } from './score/technical';
import { computeTotal, type TotalScore } from './total';
import { buildWarnings, type Warning } from './warnings';
import { buildPriceReference, type PriceReference } from './priceBands';
import { buildTiming, type TimingAnalysis } from './timing';
import type { CategoryScore } from './types';
import { buildNarrative, type StockNarrative } from '../explain/summary';
import { analyzeAllNews, type AnalyzedNews } from '../explain/news';
import { analyzeEarnings, type EarningsAnalysis } from '../explain/earnings';
import { buildPreBuyGuide, type PreBuyGuide } from '../explain/preBuy';

export interface StockAnalysis {
  stock: Stock;
  technical: TechnicalSnapshot | null;
  categories: CategoryScore[];
  total: TotalScore;
  warnings: Warning[];
  priceReference: PriceReference;
  timing: TimingAnalysis;
  narrative: StockNarrative;
  news: AnalyzedNews[];
  earnings: EarningsAnalysis | null;
  preBuy: PreBuyGuide;
}

const cache = new Map<string, StockAnalysis>();

/** 1銘柄ぶんの分析をすべて組み立てる。UI はこの結果だけを見る。 */
export function analyze(stock: Stock): StockAnalysis {
  const cached = cache.get(stock.code);
  if (cached) return cached;

  const technical = buildTechnical(stock.history);
  const categories: CategoryScore[] = [
    scoreEarnings(stock),
    scoreFinancial(stock),
    scoreValuation(stock),
    scoreGrowth(stock),
    scoreDividend(stock),
    scoreTechnical(stock, technical),
  ];
  const total = computeTotal(stock, categories);
  const warnings = buildWarnings(stock, technical);
  const priceReference = buildPriceReference(stock, technical);
  const timing = buildTiming(stock, categories, total, technical);
  const narrative = buildNarrative(stock, categories, total, warnings, priceReference);

  const result: StockAnalysis = {
    stock,
    technical,
    categories,
    total,
    warnings,
    priceReference,
    timing,
    narrative,
    news: analyzeAllNews(stock),
    earnings: analyzeEarnings(stock),
    preBuy: buildPreBuyGuide(stock, categories, technical),
  };
  cache.set(stock.code, result);
  return result;
}

export const categoryOf = (a: StockAnalysis, key: CategoryScore['key']) =>
  a.categories.find((c) => c.key === key);

export type { CategoryScore } from './types';
export type { TotalScore } from './total';
export type { Warning } from './warnings';
export type { PriceReference } from './priceBands';
export type { TimingAnalysis } from './timing';
export type { TechnicalSnapshot } from './indicators';
export type { AnalyzedNews } from '../explain/news';
export type { EarningsAnalysis } from '../explain/earnings';
export type { StockNarrative } from '../explain/summary';
export type { PreBuyGuide } from '../explain/preBuy';
