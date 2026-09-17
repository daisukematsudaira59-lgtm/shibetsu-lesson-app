#!/usr/bin/env node
/**
 * J-Quants API から実データを取得し、アプリが読む形（src/types/stock.ts の Stock）に
 * 正規化して src/data/snapshot/stocks.json に書き出す。
 *
 * 使い方:
 *   JQUANTS_REFRESH_TOKEN=xxxx npm run fetch-data
 *   （.env に JQUANTS_REFRESH_TOKEN=xxxx と書いておいても可）
 *
 * このスクリプトは利用者のパソコンで実行する想定。トークンはネットワーク越しに
 * J-Quants 以外へ送られない。出力 JSON にトークンは含まれない。
 *
 * J-Quants 利用規約・料金・無料プランの制限（株価は12週遅延、財務は2年分）は
 * https://jpx-jquants.com/ で必ず確認すること（要件23）。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/data/snapshot/stocks.json');
const BASE = 'https://api.jquants.com/v1';

const args = process.argv.slice(2);
const fixtureMode = args.includes('--fixture');

// ---------- 設定 ----------
async function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  const text = await readFile(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------- API ----------
async function api(pathname, idToken, params = {}) {
  const url = new URL(BASE + pathname);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: idToken ? { Authorization: `Bearer ${idToken}` } : {} });
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchAllPages(pathname, idToken, params, key) {
  let out = [];
  let pagination;
  do {
    const json = await api(pathname, idToken, { ...params, pagination_key: pagination });
    out = out.concat(json[key] ?? []);
    pagination = json.pagination_key;
  } while (pagination);
  return out;
}

async function getIdToken(refreshToken) {
  const res = await fetch(`${BASE}/token/auth_refresh?refreshtoken=${encodeURIComponent(refreshToken)}`, { method: 'POST' });
  if (!res.ok) throw new Error(`auth_refresh -> HTTP ${res.status}: ${await res.text()}`);
  return (await res.json()).idToken;
}

async function fetchRaw(code5, idToken) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 420);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const [info, quotes, statements] = await Promise.all([
    api('/listed/info', idToken, { code: code5 }).then((j) => j.info?.[0]),
    fetchAllPages('/prices/daily_quotes', idToken, { code: code5, from: fmt(from), to: fmt(to) }, 'daily_quotes'),
    fetchAllPages('/fins/statements', idToken, { code: code5 }, 'statements'),
  ]);
  return { info, quotes, statements };
}

// ---------- 正規化 ----------
const num = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const mil = (v) => {
  const n = num(v);
  return n === undefined ? undefined : Math.round(n / 1e6);
};
const round = (v, d = 2) => (v === undefined ? undefined : Math.round(v * 10 ** d) / 10 ** d);
const pctOf = (a, b) => (a !== undefined && b !== undefined && b !== 0 ? round((a / b) * 100, 1) : undefined);
const yoy = (cur, prev) => (cur !== undefined && prev !== undefined && prev > 0 ? round(((cur - prev) / prev) * 100, 1) : undefined);

function fiscalLabel(endDate) {
  if (!endDate) return '不明';
  const [y, m] = endDate.split('-');
  return `${y}/${Number(m)}期`;
}

export function normalize(code4, raw, fetchedAt) {
  const { info, quotes, statements } = raw;
  const history = quotes
    .filter((q) => num(q.AdjustmentClose ?? q.Close) !== undefined)
    .sort((a, b) => (a.Date < b.Date ? -1 : 1))
    .map((q) => ({
      date: q.Date,
      open: num(q.AdjustmentOpen ?? q.Open),
      high: num(q.AdjustmentHigh ?? q.High),
      low: num(q.AdjustmentLow ?? q.Low),
      close: num(q.AdjustmentClose ?? q.Close),
      volume: num(q.AdjustmentVolume ?? q.Volume) ?? 0,
    }));
  if (history.length < 2) throw new Error(`${code4}: 株価データが不足しています（${history.length}件）`);

  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const price = last.close;
  const closes = history.map((p) => p.close);
  const w52 = closes.slice(-250);

  // 通期実績（FY）を古い順に
  const fys = statements
    .filter((s) => s.TypeOfCurrentPeriod === 'FY')
    .sort((a, b) => (a.CurrentFiscalYearEndDate < b.CurrentFiscalYearEndDate ? -1 : 1));
  // 同じ決算期の訂正開示は最後のものを採用
  const fyMap = new Map();
  for (const s of fys) fyMap.set(s.CurrentFiscalYearEndDate, s);
  const fyList = [...fyMap.values()].slice(-4);

  const latestStmt = [...statements].sort((a, b) => (a.DisclosedDate < b.DisclosedDate ? 1 : -1))[0];

  const fiscal = fyList.map((s) => ({
    label: fiscalLabel(s.CurrentFiscalYearEndDate),
    revenue: mil(s.NetSales),
    operatingIncome: mil(s.OperatingProfit),
    netIncome: mil(s.Profit),
    eps: num(s.EarningsPerShare),
    bps: num(s.BookValuePerShare),
    dividendPerShare: num(s.ResultDividendPerShareAnnual),
    isForecast: false,
  }));
  if (latestStmt && (num(latestStmt.ForecastNetSales) !== undefined || num(latestStmt.ForecastEarningsPerShare) !== undefined)) {
    const fyEnd = latestStmt.CurrentFiscalYearEndDate;
    fiscal.push({
      label: `${fiscalLabel(fyEnd)}(会社予想)`,
      revenue: mil(latestStmt.ForecastNetSales),
      operatingIncome: mil(latestStmt.ForecastOperatingProfit),
      netIncome: mil(latestStmt.ForecastProfit),
      eps: num(latestStmt.ForecastEarningsPerShare),
      bps: fiscal[fiscal.length - 1]?.bps,
      dividendPerShare: num(latestStmt.ForecastDividendPerShareAnnual),
      isForecast: true,
    });
  }

  const lastFy = fyList[fyList.length - 1];
  const prevFy = fyList[fyList.length - 2];
  const equity = num(lastFy?.Equity);
  const totalAssets = num(lastFy?.TotalAssets);
  const profit = num(lastFy?.Profit);
  const equityRatioRaw = num(lastFy?.EquityToAssetRatio);
  const financials = {
    equityRatio: equityRatioRaw === undefined ? undefined : round(equityRatioRaw <= 1 ? equityRatioRaw * 100 : equityRatioRaw, 1),
    interestBearingDebt: undefined, // J-Quants の財務データには含まれない
    cash: mil(lastFy?.CashAndEquivalents),
    operatingCF: mil(lastFy?.CashFlowsFromOperatingActivities),
    operatingCFPrev: mil(prevFy?.CashFlowsFromOperatingActivities),
    investingCF: mil(lastFy?.CashFlowsFromInvestingActivities),
    financingCF: mil(lastFy?.CashFlowsFromFinancingActivities),
    roe: pctOf(profit, equity),
    roa: pctOf(profit, totalAssets),
    operatingMargin: pctOf(num(lastFy?.OperatingProfit), num(lastFy?.NetSales)),
  };

  // 過去平均PER/PBR：各決算期末時点の株価 ÷ その期のEPS/BPS（取得できる期のみ）
  const perSamples = [];
  const pbrSamples = [];
  for (const s of fyList) {
    const end = s.CurrentFiscalYearEndDate;
    const at = [...history].reverse().find((p) => p.date <= end);
    if (!at) continue;
    const eps = num(s.EarningsPerShare);
    const bps = num(s.BookValuePerShare);
    if (eps && eps > 0) perSamples.push(at.close / eps);
    if (bps && bps > 0) pbrSamples.push(at.close / bps);
  }
  const avg = (a) => (a.length >= 2 ? round(a.reduce((x, y) => x + y, 0) / a.length, 2) : undefined);

  const forecast = fiscal.find((f) => f.isForecast);
  const latestActual = [...fiscal].reverse().find((f) => !f.isForecast);
  const shares = num(lastFy?.NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock);
  const marketCapOku = shares ? Math.round((price * shares) / 1e8) : undefined;
  const dps = forecast?.dividendPerShare ?? latestActual?.dividendPerShare;
  const revenueForPsr = forecast?.revenue ?? latestActual?.revenue;

  const valuation = {
    per: latestActual?.eps > 0 ? round(price / latestActual.eps, 1) : undefined,
    forwardPer: forecast?.eps > 0 ? round(price / forecast.eps, 1) : undefined,
    perAvg5y: avg(perSamples),
    pbr: latestActual?.bps > 0 ? round(price / latestActual.bps, 2) : undefined,
    pbrAvg5y: avg(pbrSamples),
    psr: shares && revenueForPsr ? round((price * shares) / 1e6 / revenueForPsr, 2) : undefined,
    dividendYield: dps !== undefined && dps > 0 ? round((dps / price) * 100, 2) : undefined,
  };

  const dpsHistory = fiscal.filter((f) => !f.isForecast).map((f) => f.dividendPerShare).filter((v) => v !== undefined);
  let streak = 0;
  for (let i = dpsHistory.length - 1; i > 0; i--) {
    if (dpsHistory[i] > dpsHistory[i - 1]) streak++;
    else break;
  }
  const hasCut = dpsHistory.some((v, i) => i > 0 && v < dpsHistory[i - 1]);
  const epsForPayout = forecast?.eps ?? latestActual?.eps;
  const dividend = {
    yield: valuation.dividendYield,
    perShare: dps,
    payoutRatio: dps !== undefined && epsForPayout > 0 ? round((dps / epsForPayout) * 100, 1) : undefined,
    consecutiveIncreaseYears: dpsHistory.length >= 2 ? streak : undefined,
    hasCutHistory: dpsHistory.length >= 2 ? hasCut : undefined,
    historyPerShare: dpsHistory.length ? dpsHistory : undefined,
  };

  // 直近決算（四半期）と前年同期比
  let latestEarnings;
  if (latestStmt) {
    const period = latestStmt.TypeOfCurrentPeriod;
    const yearAgo = statements
      .filter((s) => s.TypeOfCurrentPeriod === period && s.CurrentFiscalYearEndDate < latestStmt.CurrentFiscalYearEndDate)
      .sort((a, b) => (a.CurrentFiscalYearEndDate < b.CurrentFiscalYearEndDate ? 1 : -1))[0];
    const prevDisclosure = statements
      .filter((s) => s.DisclosedDate < latestStmt.DisclosedDate)
      .sort((a, b) => (a.DisclosedDate < b.DisclosedDate ? 1 : -1))[0];
    const fp = num(latestStmt.ForecastProfit);
    const pp = num(prevDisclosure?.ForecastProfit);
    const guidanceRevision =
      fp === undefined || pp === undefined ? 'unknown' : fp > pp * 1.005 ? 'up' : fp < pp * 0.995 ? 'down' : 'none';
    const periodLabel = { '1Q': '第1四半期', '2Q': '第2四半期', '3Q': '第3四半期', FY: '通期' }[period] ?? period;
    latestEarnings = {
      period: `${fiscalLabel(latestStmt.CurrentFiscalYearEndDate)} ${periodLabel}`,
      announcedAt: latestStmt.DisclosedDate,
      revenue: mil(latestStmt.NetSales),
      operatingIncome: mil(latestStmt.OperatingProfit),
      netIncome: mil(latestStmt.Profit),
      revenueYoY: yoy(num(latestStmt.NetSales), num(yearAgo?.NetSales)),
      operatingIncomeYoY: yoy(num(latestStmt.OperatingProfit), num(yearAgo?.OperatingProfit)),
      netIncomeYoY: yoy(num(latestStmt.Profit), num(yearAgo?.Profit)),
      progressRate: pctOf(num(latestStmt.Profit), fp),
      guidanceRevision,
      vsConsensus: undefined,
    };
  }

  const sizeClass = marketCapOku === undefined ? 'mid' : marketCapOku >= 10000 ? 'large' : marketCapOku >= 1000 ? 'mid' : 'small';

  return {
    code: code4,
    name: info?.CompanyName ?? code4,
    aliases: [info?.CompanyNameEnglish].filter(Boolean),
    sector: info?.Sector33CodeName ?? '不明',
    market: (info?.MarketCodeName ?? '').replace('（内国株式）', '') || '不明',
    business: '事業内容の説明データは未接続です。証券会社のページで「企業情報」を確認してください。',
    tags: [info?.Sector33CodeName, sizeClass === 'large' ? '大型株' : sizeClass === 'mid' ? '中型株' : '小型株'].filter(Boolean),
    sizeClass,
    tradingUnit: 100,
    quote: {
      price,
      previousClose: prev.close,
      change: round(price - prev.close, 1),
      changePercent: round(((price - prev.close) / prev.close) * 100, 2),
      marketCapOku,
      high52w: Math.max(...w52),
      low52w: Math.min(...w52),
      allTimeHigh: Math.max(...closes),
    },
    history,
    fiscal,
    financials,
    valuation,
    dividend,
    nextEarningsDate: undefined,
    latestEarnings,
    news: [],
    marginRatio: undefined,
    meta: {
      sourceName: 'J-Quants API（JPX）',
      kind: 'api',
      asOf: `${last.date}T15:00:00+09:00`,
      isDemo: false,
      notice: `取得日時 ${fetchedAt}。株価は取得できた最新営業日（${last.date}）の終値。J-Quants 無料プランでは株価が約12週間遅れます。ニュース・次回決算日・信用倍率・有利子負債は未取得です。`,
    },
  };
}

// ---------- main ----------
async function main() {
  await loadEnv();
  const codes = JSON.parse(await readFile(path.join(__dirname, 'codes.json'), 'utf8'));
  const fetchedAt = new Date().toISOString();
  const stocks = [];

  if (fixtureMode) {
    const raw = JSON.parse(await readFile(path.join(__dirname, 'fixtures/jquants-sample.json'), 'utf8'));
    stocks.push(normalize('7203', raw, fetchedAt));
  } else {
    const token = process.env.JQUANTS_REFRESH_TOKEN;
    if (!token) {
      console.error('JQUANTS_REFRESH_TOKEN が設定されていません。\n  1) https://jpx-jquants.com/ で無料登録\n  2) ログイン後の画面で「リフレッシュトークン」をコピー\n  3) .env に JQUANTS_REFRESH_TOKEN=<トークン> と書く\n  4) npm run fetch-data');
      process.exit(1);
    }
    console.log('J-Quants に接続しています…');
    const idToken = await getIdToken(token);
    for (const code4 of codes) {
      const code5 = code4.length === 4 ? `${code4}0` : code4;
      process.stdout.write(`  ${code4} … `);
      try {
        const raw = await fetchRaw(code5, idToken);
        const s = normalize(code4, raw, fetchedAt);
        stocks.push(s);
        console.log(`${s.name} ${s.quote.price}円 (${s.history.length}日分 / 決算${raw.statements.length}件)`);
      } catch (e) {
        console.log(`スキップ: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 250)); // レート制限への配慮
    }
  }

  if (stocks.length === 0) throw new Error('1銘柄も取得できませんでした。');
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ fetchedAt, stocks }), 'utf8');
  console.log(`\n${stocks.length}銘柄を ${path.relative(ROOT, OUT)} に書き出しました。`);
  console.log('次に npm run build（または npm run dev）を実行すると、アプリが実データで動きます。');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => {
    console.error('\nエラー:', e.message);
    process.exit(1);
  });
}
