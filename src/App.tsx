import { useCallback, useEffect, useState } from 'react';
import { APP_CONFIG } from './app/config';
import { provider } from './data';
import { useSettings } from './store/settings';
import { DemoBanner, DisclaimerBlock } from './ui/components/Disclaimer';
import { Modal } from './ui/components/basics';
import { AboutScreen } from './ui/screens/AboutScreen';
import { BudgetScreen } from './ui/screens/BudgetScreen';
import { FavoritesScreen } from './ui/screens/FavoritesScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { RankingScreen } from './ui/screens/RankingScreen';
import { SearchScreen } from './ui/screens/SearchScreen';
import { StockDetailScreen } from './ui/screens/StockDetailScreen';

type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'ranking' }
  | { name: 'budget' }
  | { name: 'favorites' }
  | { name: 'about' }
  | { name: 'stock'; code: string };

const TABS = [
  { name: 'home', label: 'ホーム', icon: '🏠' },
  { name: 'search', label: 'さがす', icon: '🔍' },
  { name: 'ranking', label: 'ランキング', icon: '📊' },
  { name: 'budget', label: '予算別', icon: '💴' },
  { name: 'favorites', label: 'お気に入り', icon: '★' },
] as const;

function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (h.startsWith('stock/')) return { name: 'stock', code: h.slice(6) };
  const known = ['home', 'search', 'ranking', 'budget', 'favorites', 'about'] as const;
  const hit = known.find((k) => k === h);
  return hit ? ({ name: hit } as Route) : { name: 'home' };
}

const TITLES: Record<Route['name'], string> = {
  home: APP_CONFIG.name,
  search: '銘柄をさがす',
  ranking: 'ランキング',
  budget: '少額投資モード',
  favorites: 'お気に入り',
  about: '設定・このアプリについて',
  stock: '銘柄分析',
};

export default function App() {
  const [route, setRoute] = useState<Route>(parseHash);
  const [settings, update] = useSettings();
  const [showGate, setShowGate] = useState(!settings.disclaimerAccepted);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = useCallback((path: string) => {
    window.location.hash = `#/${path}`;
  }, []);

  const openStock = useCallback((code: string) => go(`stock/${code}`), [go]);
  const isTop = route.name !== 'stock';

  return (
    <div className="app">
      <header className="appbar">
        {!isTop && (
          <button className="back" onClick={() => window.history.back()} aria-label="戻る">
            ‹
          </button>
        )}
        <div>
          <h1>{TITLES[route.name]}</h1>
          {route.name === 'home' && <p className="sub">{APP_CONFIG.subtitle}</p>}
        </div>
        <span className="spacer" />
        <button
          className={settings.beginnerMode ? 'on' : ''}
          onClick={() => update({ beginnerMode: !settings.beginnerMode })}
          aria-pressed={settings.beginnerMode}
          title="専門用語を減らし、解説を厚く表示します"
        >
          初心者モード {settings.beginnerMode ? 'ON' : 'OFF'}
        </button>
        <button onClick={() => go('about')} aria-label="設定">
          ⚙
        </button>
      </header>

      <DemoBanner meta={provider.meta} />

      {route.name === 'home' && <HomeScreen onOpen={openStock} onSearch={() => go('search')} />}
      {route.name === 'search' && <SearchScreen onOpen={openStock} />}
      {route.name === 'ranking' && <RankingScreen onOpen={openStock} />}
      {route.name === 'budget' && <BudgetScreen onOpen={openStock} />}
      {route.name === 'favorites' && <FavoritesScreen onOpen={openStock} onSearch={() => go('search')} />}
      {route.name === 'about' && <AboutScreen />}
      {route.name === 'stock' && <StockDetailScreen code={route.code} onOpenSettings={() => go('about')} />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.name}
            onClick={() => go(t.name)}
            aria-current={route.name === t.name}
          >
            <span className="ico">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {showGate && (
        <Modal
          title="はじめにお読みください"
          onClose={() => {
            update({ disclaimerAccepted: true });
            setShowGate(false);
          }}
        >
          <div className="note" style={{ marginBottom: 12, background: 'var(--bad-bg)', color: 'var(--bad)' }}>
            <strong>現在はデモ表示です。</strong>
            <br />
            画面上の株価・財務数値はすべてUI確認用のサンプルであり、実在企業の実際の数値ではありません。
          </div>
          <DisclaimerBlock />
          <button
            className="btn primary block"
            style={{ marginTop: 14 }}
            onClick={() => {
              update({ disclaimerAccepted: true });
              setShowGate(false);
            }}
          >
            内容を理解しました
          </button>
        </Modal>
      )}
    </div>
  );
}
