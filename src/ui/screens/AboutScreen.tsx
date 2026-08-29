import { APP_CONFIG } from '../../app/config';
import { provider } from '../../data';
import { GLOSSARY } from '../../explain/glossary';
import { useSettings } from '../../store/settings';
import { Card } from '../components/basics';
import { DataStamp, DisclaimerBlock } from '../components/Disclaimer';

export function AboutScreen() {
  const [settings, update] = useSettings();

  return (
    <div className="screen">
      <Card>
        <h2 style={{ margin: 0, fontSize: 20 }}>設定</h2>
        <div className="between" style={{ marginTop: 14, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>初心者モード</div>
            <div className="muted">専門用語に「？」ボタンを付け、解説を厚く表示します。</div>
          </div>
          <button
            className={`btn ${settings.beginnerMode ? 'primary' : ''}`}
            onClick={() => update({ beginnerMode: !settings.beginnerMode })}
            aria-pressed={settings.beginnerMode}
          >
            {settings.beginnerMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>このアプリについて</h3>
        <p style={{ fontSize: 14, lineHeight: 1.85, color: 'var(--ink-2)' }}>
          {APP_CONFIG.name}（{APP_CONFIG.subtitle}）は、「株価を見るアプリ」ではなく
          「株を理解するアプリ」を目指した分析ツールです。銘柄を入力すると、その会社が何をしている会社か、
          業績・財務・株価水準・配当・注意点を3分で把握できることを目標にしています。
        </p>
        <div className="muted">バージョン {APP_CONFIG.version}</div>
      </Card>

      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>データについて</h3>
        <DataStamp meta={provider.meta} />
        <p style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--ink-2)', marginBottom: 0 }}>
          現在は<strong>デモ用のサンプルデータ</strong>で動作しています。実データを接続する際は、
          提供元・利用規約・商用利用可否・再配布可否・更新頻度・リアルタイム性・料金を確認したうえで、
          データ取得層（<code>src/data</code>）のみを差し替える構成にしています。
          分析ロジック・解説文の生成・UIはデータ提供元に依存していません。
        </p>
      </Card>

      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>{APP_CONFIG.broker.name}との関係</h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.85, color: 'var(--ink-2)', margin: 0 }}>
          {APP_CONFIG.broker.note}
          <br />
          本アプリは「SBI証券 株アプリ」や「HYPER SBI 2」の代替ではなく、
          初心者が銘柄を理解するための<strong>分析・学習支援</strong>に特化しています。
          注文は必ずご自身で証券会社の画面から行ってください。
        </p>
      </Card>

      <Card>
        <h3 className="section-title" style={{ fontSize: 16 }}>用語集</h3>
        <p className="section-sub">分析画面の「？」ボタンでも同じ説明を確認できます。</p>
        {Object.values(GLOSSARY).map((t) => (
          <details key={t.key} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
            <summary style={{ fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>{t.label}</summary>
            <p style={{ fontSize: 14, margin: '6px 0 4px' }}>{t.short}</p>
            <p style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--ink-2)', margin: 0 }}>{t.detail}</p>
            {t.guide && <div className="note" style={{ marginTop: 6 }}>目安：{t.guide}</div>}
          </details>
        ))}
      </Card>

      <DisclaimerBlock />
    </div>
  );
}
