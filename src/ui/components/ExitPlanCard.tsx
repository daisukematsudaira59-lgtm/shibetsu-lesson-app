import { useMemo, useState } from 'react';
import { buildExitPlan, EXIT_PRESETS } from '../../analysis/exit';
import type { Stock } from '../../types/stock';
import { Card, Pill } from './basics';

const yen = (v: number) => `${v.toLocaleString()}円`;
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;

/** 「売り時の目安」= 買う前に決める出口ルール（要件9・§8の発展） */
export function ExitPlanCard({ stock }: { stock: Stock }) {
  const [presetKey, setPresetKey] = useState('standard');
  const preset = EXIT_PRESETS.find((p) => p.key === presetKey) ?? EXIT_PRESETS[1];
  const plan = useMemo(() => buildExitPlan(stock, preset.params), [stock, preset]);
  const sim = plan.simulation;

  return (
    <Card>
      <h3 className="section-title" style={{ fontSize: 16 }}>売り時の目安（出口ルール）</h3>
      <p className="section-sub">
        「いつ売るか」は買った後に考えるものではなく、買う前に決めておくものです。
        将来の売り時を当てるのではなく、自分のルールを先に金額にしておきます。
      </p>

      <div className="chips">
        {EXIT_PRESETS.map((p) => (
          <button key={p.key} className="chip" aria-pressed={presetKey === p.key} onClick={() => setPresetKey(p.key)}>
            {p.label}（+{p.params.takeProfitPct}% / −{p.params.stopLossPct}%）
          </button>
        ))}
      </div>
      <div className="muted" style={{ marginTop: 6 }}>{preset.note}</div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div style={{ background: 'var(--good-bg)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
          <div className="muted" style={{ color: 'var(--good)', fontWeight: 700 }}>利益確定の目安</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{yen(plan.targetPrice)}</div>
          <div className="muted">
            +{plan.params.takeProfitPct}%（1株あたり +{yen(plan.gainPerShare)}）
          </div>
        </div>
        <div style={{ background: 'var(--bad-bg)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
          <div className="muted" style={{ color: 'var(--bad)', fontWeight: 700 }}>損切りの目安</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{yen(plan.stopPrice)}</div>
          <div className="muted">
            −{plan.params.stopLossPct}%（1株あたり −{yen(plan.lossPerShare)}）
          </div>
        </div>
      </div>
      <div className="note" style={{ marginTop: 10 }}>{plan.ruleText}</div>

      <h4 style={{ fontSize: 14.5, margin: '16px 0 6px' }}>売る・見直すきっかけ</h4>
      {plan.reviewTriggers.map((t, i) => (
        <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
          <div className="muted">{t.detail}</div>
        </div>
      ))}

      <h4 style={{ fontSize: 14.5, margin: '16px 0 4px' }}>このルールを過去の値動きに当てはめると</h4>
      <div className="muted" style={{ marginBottom: 8 }}>
        {sim
          ? `${sim.from} 〜 ${sim.to} の間、5営業日おきに「その日に買った」と仮定した ${sim.entries} 回の検証`
          : '検証に必要な期間の株価データが不足しています。'}
      </div>

      {sim && (
        <>
          <div style={{ display: 'flex', height: 18, borderRadius: 999, overflow: 'hidden', background: 'var(--surface-2)' }}>
            <div style={{ width: `${(sim.tookProfit / sim.entries) * 100}%`, background: 'var(--good)' }} />
            <div style={{ width: `${(sim.expired / sim.entries) * 100}%`, background: '#b9c3d0' }} />
            <div style={{ width: `${(sim.stoppedOut / sim.entries) * 100}%`, background: 'var(--bad)' }} />
          </div>
          <table className="table" style={{ marginTop: 8 }}>
            <tbody>
              <tr>
                <td><Pill tone="good">利益確定で終わった</Pill></td>
                <td style={{ fontWeight: 700 }}>{sim.tookProfit}回</td>
                <td className="muted">{Math.round((sim.tookProfit / sim.entries) * 100)}%</td>
              </tr>
              <tr>
                <td><Pill tone="na">期限まで決着せず</Pill></td>
                <td style={{ fontWeight: 700 }}>{sim.expired}回</td>
                <td className="muted">うちプラス {sim.expiredPositive}回</td>
              </tr>
              <tr>
                <td><Pill tone="bad">損切りで終わった</Pill></td>
                <td style={{ fontWeight: 700 }}>{sim.stoppedOut}回</td>
                <td className="muted">{Math.round((sim.stoppedOut / sim.entries) * 100)}%</td>
              </tr>
              <tr>
                <td>1回あたりの平均損益</td>
                <td style={{ fontWeight: 700 }} className={sim.avgReturnPct >= 0 ? 'up' : 'down'}>{pct(sim.avgReturnPct)}</td>
                <td className="muted">最良 {pct(sim.bestPct)} / 最悪 {pct(sim.worstPct)}</td>
              </tr>
              <tr>
                <td>平均の保有期間</td>
                <td style={{ fontWeight: 700 }}>{Math.round(sim.avgHoldDays)}営業日</td>
                <td className="muted">約{(sim.avgHoldDays / 21).toFixed(1)}か月</td>
              </tr>
            </tbody>
          </table>
        </>
      )}
      <div className="note" style={{ marginTop: 10, color: 'var(--bad)' }}>{plan.simulationNote}</div>
    </Card>
  );
}
