import type { StockAnalysis } from '../../analysis';
import { fmtPrice, Pill } from './basics';
import { Spark } from './PriceChart';

const verdictTone = (v: StockAnalysis['total']['verdict']) =>
  v === 'candidate' ? 'good' : v === 'watch' ? 'ok' : v === 'caution' ? 'watch' : v === 'hurdle' ? 'bad' : 'na';

export function StockRow({
  analysis,
  reason,
  onOpen,
  badge,
}: {
  analysis: StockAnalysis;
  reason?: string;
  onOpen: (code: string) => void;
  badge?: string;
}) {
  const { stock: s, total } = analysis;
  const up = s.quote.changePercent > 0;
  const flat = s.quote.changePercent === 0;

  return (
    <button className="stock-row" onClick={() => onOpen(s.code)} style={{ display: 'block' }}>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="code">{s.code}</span>
            {badge && <Pill tone="brand">{badge}</Pill>}
          </div>
          <div className="name">{s.name}</div>
          <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Pill tone={verdictTone(total.verdict)}>
              {total.score === null ? '判断材料不足' : `AI ${total.score}点`}
            </Pill>
            <span className="muted">{s.sector}</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="price">{fmtPrice(s.quote.price)}円</div>
          <div className={`chg ${up ? 'up' : flat ? '' : 'down'}`}>
            {up ? '+' : ''}
            {s.quote.change.toFixed(s.quote.price >= 100 ? 0 : 1)}円 ({up ? '+' : ''}
            {s.quote.changePercent.toFixed(2)}%)
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
            <Spark history={s.history} />
          </div>
        </div>
      </div>
      {reason && <div className="reason">{reason}</div>}
    </button>
  );
}
