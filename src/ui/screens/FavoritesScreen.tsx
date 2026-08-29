import { useMemo } from 'react';
import { analyze } from '../../analysis';
import { useFavorites } from '../../store/favorites';
import { useAllStocks } from '../useStocks';
import { Card, Pill } from '../components/basics';
import { StockRow } from '../components/StockRow';

export function FavoritesScreen({ onOpen, onSearch }: { onOpen: (code: string) => void; onSearch: () => void }) {
  const { codes } = useFavorites();
  const { stocks, loading } = useAllStocks();

  const items = useMemo(
    () => (stocks ?? []).filter((s) => codes.includes(s.code)).map(analyze),
    [stocks, codes]
  );

  return (
    <div className="screen">
      <Card>
        <h2 style={{ margin: 0, fontSize: 20 }}>お気に入り</h2>
        <p className="section-sub" style={{ margin: '4px 0 0' }}>
          登録した銘柄の株価・前日比・AI評価・ニュース・決算をまとめて確認できます。
        </p>
      </Card>

      {loading && <div className="skeleton" />}

      {!loading && items.length === 0 && (
        <Card>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>まだ登録がありません</div>
          <div className="muted" style={{ marginBottom: 12 }}>
            銘柄の分析画面で「☆ お気に入り」を押すと、ここに追加されます。
          </div>
          <button className="btn primary block" onClick={onSearch}>
            銘柄をさがす
          </button>
        </Card>
      )}

      {items.map((a) => {
        const topNews = a.news[0];
        return (
          <div key={a.stock.code}>
            <StockRow analysis={a} onOpen={onOpen} reason={a.narrative.oneLiner} />
            <Card tight style={{ marginTop: -4, borderRadius: '0 0 var(--radius) var(--radius)' }}>
              <div className="stack" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <Pill tone={a.warnings.length === 0 ? 'good' : a.warnings[0].level === 'high' ? 'bad' : 'watch'}>
                    注意ポイント {a.warnings.length}件
                  </Pill>
                  {a.earnings && (
                    <Pill tone={a.earnings.verdict === 'good' ? 'good' : a.earnings.verdict === 'fair' ? 'ok' : 'watch'}>
                      直近決算：{a.earnings.label}
                    </Pill>
                  )}
                  {a.stock.nextEarningsDate && <Pill tone="na">次回決算 {a.stock.nextEarningsDate}</Pill>}
                </div>
                {topNews && (
                  <div className="muted">
                    最新ニュース：{topNews.title}（{topNews.impactLabel}）
                  </div>
                )}
              </div>
            </Card>
          </div>
        );
      })}

      {items.length > 0 && (
        <div className="note">
          AI評価は、株価やデータが更新されるたびに変わります。表示は現在取得しているデータ時点のものです。
        </div>
      )}
    </div>
  );
}
