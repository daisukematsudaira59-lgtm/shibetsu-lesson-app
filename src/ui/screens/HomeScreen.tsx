import { useMemo, useState } from 'react';
import { buildHomeLists } from '../../analysis/screening';
import { APP_CONFIG } from '../../app/config';
import { useAllStocks } from '../useStocks';
import { Card } from '../components/basics';
import { StockRow } from '../components/StockRow';
import { DataStamp } from '../components/Disclaimer';

export function HomeScreen({ onOpen, onSearch }: { onOpen: (code: string) => void; onSearch: () => void }) {
  const { stocks, loading } = useAllStocks();
  const lists = useMemo(() => (stocks ? buildHomeLists(stocks) : []), [stocks]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const today = new Date();
  const dateLabel = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;

  return (
    <div className="screen">
      <Card>
        <div className="muted">{dateLabel}</div>
        <h2 style={{ margin: '2px 0 6px', fontSize: 22 }}>今日の投資判断</h2>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: 'var(--ink-2)' }}>
          「どの株を調べればいいか分からない」を出発点に、調べる価値のある銘柄を7つの切り口で整理しました。
          スコアは分析結果であり、売買の推奨ではありません。
        </p>
        <button className="btn primary block" style={{ marginTop: 14 }} onClick={onSearch}>
          🔍 銘柄を検索する（会社名・コード・テーマ）
        </button>
      </Card>

      {loading && (
        <>
          <div className="skeleton" />
          <div className="skeleton" />
        </>
      )}

      {lists.map((list) => {
        const open = expanded[list.key];
        const picks = open ? list.picks : list.picks.slice(0, 3);
        return (
          <section key={list.key} className="stack" style={{ gap: 10 }}>
            <div>
              <h2 className="section-title">{list.title}</h2>
              <p className="section-sub">{list.subtitle}</p>
            </div>
            <div className="note">選び方：{list.criteria}</div>
            {picks.length === 0 ? (
              <Card tight>
                <div className="muted">現在このリストに該当する銘柄はありません。該当がない場合、無理に銘柄は表示しません。</div>
              </Card>
            ) : (
              <div>
                {picks.map((p) => (
                  <StockRow key={p.analysis.stock.code} analysis={p.analysis} reason={p.reason} onOpen={onOpen} />
                ))}
              </div>
            )}
            {list.picks.length > 3 && (
              <button
                className="btn block"
                onClick={() => setExpanded((e) => ({ ...e, [list.key]: !open }))}
              >
                {open ? '閉じる' : `もっと見る（全${list.picks.length}件）`}
              </button>
            )}
          </section>
        );
      })}

      {stocks && <DataStamp meta={stocks[0].meta} />}
      <div className="note">{APP_CONFIG.disclaimer.short}</div>
    </div>
  );
}
