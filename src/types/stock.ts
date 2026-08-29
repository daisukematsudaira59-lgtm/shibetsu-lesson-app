/**
 * ドメイン型定義。
 *
 * この層は「データ取得層（src/data）」と「分析ロジック層（src/analysis）」の
 * 共通契約です。将来 API を差し替えても、この型に変換できれば
 * 分析・解説・UI は一切変更不要になります。
 *
 * 数値は「取得できなかった／公表されていない」場合 undefined を入れてください。
 * 0 や -1 を欠損値として使わないこと（分析ロジックが誤判定します）。
 */

/** データの出所。UI 上で必ず明示する。 */
export type DataSourceKind = 'mock' | 'api' | 'manual';

export interface DataMeta {
  /** データ提供元の表示名 */
  sourceName: string;
  kind: DataSourceKind;
  /** データ基準時刻 (ISO8601) */
  asOf: string;
  /** true の場合、本番データではないことを UI が強く警告する */
  isDemo: boolean;
  /** 注記（利用規約・遅延・再配布可否など） */
  notice?: string;
}

export interface PricePoint {
  /** YYYY-MM-DD */
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Quote {
  price: number;
  previousClose: number;
  /** 前日比（円） */
  change: number;
  /** 前日比（%） */
  changePercent: number;
  /** 時価総額（億円） */
  marketCapOku?: number;
  high52w?: number;
  low52w?: number;
  /** 年初来 or 上場来の目安 */
  allTimeHigh?: number;
}

/** 通期業績（単位: 百万円。EPS/BPS/配当は円） */
export interface FiscalYear {
  label: string;
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  eps?: number;
  bps?: number;
  dividendPerShare?: number;
  /** 会社予想か（実績なら false） */
  isForecast?: boolean;
}

export interface Financials {
  /** 自己資本比率(%) */
  equityRatio?: number;
  /** 有利子負債（百万円） */
  interestBearingDebt?: number;
  /** 現金及び現金同等物（百万円） */
  cash?: number;
  /** 営業キャッシュフロー（百万円） */
  operatingCF?: number;
  /** 投資キャッシュフロー（百万円） */
  investingCF?: number;
  /** 財務キャッシュフロー（百万円） */
  financingCF?: number;
  /** 前期の営業CF（悪化判定用） */
  operatingCFPrev?: number;
  roe?: number;
  roa?: number;
  /** 営業利益率(%) */
  operatingMargin?: number;
}

export interface Valuation {
  per?: number;
  forwardPer?: number;
  /** 過去5年平均PER */
  perAvg5y?: number;
  pbr?: number;
  pbrAvg5y?: number;
  psr?: number;
  /** 配当利回り(%) */
  dividendYield?: number;
}

export interface DividendInfo {
  /** 予想配当利回り(%) */
  yield?: number;
  /** 1株配当（円） */
  perShare?: number;
  /** 配当性向(%) */
  payoutRatio?: number;
  /** 連続増配年数 */
  consecutiveIncreaseYears?: number;
  /** 過去に減配した実績があるか */
  hasCutHistory?: boolean;
  /** 直近5期の1株配当推移 */
  historyPerShare?: number[];
}

export type NewsImpactHint = 'positive' | 'negative' | 'neutral' | 'unknown';

export interface NewsItem {
  id: string;
  title: string;
  /** 配信元 */
  source: string;
  /** ISO8601 */
  publishedAt: string;
  summary?: string;
  url?: string;
  /**
   * データ提供元がカテゴリを持っている場合のヒント。
   * 無い場合は 'unknown' とし、分析層がタイトルから推定する。
   */
  impactHint?: NewsImpactHint;
}

export interface EarningsReport {
  /** 例: 2025年3月期 第2四半期 */
  period: string;
  announcedAt: string;
  revenue?: number;
  operatingIncome?: number;
  netIncome?: number;
  /** 前年同期比(%) */
  revenueYoY?: number;
  operatingIncomeYoY?: number;
  netIncomeYoY?: number;
  /** 通期会社予想に対する進捗率(%) */
  progressRate?: number;
  /** 会社予想の修正 */
  guidanceRevision?: 'up' | 'down' | 'none' | 'unknown';
  /** 市場予想比(%)。取得できない場合は undefined */
  vsConsensus?: number;
}

export type SizeClass = 'large' | 'mid' | 'small';

export interface Stock {
  /** 証券コード */
  code: string;
  name: string;
  /** 検索・表示用のよみ／別名 */
  aliases: string[];
  sector: string;
  market: string;
  /** この会社は何をしている会社か（初心者向けの平易な説明） */
  business: string;
  /** 検索タグ（半導体 / 高配当 など） */
  tags: string[];
  sizeClass: SizeClass;
  /** 単元株数（S株ならこの限りではない） */
  tradingUnit: number;

  quote: Quote;
  history: PricePoint[];
  fiscal: FiscalYear[];
  financials: Financials;
  valuation: Valuation;
  dividend: DividendInfo;

  /** 次回決算発表予定日 (YYYY-MM-DD) */
  nextEarningsDate?: string;
  latestEarnings?: EarningsReport;
  news: NewsItem[];

  /** 信用倍率（買い残/売り残） */
  marginRatio?: number;

  meta: DataMeta;
}
