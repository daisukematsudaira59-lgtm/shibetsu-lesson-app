import { useState } from 'react';
import { analyze } from '../../analysis';
import type { CategoryScore } from '../../analysis/types';
import { APP_CONFIG } from '../../app/config';
import { PRE_BUY_CHECKLIST } from '../../explain/preBuy';
import { useChecklist } from '../../store/checklist';
import { useFavorites } from '../../store/favorites';
import { useSettings } from '../../store/settings';
import { useStock } from '../useStocks';
import { Bar, Card, fmtPrice, Modal, Pill, Stars, TermButton } from '../components/basics';
import { PriceChart } from '../components/PriceChart';
import { DataStamp, DisclaimerBlock } from '../components/Disclaimer';

const verdictTone = (v: string) =>
  v === 'candidate' ? 'good' : v === 'watch' ? 'ok' : v === 'caution' ? 'watch' : v === 'hurdle' ? 'bad' : 'na';

function Collapsible({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card tight>
      <button
        className="between"
        onClick={() => setOpen(!open)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
        <span className="muted">{open ? '閉じる ▲' : '開く ▼'}</span>
      </button>
      {open && <div style={{ marginTop: 10 }}>{children}</div>}
    </Card>
  );
}

function CategoryDetail({ cat, beginnerMode }: { cat: CategoryScore; beginnerMode: boolean }) {
  return (
    <div>
      <div className="between" style={{ marginBottom: 6 }}>
        <span style={{ fontWeight: 700 }}>{beginnerMode ? cat.plainLabel : cat.label}</span>
        <span style={{ fontWeight: 800 }}>
          {cat.score === null ? '判断材料不足' : `${cat.score} / ${cat.max}点`}
        </span>
      </div>
      <Bar ratio={cat.score === null ? 0 : cat.score / cat.max} />
      <p style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--ink-2)', margin: '10px 0 4px' }}>{cat.comment}</p>
      {cat.metrics.map((m) => (
        <div className="metric" key={m.key}>
          <div className="m-label">
            {m.label}
            {beginnerMode && <TermButton termKey={m.term} />}
            {m.judgement !== 'na' && <Pill tone={m.judgement}>{
              m.judgement === 'good' ? '良い' : m.judgement === 'ok' ? '普通' : m.judgement === 'watch' ? '注意' : '弱い'
            }</Pill>}
            {m.judgement === 'na' && <Pill tone="na">データなし</Pill>}
          </div>
          <div className="m-value">{m.display}</div>
          <div className="m-comment">{m.comment}</div>
        </div>
      ))}
      {cat.coverage < 1 && (
        <div className="muted" style={{ marginTop: 8 }}>
          ※ データが取得できた項目のみで計算しています（取得率 {Math.round(cat.coverage * 100)}%）。
        </div>
      )}
    </div>
  );
}

