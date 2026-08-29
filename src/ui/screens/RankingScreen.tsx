import { useMemo, useState } from 'react';
import { buildRanking, RANKINGS, type RankingKey } from '../../analysis/screening';
import { useAllStocks } from '../useStocks';
import { Card } from '../components/basics';
import { StockRow } from '../components/StockRow';

export function RankingScreen({ onOpen }: { onOpen: (code: string) => void }) {
  const { stocks, loading } = useAllStocks();
  const [key, setKey] = useState<RankingKey>('beginner');
  const def = RANKINGS.find((r) => r.key === key)!;
  const picks = useMemo(() => (stocks ? buildRanking(stocks, key) : []), [stocks, key]);

  return (
    <div className="screen">
      <Card>
        <h2 style={{ margin: 0, fontSize: 20 }}>ランキング</h2>
        <p className="section-sub" style={{ margin: '4px 0 0' }}>
          株価の上昇率だけで順位を付けず、複数の指標を組み合わせています。
        </p>
      </Card>

      <div className="chips">
        {RANKINGS.map((r) => (
          <button key={r.key} className="chip" aria-pressed={key === r.key} onClick={() => setKey(r.key)}>
            {r.title.replace('ランキング', '')}
          </button>
        ))}
      </div>

      <div>
        <h3 className="section-title" style={{ fontSize: 17 }}>{def.title}</h3>
        <div className="note" style={{ marginTop: 6 }}>順位の基準：{def.criteria}</div>
      </div>

      {loading && <div className="skeleton" />}

      <div>
        {picks.map((p, i) => (
          <StockRow
            key={p.analysis.stock.code}
            analysis={p.analysis}
            badge={`${i + 1}位`}
            reason={p.reason}
            onOpen={onOpen}
          />
        ))}
        {!loading && picks.length === 0 && (
          <Card>
            <div className="muted">該当する銘柄がありませんでした。条件に合う銘柄がない場合、無理に表示しません。</div>
          </Card>
        )}
      </div>
    </div>
  );
}
