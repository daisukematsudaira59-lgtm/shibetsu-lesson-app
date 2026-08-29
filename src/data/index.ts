import { MockStockDataProvider } from './mock/mockProvider';
import type { StockDataProvider } from './provider';

/**
 * アプリ全体が使うデータ取得の入り口。
 *
 * 実データを接続するときは、ここを差し替えるだけで済みます。
 *   export const provider: StockDataProvider = new SomeRealApiProvider(apiKey);
 *
 * 接続前に必ず確認すること（要件23）:
 *   更新頻度 / 利用制限 / 商用利用可否 / 再配布可否 / リアルタイム性 / 料金
 */
export const provider: StockDataProvider = new MockStockDataProvider();

export type { StockDataProvider, SearchHit } from './provider';
