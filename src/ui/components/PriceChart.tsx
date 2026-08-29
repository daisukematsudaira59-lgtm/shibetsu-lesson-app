import { useMemo, useState } from 'react';
import type { PricePoint } from '../../types/stock';
import { macd as calcMacd, rsi as calcRsi, sma } from '../../analysis/indicators';

type Period = 60 | 120 | 250;

const PERIODS: { key: Period; label: string }[] = [
  { key: 60, label: '3か月' },
  { key: 120, label: '6か月' },
  { key: 250, label: '1年' },
];

const W = 340;
const H = 170;
const PAD = { l: 6, r: 46, t: 10, b: 18 };

function path(values: (number | null)[], x: (i: number) => number, y: (v: number) => number) {
  let d = '';
  let pen = false;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
  });
  return d;
}

export function PriceChart({ history }: { history: PricePoint[] }) {
  const [period, setPeriod] = useState<Period>(120);

  const view = useMemo(() => {
    const closes = history.map((p) => p.close);
    const s25 = sma(closes, 25);
    const s75 = sma(closes, 75);
    const s200 = sma(closes, 200);
    const r = calcRsi(closes);
    const m = calcMacd(closes);

    const from = Math.max(0, history.length - period);
    const slice = <T,>(a: T[]) => a.slice(from);

    const pts = slice(history);
    const series = {
      close: slice(closes),
      s25: slice(s25),
      s75: slice(s75),
      s200: slice(s200),
      rsi: slice(r),
      macd: slice(m.macd),
      signal: slice(m.signal),
      hist: slice(m.histogram),
    };

    const all = [
      ...series.close,
      ...series.s25.filter((v): v is number => v !== null),
      ...series.s75.filter((v): v is number => v !== null),
      ...series.s200.filter((v): v is number => v !== null),
    ];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.08 || 1;

    return { pts, series, min: min - pad, max: max + pad };
  }, [history, period]);

  const n = view.pts.length;
  const x = (i: number) => PAD.l + (i / Math.max(n - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - view.min) / (view.max - view.min)) * (H - PAD.t - PAD.b);

  const highIdx = view.series.close.indexOf(Math.max(...view.series.close));
  const lowIdx = view.series.close.indexOf(Math.min(...view.series.close));
  const last = view.pts[n - 1];

  // RSI サブチャート
  const RH = 54;
  const ry = (v: number) => 8 + (1 - v / 100) * (RH - 16);

  // MACD サブチャート
  const MH = 54;
  const macdVals = [...view.series.macd, ...view.series.signal].filter(Number.isFinite);
  const mMax = Math.max(...macdVals.map(Math.abs), 1);
  const my = (v: number) => MH / 2 - (v / mMax) * (MH / 2 - 6);

  const firstDate = view.pts[0]?.date ?? '';
  const lastDate = last?.date ?? '';

  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="chips">
        {PERIODS.map((p) => (
          <button key={p.key} className="chip" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>
            {p.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="株価チャート">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const v = view.min + (view.max - view.min) * (1 - f);
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e8ecf1" strokeWidth="1" />
              <text x={W - PAD.r + 4} y={y(v) + 3.5} fontSize="9" fill="#8b95a3">
                {Math.round(v).toLocaleString()}
              </text>
            </g>
          );
        })}

        <path d={path(view.series.s200, x, y)} fill="none" stroke="#b07ad1" strokeWidth="1.3" />
        <path d={path(view.series.s75, x, y)} fill="none" stroke="#e0a13a" strokeWidth="1.3" />
        <path d={path(view.series.s25, x, y)} fill="none" stroke="#3fa2d6" strokeWidth="1.3" />
        <path d={path(view.series.close, x, y)} fill="none" stroke="#16202e" strokeWidth="1.9" />

        {highIdx >= 0 && (
          <>
            <circle cx={x(highIdx)} cy={y(view.series.close[highIdx])} r="2.6" fill="#c0392b" />
            <text x={x(highIdx)} y={y(view.series.close[highIdx]) - 6} fontSize="9" fill="#c0392b" textAnchor="middle">
              高値 {Math.round(view.series.close[highIdx]).toLocaleString()}
            </text>
          </>
        )}
        {lowIdx >= 0 && (
          <>
            <circle cx={x(lowIdx)} cy={y(view.series.close[lowIdx])} r="2.6" fill="#1f6fb2" />
            <text x={x(lowIdx)} y={y(view.series.close[lowIdx]) + 12} fontSize="9" fill="#1f6fb2" textAnchor="middle">
              安値 {Math.round(view.series.close[lowIdx]).toLocaleString()}
            </text>
          </>
        )}

        <text x={PAD.l} y={H - 4} fontSize="9" fill="#8b95a3">{firstDate}</text>
        <text x={W - PAD.r} y={H - 4} fontSize="9" fill="#8b95a3" textAnchor="end">{lastDate}</text>
      </svg>

      <div className="row" style={{ flexWrap: 'wrap', gap: 12, fontSize: 12, color: 'var(--ink-2)' }}>
        <LegendDot color="#16202e" label="株価（終値）" />
        <LegendDot color="#3fa2d6" label="25日" />
        <LegendDot color="#e0a13a" label="75日" />
        <LegendDot color="#b07ad1" label="200日" />
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 2 }}>RSI（14日）— 70以上は買われすぎ、30以下は売られすぎの目安</div>
        <svg viewBox={`0 0 ${W} ${RH}`} width="100%" role="img" aria-label="RSI">
          {[30, 50, 70].map((lv) => (
            <g key={lv}>
              <line x1={PAD.l} x2={W - PAD.r} y1={ry(lv)} y2={ry(lv)} stroke={lv === 50 ? '#eef1f5' : '#e6d9c4'} strokeDasharray={lv === 50 ? '' : '3 3'} />
              <text x={W - PAD.r + 4} y={ry(lv) + 3} fontSize="8.5" fill="#8b95a3">{lv}</text>
            </g>
          ))}
          <path d={path(view.series.rsi, x, ry)} fill="none" stroke="#6b53c4" strokeWidth="1.5" />
        </svg>
      </div>

      <div>
        <div className="muted" style={{ marginBottom: 2 }}>MACD — 青線がオレンジ線を上回ると上昇の勢いが出ているとされます</div>
        <svg viewBox={`0 0 ${W} ${MH}`} width="100%" role="img" aria-label="MACD">
          <line x1={PAD.l} x2={W - PAD.r} y1={my(0)} y2={my(0)} stroke="#e8ecf1" />
          {view.series.hist.map((v, i) =>
            Number.isFinite(v) ? (
              <line
                key={i}
                x1={x(i)}
                x2={x(i)}
                y1={my(0)}
                y2={my(v)}
                stroke={v >= 0 ? '#e2b7b2' : '#b7c8dd'}
                strokeWidth={Math.max(1, (W - PAD.l - PAD.r) / n - 0.5)}
              />
            ) : null
          )}
          <path d={path(view.series.macd, x, my)} fill="none" stroke="#1d6fb8" strokeWidth="1.5" />
          <path d={path(view.series.signal, x, my)} fill="none" stroke="#d98324" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="row" style={{ gap: 5 }}>
      <span style={{ width: 14, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

/** リスト用の小さなスパークライン */
export function Spark({ history, days = 60 }: { history: PricePoint[]; days?: number }) {
  const closes = history.slice(-days).map((p) => p.close);
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const w = 52;
  const h = 22;
  const d = closes
    .map((v, i) => {
      const px = (i / (closes.length - 1)) * w;
      const py = h - ((v - min) / (max - min || 1)) * h;
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join('');
  const rising = closes[closes.length - 1] >= closes[0];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ flex: '0 0 auto' }}>
      <path d={d} fill="none" stroke={rising ? 'var(--up)' : 'var(--down)'} strokeWidth="1.6" />
    </svg>
  );
}
