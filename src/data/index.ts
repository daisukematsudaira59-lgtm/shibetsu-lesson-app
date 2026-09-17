import { MockStockDataProvider } from './mock/mockProvider';
import type { StockDataProvider } from './provider';
import { loadSnapshot, SnapshotStockDataProvider } from './snapshot/snapshotProvider';

/**
 * アプリ全体が使うデータ取得の入り口。
 *
 * - `npm run fetch-data` で src/data/snapshot/stocks.json が生成されていれば実データ（J-Quants）
 * - 無ければデモ用のモックデータ（全画面に「デモ表示中」の警告が出る）
 *
 * 接続前に必ず確認すること（要件23）:
 *   更新頻度 / 利用制限 / 商用利用可否 / 再配布可否 / リアルタイム性 / 料金
 */
const snapshot = loadSnapshot();
export const provider: StockDataProvider = snapshot ? new SnapshotStockDataProvider(snapshot) : new MockStockDataProvider();

export type { StockDataProvider, SearchHit } from './provider';
