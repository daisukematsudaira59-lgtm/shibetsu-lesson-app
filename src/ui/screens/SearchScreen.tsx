import { useEffect, useMemo, useState } from 'react';
import { provider } from '../../data';
import type { SearchHit } from '../../data';
import { analyze } from '../../analysis';
import { useAllStocks } from '../useStocks';
import { Card } from '../components/basics';
import { StockRow } from '../components/StockRow';

const SUGGESTIONS = ['トヨタ', '7203', 'ソフトバンク', '半導体', '高配当', '銀行', '割安', '成長', '少額'];

const MATCH_LABEL: Record<SearchHit['matchedBy'], string> = {
  code: '証券コード',
  name: '会社名',
  tag: 'テーマ',
  sector: '業種',
};

export function SearchScreen({ onOpen }: { onOpen: (code: string) => void }) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const { stocks } = useAllStocks();

  useEffect(() => {
    if (!query.trim()) {
      setHits(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      provider.search(query).then((r) => {
        setHits(r);
        setSearching(false);
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  const byCode = useMemo(() => new Map((stocks ?? []).map((s) => [s.code, s])), [stocks]);

  return (
    <div className="screen">
      <Card>
        <label htmlFor="q" style={{ fontSize: 14, fontWeight: 700 }}>
          銘柄をさがす
        </label>
        <p className="muted" style={{ margin: '2px 0 10px' }}>
          会社名・証券コード・テーマ（半導体、高配当 など）で検索できます。
        </p>
        <input
          id="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例：トヨタ / 7203 / 半導体 / 高配当"
          autoComplete="off"
        />
        <div className="chips" style={{ marginTop: 12 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => setQuery(s)}>
              {s}
            </button>
          ))}
        </div>
      </Card>

      {searching && <div className="skeleton" />}

      {hits && !searching && (
        <>
          <div className="muted">
            「{query}」の検索結果：{hits.length}件
          </div>
          {hits.length === 0 && (
            <Card>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>該当する銘柄が見つかりませんでした</div>
              <div className="muted">
                現在はデモ用の限られた銘柄のみを収録しています。実データを接続すると全上場銘柄を検索できるようになります。
              </div>
            </Card>
          )}
          <div>
            {hits.map((h) => {
              const stock = byCode.get(h.code);
              if (!stock) return null;
              return (
                <StockRow
                  key={h.code}
                  analysis={analyze(stock)}
                  badge={MATCH_LABEL[h.matchedBy]}
                  reason={analyze(stock).narrative.oneLiner}
                  onOpen={onOpen}
                />
              );
            })}
          </div>
        </>
      )}

      {!hits && stocks && (
        <>
          <div className="muted">収録銘柄（デモ）</div>
          <div>
            {stocks.map((s) => (
              <StockRow key={s.code} analysis={analyze(s)} onOpen={onOpen} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
