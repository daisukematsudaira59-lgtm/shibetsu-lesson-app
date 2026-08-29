import { useMemo, useState } from 'react';
import { buildBudgetPicks, type BudgetStyle } from '../../analysis/screening';
import { useAllStocks } from '../useStocks';
import { Card, Pill, TermButton } from '../components/basics';
import { StockRow } from '../components/StockRow';

const PRESETS = [10000, 30000, 50000, 100000, 300000];

const STYLE_NOTE: Record<BudgetStyle, string> = {
  成長型: '売上・利益の伸びが期待される銘柄です。値動きは大きくなりやすい傾向があります。',
  配当型: '配当を受け取ることが主なリターンになる銘柄です。',
  安定型: '財務が安定しており、値動きが比較的落ち着いている銘柄です。',
  割安型: '株価指標が過去や平均と比べて控えめな銘柄です。安い理由の確認が必要です。',
};

export function BudgetScreen({ onOpen }: { onOpen: (code: string) => void }) {
  const { stocks, loading } = useAllStocks();
  const [budget, setBudget] = useState(100000);
  const [style, setStyle] = useState<BudgetStyle | 'すべて'>('すべて');

  const picks = useMemo(() => (stocks ? buildBudgetPicks(stocks, budget) : []), [stocks, budget]);
  const filtered = picks.filter((p) => style === 'すべて' || p.style === style);

  return (
    <div className="screen">
      <Card>
        <h2 style={{ margin: 0, fontSize: 20 }}>少額投資モード</h2>
        <p className="section-sub" style={{ margin: '4px 0 10px' }}>
          SBI証券のS株（単元未満株）なら1株から買えます。予算内で買える銘柄を、タイプ別に整理しました。
          <TermButton termKey="sKabu" />
        </p>
        <label htmlFor="budget" style={{ fontSize: 14, fontWeight: 700 }}>
          予算
        </label>
        <input
          id="budget"
          type="number"
          value={budget}
          min={1000}
          step={1000}
          onChange={(e) => setBudget(Math.max(1000, Number(e.target.value) || 0))}
          style={{ marginTop: 6 }}
        />
        <div className="chips" style={{ marginTop: 10 }}>
          {PRESETS.map((p) => (
            <button key={p} className="chip" aria-pressed={budget === p} onClick={() => setBudget(p)}>
              {p.toLocaleString()}円
            </button>
          ))}
        </div>
      </Card>

      <div className="chips">
        {(['すべて', '成長型', '配当型', '安定型', '割安型'] as const).map((s) => (
          <button key={s} className="chip" aria-pressed={style === s} onClick={() => setStyle(s)}>
            {s}
          </button>
        ))}
      </div>

      {loading && <div className="skeleton" />}

      {!loading && filtered.length === 0 && (
        <Card>
          <div className="muted">
            この予算で買える銘柄が見つかりませんでした。予算を増やすか、条件を変えてお試しください。
          </div>
        </Card>
      )}

      <div>
        {filtered.map((p) => (
          <div key={p.analysis.stock.code} style={{ marginBottom: 10 }}>
            <StockRow
              analysis={p.analysis}
              badge={p.style}
              reason={`予算 ${budget.toLocaleString()}円で ${p.shares}株（約 ${p.cost.toLocaleString()}円）購入できます。${STYLE_NOTE[p.style]}`}
              onOpen={onOpen}
            />
          </div>
        ))}
      </div>

      <div className="note">
        表示している株数は「予算 ÷ 現在株価」で計算した目安です。実際には手数料・約定価格の変動により購入できる株数は変わります。
        また、1銘柄に予算を集中させず、複数に分けることも検討してください。
      </div>
      <div className="note">
        <Pill tone="watch">注意</Pill> 少額でも投資である以上、元本割れの可能性があります。生活に必要な資金は使わないでください。
      </div>
    </div>
  );
}
