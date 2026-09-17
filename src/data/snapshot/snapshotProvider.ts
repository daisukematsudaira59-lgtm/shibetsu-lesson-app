import type { DataMeta, Stock } from '../../types/stock';
import type { SearchHit, StockDataProvider } from '../provider';

/**
 * scripts/fetch-snapshot.mjs が書き出した実データ（stocks.json）を読むプロバイダ。
 * ファイルが無ければ `loadSnapshot()` は null を返し、アプリはモックにフォールバックする。
 */
interface SnapshotFile {
  fetchedAt: string;
  stocks: Stock[];
}

const modules = import.meta.glob<{ default: SnapshotFile }>('./stocks.json', { eager: true });

export function loadSnapshot(): SnapshotFile | null {
  const mod = Object.values(modules)[0];
  if (!mod?.default?.stocks?.length) return null;
  return mod.default;
}

const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, '');

export class SnapshotStockDataProvider implements StockDataProvider {
  readonly meta: DataMeta;
  private readonly stocks: Stock[];

  constructor(file: SnapshotFile) {
    this.stocks = file.stocks;
    const dates = file.stocks.map((s) => s.meta.asOf).sort();
    const newest = dates[dates.length - 1] ?? file.fetchedAt;
    this.meta = {
      sourceName: 'J-Quants API（JPX）',
      kind: 'api',
      asOf: newest,
      isDemo: false,
      notice: `${file.fetchedAt.slice(0, 16).replace('T', ' ')} に取得したスナップショットです。株価はリアルタイムではありません（無料プランは約12週間遅れ）。`,
    };
  }

  async search(query: string): Promise<SearchHit[]> {
    const q = normalize(query);
    if (!q) return [];
    const hits: SearchHit[] = [];
    for (const s of this.stocks) {
      let matchedBy: SearchHit['matchedBy'] | null = null;
      if (s.code.includes(q)) matchedBy = 'code';
      else if (normalize(s.name).includes(q) || s.aliases.some((a) => normalize(a).includes(q))) matchedBy = 'name';
      else if (s.tags.some((t) => normalize(t).includes(q))) matchedBy = 'tag';
      else if (normalize(s.sector).includes(q)) matchedBy = 'sector';
      if (matchedBy) hits.push({ code: s.code, name: s.name, sector: s.sector, matchedBy, price: s.quote.price, changePercent: s.quote.changePercent });
    }
    const order = { code: 0, name: 1, tag: 2, sector: 3 } as const;
    return hits.sort((a, b) => order[a.matchedBy] - order[b.matchedBy]);
  }

  async getStock(code: string): Promise<Stock | null> {
    return this.stocks.find((s) => s.code === code) ?? null;
  }

  async listAll(): Promise<Stock[]> {
    return this.stocks;
  }
}
