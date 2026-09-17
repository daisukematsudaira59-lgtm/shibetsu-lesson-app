import { useMemo, useState } from 'react';
import { buildBudgetPicks, buildBudgetPlans, type BudgetStyle } from '../../analysis/screening';
import { budgetGuidance, FUND_CHECKPOINTS, FUND_NOTES, STOCK_VS_FUND } from '../../explain/funds';
import { useSettings } from '../../store/settings';
import { useAllStocks } from '../useStocks';
import { Card, Pill, TermButton } from '../components/basics';
import { StockRow } from '../components/StockRow';

const PRESETS = [10000, 50000, 100000, 170000, 300000];

const STYLE_NOTE: Record<BudgetStyle, string> = {
  成長型: '売上・利益の伸びが期待される銘柄です。値動きは大きくなりやすい傾向があります。',
  配当型: '配当を受け取ることが主なリターンになる銘柄です。',
  安定型: '財務が安定しており、値動きが比較的落ち着いている銘柄です。',
  割安型: '株価指標が過去や平均と比べて控えめな銘柄です。安い理由の確認が必要です。',
};

const yen = (v: number) => `${v.toLocaleString()}円`;

export function BudgetScreen({ onOpen }: { onOpen: (code: string) => void }) {
  const { stocks, loading } = useAllStocks();
  const [settings, update] = useSettings();
  const budget = settings.budget;
  const setBudget = (v: number) => update({ budget: Math.max(1000, v) });
  const [style, setStyle] = useState<BudgetStyle | 'すべて'>('すべて');
  const [openPlan, setOpenPlan] = useState<string | null>('diversified');
  const [tab, setTab] = useState<'plans' | 'list' | 'funds'>('plans');

  const plans = useMemo(() => (stocks ? buildBudgetPlans(stocks, budget) : []), [stocks, budget]);
  const picks = useMemo(() => (stocks ? buildBudgetPicks(stocks, budget) : []), [stocks, budget]);
  const filtered = picks.filter((p) => style === 'すべて' || p.style === style);

  return (
    <div className="screen">
      <Card>
        <h2 style={{ margin: 0, fontSize: 20 }}>予算から考える</h2>
        <p className="section-sub" style={{ margin: '4px 0 10px' }}>
          SBI証券のS株（単元未満株）なら1株から買えます。予算をどう分けるかを、実際の株数で確かめられます。
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
          onChange={(e) => setBudget(Number(e.target.value) || 0)}
          style={{ marginTop: 6 }}
        />
        <div className="chips" style={{ marginTop: 10 }}>
          {PRESETS.map((p) => (
            <button key={p} className="chip" aria-pressed={budget === p} onClick={() => setBudget(p)}>
              {p.toLocaleString()}円
            </button>
          ))}
        </div>
        <div className="note" style={{ marginTop: 12 }}>
          {budgetGuidance(budget).map((t, i) => (
            <div key={i}>{t}</div>
          ))}
        </div>
      </Card>

      <div className="chips">
        <button className="chip" aria-pressed={tab === 'plans'} onClick={() => setTab('plans')}>
          分け方の例
        </button>
        <button className="chip" aria-pressed={tab === 'list'} onClick={() => setTab('list')}>
          1銘柄ずつ見る
        </button>
        <button className="chip" aria-pressed={tab === 'funds'} onClick={() => setTab('funds')}>
          投資信託という選択肢
        </button>
      </div>

      {loading && <div className="skeleton" />}

      {tab === 'plans' && (
        <>
          <div className="note">
            以下は「買うべき銘柄」ではなく、<strong>{yen(budget)}をどう分けるかの例</strong>です。
            スコアの高い順に機械的に組み合わせています。気になる銘柄はタップして、注意点まで読んでから判断してください。
          </div>
          {plans.map((plan) => {
            const open = openPlan === plan.key;
            return (
              <Card key={plan.key} tight>
                <button
                  className="between"
                  onClick={() => setOpenPlan(open ? null : plan.key)}
                  style={{ width: '100%', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span>
                    <span style={{ fontWeight: 700, fontSize: 15.5 }}>{plan.title}</span>
                    <span className="muted" style={{ display: 'block' }}>
                      {plan.lines.length}銘柄・合計 {yen(plan.total)}
                      {plan.annualDividend > 0 ? `・年間配当の目安 ${yen(plan.annualDividend)}` : ''}
                    </span>
                  </span>
                  <span className="muted">{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--ink-2)', margin: '0 0 10px' }}>{plan.description}</p>
                    {plan.lines.length === 0 ? (
                      <div className="muted">この予算では条件に合う組み合わせが作れませんでした。</div>
                    ) : (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>銘柄</th>
                            <th>株数</th>
                            <th>金額</th>
                            <th>割合</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.lines.map((l) => (
                            <tr key={l.analysis.stock.code} onClick={() => onOpen(l.analysis.stock.code)} style={{ cursor: 'pointer' }}>
                              <td>
                                <div style={{ fontWeight: 700 }}>{l.analysis.stock.name}</div>
                                <div className="row" style={{ gap: 6 }}>
                                  <Pill tone="brand">{l.style}</Pill>
                                  <span className="muted">AI {l.analysis.total.score}点</span>
                                </div>
                              </td>
                              <td style={{ fontWeight: 700 }}>{l.shares}株</td>
                              <td>{yen(l.cost)}</td>
                              <td className="muted">{l.weightPct}%</td>
                            </tr>
                          ))}
                          <tr>
                            <td style={{ fontWeight: 700 }}>合計</td>
                            <td />
                            <td style={{ fontWeight: 700 }}>{yen(plan.total)}</td>
                            <td className="muted">残り {yen(plan.remaining)}</td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                    {plan.annualDividend > 0 && (
                      <div className="note" style={{ marginTop: 10 }}>
                        年間配当の目安 <strong>{yen(plan.annualDividend)}</strong>（株数 × 会社予想の1株配当。税引前。減配されれば減ります）
                      </div>
                    )}
                    {plan.warnings.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        {plan.warnings.map((w, i) => (
                          <div className="warn" key={i} style={{ marginBottom: 8 }}>
                            <div className="w-body">{w}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="muted" style={{ marginTop: 8 }}>選び方：{plan.criteria}</div>
                  </div>
                )}
              </Card>
            );
          })}
          <div className="note">
            どのプランも「一度に全額を買う」前提ではありません。何回かに分けて買う、まず半分だけ買う、といった方法も検討してください。
            売り時の目安は各銘柄の分析画面「売り時の目安」で確認できます。
          </div>
        </>
      )}

      {tab === 'list' && (
        <>
          <div className="chips">
            {(['すべて', '成長型', '配当型', '安定型', '割安型'] as const).map((s) => (
              <button key={s} className="chip" aria-pressed={style === s} onClick={() => setStyle(s)}>
                {s}
              </button>
            ))}
          </div>
          {!loading && filtered.length === 0 && (
            <Card>
              <div className="muted">この予算で買える銘柄が見つかりませんでした。予算を増やすか、条件を変えてお試しください。</div>
            </Card>
          )}
          <div>
            {filtered.map((p) => (
              <div key={p.analysis.stock.code} style={{ marginBottom: 10 }}>
                <StockRow
                  analysis={p.analysis}
                  badge={p.style}
                  reason={`予算 ${yen(budget)}で ${p.shares}株（約 ${yen(p.cost)}）購入できます。${STYLE_NOTE[p.style]}`}
                  onOpen={onOpen}
                />
              </div>
            ))}
          </div>
          <div className="note">
            表示している株数は「予算 ÷ 現在株価」で計算した目安です。実際には手数料・約定価格の変動により購入できる株数は変わります。
          </div>
        </>
      )}

      {tab === 'funds' && (
        <>
          <Card>
            <h3 className="section-title" style={{ fontSize: 16 }}>株と投資信託、どちらから始める？</h3>
            <p className="section-sub">個別株にこだわる必要はありません。違いを知ったうえで選んでください。</p>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th />
                    <th style={{ textAlign: 'left' }}>個別株</th>
                    <th style={{ textAlign: 'left' }}>投資信託</th>
                  </tr>
                </thead>
                <tbody>
                  {STOCK_VS_FUND.map((r) => (
                    <tr key={r.item}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.item}</td>
                      <td style={{ textAlign: 'left' }}>{r.stock}</td>
                      <td style={{ textAlign: 'left' }}>{r.fund}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className="section-title" style={{ fontSize: 16 }}>投資信託を選ぶときの確認5項目</h3>
            {FUND_CHECKPOINTS.map((c, i) => (
              <div key={i} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {i + 1}. {c.title}
                </div>
                <div className="muted">{c.detail}</div>
              </div>
            ))}
          </Card>

          <div className="note">
            {FUND_NOTES.map((t, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                ・{t}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="note">
        <Pill tone="watch">注意</Pill> 少額でも投資である以上、元本割れの可能性があります。生活に必要な資金は使わないでください。
      </div>
    </div>
  );
}