export function StockDetailScreen({ code, onOpenSettings }: { code: string; onOpenSettings: () => void }) {
  const { stock, loading } = useStock(code);
  const [settings] = useSettings();
  const favorites = useFavorites();
  const checklist = useChecklist(code);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  if (loading) return <div className="screen"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!stock)
    return (
      <div className="screen">
        <Card>銘柄が見つかりませんでした。</Card>
      </div>
    );

  const a = analyze(stock);
  const { total, narrative, priceReference: pr, timing, warnings, preBuy, news, earnings } = a;
  const beginner = settings.beginnerMode;
  const up = stock.quote.changePercent > 0;
  const fiveCats = a.categories.filter((c) => c.key !== 'technical');
  const chartCat = a.categories.find((c) => c.key === 'technical');
  const doneCount = checklist.checked.length;

  return (
    <div className="screen">
      {/* ① 銘柄名・株価・前日比 */}
      <Card>
        <div className="between">
          <div>
            <div className="muted">
              {stock.code}・{stock.market}・{stock.sector}
            </div>
            <h2 style={{ margin: '2px 0 0', fontSize: 23, lineHeight: 1.35 }}>{stock.name}</h2>
          </div>
          <button
            className="btn"
            onClick={() => favorites.toggle(stock.code)}
            aria-pressed={favorites.has(stock.code)}
            style={{ flex: '0 0 auto' }}
          >
            {favorites.has(stock.code) ? '★ 登録済み' : '☆ お気に入り'}
          </button>
        </div>

        <div className="row" style={{ gap: 12, marginTop: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmtPrice(stock.quote.price)}</span>
          <span style={{ fontSize: 15 }}>円</span>
          <span className={up ? 'up' : stock.quote.changePercent === 0 ? '' : 'down'} style={{ fontSize: 16, fontWeight: 700 }}>
            {up ? '+' : ''}
            {stock.quote.change.toFixed(stock.quote.price >= 100 ? 0 : 1)}円（{up ? '+' : ''}
            {stock.quote.changePercent.toFixed(2)}%）
          </span>
        </div>

        <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink-2)', margin: '12px 0 0' }}>
          <strong style={{ color: 'var(--ink)' }}>どんな会社？</strong>
          <br />
          {stock.business}
        </p>
      </Card>

      {/* ② AI総合評価 */}
      <Card>
        <div className="muted">AI総合評価（100点満点）</div>
        <div className="score-hero" style={{ marginTop: 6 }}>
          <div>
            <span className="score-num">{total.score === null ? '—' : total.score}</span>
            <span className="score-max"> / 100点</span>
          </div>
          <div style={{ flex: 1 }}>
            <Stars value={total.stars} />
            <div style={{ marginTop: 4 }}>
              <Pill tone={verdictTone(total.verdict) as never}>{total.verdictLabel}</Pill>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.85, margin: '12px 0 0' }}>{total.headline}</p>
        <div className="note" style={{ marginTop: 12 }}>
          点数が高いほど「調べる価値がある」という意味であり、<strong>必ず儲かるという意味ではありません。</strong>
          点数は公開データを一定のルールで機械的に集計したものです。
        </div>
        {total.crossChecks.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>複数指標の組み合わせチェック</div>
            {total.crossChecks.map((c, i) => (
              <div className="warn" key={i}>
                <div className="w-title">{c.title}</div>
                <div className="w-body">{c.detail}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ③ 一言でいうと */}
      <Card>
        <div className="muted">一言でいうと</div>
        <p style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.6, margin: '4px 0 0' }}>「{narrative.oneLiner}」</p>
      </Card>

      {/* ④ 良いところ / ⑤ 注意点 */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>👍 良いところ</h3>
        {narrative.insufficientNote && <div className="note" style={{ marginBottom: 10 }}>{narrative.insufficientNote}</div>}
        {narrative.goodPoints.length === 0 ? (
          <div className="muted">現時点で「良い」と判定できた項目はありませんでした。</div>
        ) : (
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
            {narrative.goodPoints.map((g, i) => (
              <li key={i} style={{ marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>{g.label}</strong>
                <div className="muted">{g.detail}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>⚠ 注意点</h3>
        <p className="section-sub">色で不安をあおるためではなく、「なぜ注意なのか」を理解するための項目です。</p>
        {warnings.length === 0 && narrative.cautionPoints.length === 0 ? (
          <div className="muted">目立った注意ポイントは検出されませんでした。ただし、リスクがないという意味ではありません。</div>
        ) : (
          warnings.map((w) => (
            <div className={`warn ${w.level}`} key={w.id}>
              <div className="w-title">{w.title}</div>
              <div className="w-body">{w.why}</div>
              <div className="w-todo">
                <strong>確認すること：</strong>
                {w.todo}
              </div>
            </div>
          ))
        )}
      </Card>

      {/* ⑥ 5項目評価 */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>5項目評価</h3>
        <p className="section-sub">1つの指標だけで判断せず、5つの面から見ています。</p>
        {fiveCats.map((c) => (
          <div key={c.key} style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>{beginner ? c.plainLabel : c.label}</span>
              <span className="row" style={{ gap: 8 }}>
                <Stars value={c.stars} size={16} />
                <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 52, textAlign: 'right' }}>
                  {c.score === null ? '材料不足' : `${c.score}/${c.max}`}
                </span>
              </span>
            </div>
          </div>
        ))}
        {chartCat && (
          <div style={{ padding: '10px 0', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <span style={{ fontWeight: 700, fontSize: 14.5 }}>{beginner ? chartCat.plainLabel : chartCat.label}</span>
              <span className="row" style={{ gap: 8 }}>
                <Stars value={chartCat.stars} size={16} />
                <span style={{ fontWeight: 700, fontSize: 13.5, minWidth: 52, textAlign: 'right' }}>
                  {chartCat.score === null ? '材料不足' : `${chartCat.score}/${chartCat.max}`}
                </span>
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* なぜこの評価なのか */}
      <section className="stack" style={{ gap: 10 }}>
        <h3 className="section-title" style={{ fontSize: 16 }}>なぜこの評価なのか</h3>
        <p className="section-sub" style={{ marginTop: -6 }}>
          各項目をタップすると、点数の内訳と判断理由が表示されます。
          {beginner && '「？」ボタンで用語の意味を確認できます。'}
        </p>
        {a.categories.map((c) => (
          <Collapsible
            key={c.key}
            title={`${beginner ? c.plainLabel : c.label}　${c.score === null ? '判断材料不足' : `${c.score}/${c.max}点`}`}
          >
            <CategoryDetail cat={c} beginnerMode={beginner} />
          </Collapsible>
        ))}
      </section>

      {/* ⑦ 今の株価水準 */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>今の株価水準</h3>
        <p className="section-sub">過去の指標をもとにした、分析上の位置づけです。</p>
        {pr.levelPosition === null ? (
          <div className="note">判定に必要なデータが不足しているため、水準を表示していません。</div>
        ) : (
          <>
            <div className="level-bar">
              <span className="marker" style={{ left: `${pr.levelPosition}%` }} />
            </div>
            <div className="level-labels">
              <span>割安</span>
              <span>適正</span>
              <span>割高</span>
            </div>
            <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700 }}>分析上は「{pr.levelLabel}」の位置です</div>
          </>
        )}

        <h4 style={{ fontSize: 14.5, margin: '16px 0 6px' }}>いくらなら買いやすい？（参考レンジ）</h4>
        <table className="table">
          <tbody>
            {pr.bands.map((b) => (
              <tr key={b.key} style={b.key === 'current' ? { background: 'var(--surface-2)' } : undefined}>
                <td style={{ fontWeight: b.key === 'current' ? 700 : 400 }}>{b.label}</td>
                <td style={{ fontWeight: 700 }}>{b.value === null ? 'ー' : `${b.value.toLocaleString()}円`}</td>
                <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                  {b.diffPercent === null ? '' : b.key === 'current' ? '—' : `${b.diffPercent > 0 ? '+' : ''}${b.diffPercent}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {pr.basis.length > 0 && (
          <div className="note" style={{ marginTop: 10 }}>
            <strong>計算の根拠</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {pr.basis.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="note" style={{ marginTop: 10, color: 'var(--bad)' }}>{pr.disclaimer}</div>
      </Card>

      {/* 買い時分析 */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>買い時分析</h3>
        <p style={{ fontSize: 14.5, lineHeight: 1.85, margin: '4px 0 12px' }}>{timing.comment}</p>
        {timing.patterns.map((p) => (
          <div key={p.key} style={{ borderTop: '1px solid var(--line)', paddingTop: 12, marginTop: 12 }}>
            <div className="between">
              <strong style={{ fontSize: 15 }}>{p.label}</strong>
              <Pill tone={p.fit === '検討しやすい' ? 'good' : p.fit === '条件つき' ? 'ok' : 'watch'}>{p.fit}</Pill>
            </div>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div>
                <div className="muted" style={{ fontWeight: 700 }}>メリット</div>
                <ul style={{ margin: '2px 0 0', paddingLeft: 16, fontSize: 13, lineHeight: 1.7 }}>
                  {p.pros.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="muted" style={{ fontWeight: 700 }}>デメリット</div>
                <ul style={{ margin: '2px 0 0', paddingLeft: 16, fontSize: 13, lineHeight: 1.7 }}>
                  {p.cons.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ink-2)', margin: '8px 0 0' }}>{p.comment}</p>
          </div>
        ))}
        <div className="note" style={{ marginTop: 12 }}>{timing.disclaimer}</div>
      </Card>

      {/* この株を買うなら何を見る？ */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>この株を買う前に確認する5項目</h3>
        {preBuy.points.map((p) => (
          <div key={p.id} style={{ borderTop: '1px solid var(--line)', padding: '11px 0' }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.label}</div>
            <div style={{ fontSize: 14, margin: '2px 0 4px' }}>{p.value}</div>
            <div className="muted">{p.why}</div>
          </div>
        ))}
        <div className="note" style={{ marginTop: 12 }}>
          <strong>現在の株価水準で注意すべきポイント</strong>
          <div style={{ marginTop: 4 }}>{preBuy.priceLevelNote}</div>
        </div>
      </Card>

      {/* ⑧ 初心者向け解説（3行まとめ） */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>初心者向け3行まとめ</h3>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 6 }}>
          <div style={{ fontWeight: 700, color: 'var(--good)' }}>① 良いところ</div>
          <p style={{ margin: '2px 0 12px', fontSize: 14.5, lineHeight: 1.85 }}>{narrative.threeLines.good}</p>
          <div style={{ fontWeight: 700, color: 'var(--watch)' }}>② 悪いところ</div>
          <p style={{ margin: '2px 0 12px', fontSize: 14.5, lineHeight: 1.85 }}>{narrative.threeLines.bad}</p>
          <div style={{ fontWeight: 700, color: 'var(--bad)' }}>③ 注意点</div>
          <p style={{ margin: '2px 0 0', fontSize: 14.5, lineHeight: 1.85 }}>{narrative.threeLines.caution}</p>
        </div>
      </Card>

      {beginner && (
        <Card>
          <h3 className="section-title" style={{ fontSize: 16 }}>もう少しくわしい解説</h3>
          {narrative.beginnerRead.map((t, i) => (
            <p key={i} style={{ fontSize: 14, lineHeight: 1.9, margin: '0 0 10px', color: 'var(--ink-2)' }}>
              {t}
            </p>
          ))}
          <button className="btn block" onClick={onOpenSettings}>
            初心者モードの設定を変更する
          </button>
        </Card>
      )}

      {/* ⑨ 最新ニュース */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>最新ニュース</h3>
        <p className="section-sub">見出しから株価への影響を機械的に分類し、初心者向けに言い換えています。</p>
        {news.length === 0 ? (
          <div className="muted">ニュースを取得できませんでした。</div>
        ) : (
          news.map((n) => (
            <div key={n.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Pill tone={n.impact === 'positive' ? 'good' : n.impact === 'negative' ? 'bad' : n.impact === 'neutral' ? 'ok' : 'na'}>
                  {n.impactLabel}
                </Pill>
                <span className="muted">
                  {new Date(n.publishedAt).toLocaleDateString('ja-JP')}・{n.source}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14.5, margin: '5px 0 4px' }}>{n.title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--ink-2)' }}>{n.plain}</div>
              <div className="muted" style={{ marginTop: 4 }}>判断の根拠：{n.basis}</div>
            </div>
          ))
        )}
      </Card>

      {/* ⑩ 決算 */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>直近の決算</h3>
        {!earnings ? (
          <div className="muted">決算データを取得できていません。</div>
        ) : (
          <>
            <div className="between" style={{ marginBottom: 8 }}>
              <span className="muted">{stock.latestEarnings?.period}</span>
              <Pill
                tone={
                  earnings.verdict === 'good'
                    ? 'good'
                    : earnings.verdict === 'fair'
                      ? 'ok'
                      : earnings.verdict === 'caution'
                        ? 'watch'
                        : earnings.verdict === 'bad'
                          ? 'bad'
                          : 'na'
                }
              >
                決算評価：{earnings.label}
              </Pill>
            </div>
            <table className="table">
              <tbody>
                {earnings.rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td style={{ fontWeight: 700 }}>{r.value}</td>
                    <td className="muted">{r.sub ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>なぜこの評価か</div>
              <ol style={{ margin: '4px 0 0', paddingLeft: 20, fontSize: 13.5, lineHeight: 1.85 }}>
                {earnings.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </div>
            <div className="note" style={{ marginTop: 10 }}>{earnings.note}</div>
          </>
        )}
      </Card>

      {/* ⑪ チャート */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>チャート</h3>
        <PriceChart history={stock.history} />
        {a.technical && (
          <div className="note" style={{ marginTop: 10 }}>
            52週高値 {Math.round(a.technical.high52w).toLocaleString()}円 / 安値{' '}
            {Math.round(a.technical.low52w).toLocaleString()}円。現在はレンジの
            {a.technical.positionInRange.toFixed(0)}%の位置です。
          </div>
        )}
      </Card>

      {/* 買う前チェックリスト */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>
          買う前のチェックリスト（{doneCount}/{PRE_BUY_CHECKLIST.length}）
        </h3>
        <p className="section-sub">全部にチェックが付いてから判断しても遅くありません。</p>
        {PRE_BUY_CHECKLIST.map((item) => {
          const on = checklist.checked.includes(item.id);
          return (
            <button key={item.id} className="check" aria-pressed={on} onClick={() => checklist.toggle(item.id)}>
              <span className="box">{on ? '✓' : ''}</span>
              <span>
                <span className="c-label">{item.label}</span>
                <span className="c-hint" style={{ display: 'block' }}>
                  {item.hint}
                </span>
              </span>
            </button>
          );
        })}
        {doneCount > 0 && (
          <button className="btn block" style={{ marginTop: 12 }} onClick={checklist.reset}>
            チェックをリセット
          </button>
        )}
      </Card>

      {/* ⑫ SBI証券で確認 */}
      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>{APP_CONFIG.broker.name}で確認する</h3>
        <p className="section-sub">{APP_CONFIG.broker.note}</p>
        <div className="stack">
          <a
            className="btn primary block"
            href={APP_CONFIG.broker.searchUrl(stock.code, stock.name)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {stock.code} {stock.name} を{APP_CONFIG.broker.name}で調べる ↗
          </a>
          <a className="btn block" href={APP_CONFIG.broker.siteUrl} target="_blank" rel="noopener noreferrer">
            {APP_CONFIG.broker.name}のサイトを開く ↗
          </a>
        </div>
        <div className="note" style={{ marginTop: 12 }}>
          単元株数は{stock.tradingUnit}株です。S株（単元未満株）を使うと1株から購入できるため、
          {fmtPrice(stock.quote.price)}円程度から投資できます（手数料・取扱条件は証券会社の説明を確認してください）。
        </div>
      </Card>

      <DataStamp meta={stock.meta} />
      <button className="btn block" onClick={() => setShowDisclaimer(true)}>
        免責事項・このアプリについて
      </button>
      {showDisclaimer && (
        <Modal title="ご利用にあたって" onClose={() => setShowDisclaimer(false)}>
          <DisclaimerBlock />
        </Modal>
      )}
    </div>
  );
}
