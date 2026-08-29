import { APP_CONFIG } from '../../app/config';
import type { DataMeta } from '../../types/stock';

const fmt = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** データ取得時点と鮮度の警告（要件28） */
export function DataStamp({ meta }: { meta: DataMeta }) {
  const ageHours = (Date.now() - new Date(meta.asOf).getTime()) / 3600000;
  const stale = ageHours > 24;
  return (
    <div className="note">
      <div>
        <strong>データ取得時点：</strong>
        {fmt(meta.asOf)}（提供元：{meta.sourceName}）
      </div>
      {stale && (
        <div style={{ color: 'var(--bad)', marginTop: 4 }}>
          ⚠ 取得から{Math.floor(ageHours)}時間以上経過しています。最新の状況と異なる可能性があります。
        </div>
      )}
      {meta.notice && <div style={{ marginTop: 4 }}>{meta.notice}</div>}
    </div>
  );
}

export function DisclaimerBlock() {
  return (
    <div className="note">
      <strong>ご利用にあたって</strong>
      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
        {APP_CONFIG.disclaimer.full.map((t, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DemoBanner({ meta }: { meta: DataMeta }) {
  if (!meta.isDemo) return null;
  return (
    <div className="demo-banner">
      <span aria-hidden="true">⚠</span>
      <span>
        <strong>デモ表示中：</strong>
        画面上の株価・財務数値はすべて<strong>UI確認用のサンプル</strong>で、実在企業の実際の数値ではありません。投資判断には使用できません。
      </span>
    </div>
  );
}
