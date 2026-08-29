import type { DataMeta, Stock } from '../types/stock';

export interface SearchHit {
  code: string;
  name: string;
  sector: string;
  /** ヒットした理由（銘柄名 / コード / タグ） */
  matchedBy: 'code' | 'name' | 'tag' | 'sector';
  price: number;
  changePercent: number;
}

/**
 * データ取得層のインターフェース。
 *
 * 実データを接続するときは、この interface を実装したクラスを作り
 * src/data/index.ts の `provider` を差し替えるだけで済みます。
 * 分析ロジック・解説生成・UI はこの interface にしか依存していません。
 *
 * 実装時の必須確認事項（要件23）:
 *  - 提供元 / 利用規約 / 商用利用可否 / 再配布可否
 *  - 更新頻度・遅延・リアルタイム性
 *  - 呼び出し回数制限と料金
 * 確認結果は meta.notice に入れて UI に表示すること。
 */
export interface StockDataProvider {
  readonly meta: DataMeta;
  /** 銘柄コード / 会社名 / テーマ（半導体・高配当など）で検索 */
  search(query: string): Promise<SearchHit[]>;
  getStock(code: string): Promise<Stock | null>;
  /** ランキング・スクリーニング用。実API接続時はサーバー側集計に置き換える想定 */
  listAll(): Promise<Stock[]>;
}
