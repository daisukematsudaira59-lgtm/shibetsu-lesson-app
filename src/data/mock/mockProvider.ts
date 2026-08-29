import type { DataMeta, Quote, Stock, Valuation } from '../../types/stock';
import type { SearchHit, StockDataProvider } from '../provider';
import { MOCK_COMPANIES, type MockCompany } from './dataset';
import { generateHistory } from './history';

const META: DataMeta = {
  sourceName: 'サンプルデータ（デモ用・実在の数値ではありません）',
  kind: 'mock',
  asOf: new Date().toISOString(),
  isDemo: true,
  notice:
    'このデータは UI 検証用のサンプルです。実在企業の株価・財務数値ではありません。実際の投資判断には使用できません。',
};

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function buildStock(c: MockCompany): Stock {
  const history = generateHistory(c.history, 300);
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const price = last.close;
  const change = round(price - prev.close, 1);

  const closes = history.map((p) => p.close);
  const window52w = closes.slice(-250);

  const quote: Quote = {
    price,
    previousClose: prev.close,
    change,
    changePercent: round((change / prev.close) * 100, 2),
    marketCapOku: Math.round((price * c.sharesMil) / 100),
    high52w: Math.max(...window52w),
    low52w: Math.min(...window52w),
    allTimeHigh: Math.max(...closes),
  };

  const forecast = c.fiscal[c.fiscal.length - 1];
  const latestActual = [...c.fiscal].reverse().find((f) => !f.isForecast);

  // 株価から算出できる指標は必ず算出し、データセットと矛盾させない
  const valuation: Valuation = {
    per: latestActual?.eps && latestActual.eps > 0 ? round(price / latestActual.eps, 1) : undefined,
    forwardPer: forecast?.eps && forecast.eps > 0 ? round(price / forecast.eps, 1) : undefined,
    perAvg5y: c.perAvg5y,
    pbr: forecast?.bps ? round(price / forecast.bps, 2) : latestActual?.bps ? round(price / latestActual.bps, 2) : undefined,
    pbrAvg5y: c.pbrAvg5y,
    psr:
      forecast?.revenue || latestActual?.revenue
        ? round((price * c.sharesMil) / ((forecast?.revenue ?? latestActual!.revenue)!), 2)
        : undefined,
    dividendYield: forecast?.dividendPerShare ? round((forecast.dividendPerShare / price) * 100, 2) : undefined,
  };

  return {
    code: c.code,
    name: c.name,
    aliases: c.aliases,
    sector: c.sector,
    market: c.market,
    business: c.business,
    tags: c.tags,
    sizeClass: c.sizeClass,
    tradingUnit: c.tradingUnit,
    quote,
    history,
    fiscal: c.fiscal,
    financials: c.financials,
    valuation,
    dividend: {
      yield: valuation.dividendYield,
      perShare: forecast?.dividendPerShare,
      payoutRatio: c.dividend.payoutRatio,
      consecutiveIncreaseYears: c.dividend.consecutiveIncreaseYears,
      hasCutHistory: c.dividend.hasCutHistory,
      historyPerShare: c.dividend.historyPerShare,
    },
    nextEarningsDate: c.nextEarningsDate,
    latestEarnings: c.latestEarnings,
    news: c.news,
    marginRatio: c.marginRatio,
    meta: META,
  };
}

let cache: Stock[] | null = null;
function all(): Stock[] {
  if (!cache) cache = MOCK_COMPANIES.map(buildStock);
  return cache;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '');

export class MockStockDataProvider implements StockDataProvider {
  readonly meta = META;

  async search(query: string): Promise<SearchHit[]> {
    await sleep(120);
    const q = normalize(query);
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const s of all()) {
      let matchedBy: SearchHit['matchedBy'] | null = null;
      if (s.code.includes(q)) matchedBy = 'code';
      else if (normalize(s.name).includes(q) || s.aliases.some((a) => normalize(a).includes(q))) matchedBy = 'name';
      else if (s.tags.some((t) => normalize(t).includes(q))) matchedBy = 'tag';
      else if (normalize(s.sector).includes(q)) matchedBy = 'sector';
      if (matchedBy) {
        hits.push({
          code: s.code,
          name: s.name,
          sector: s.sector,
          matchedBy,
          price: s.quote.price,
          changePercent: s.quote.changePercent,
        });
      }
    }
    const order = { code: 0, name: 1, tag: 2, sector: 3 } as const;
    return hits.sort((a, b) => order[a.matchedBy] - order[b.matchedBy]);
  }

  async getStock(code: string): Promise<Stock | null> {
    await sleep(80);
    return all().find((s) => s.code === code) ?? null;
  }

  async listAll(): Promise<Stock[]> {
    await sleep(60);
    return all();
  }
}
