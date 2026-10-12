#!/usr/bin/env node
/**
 * 登録・支払い・トークン不要のデータ取得（Yahoo Finance の非公式データ口を利用）。
 *
 *   npm run fetch-data            … 実データを取得して src/data/snapshot/stocks.json に書き出す
 *   npm run fetch-data -- --fixture … 通信せず、同梱のテスト用データで変換処理だけ確認する
 *
 * 注意：
 *  - Yahoo Finance は公式APIを提供していません。yahoo-finance2 ライブラリが利用する
 *    公開エンドポイントを使うため、仕様変更で突然動かなくなる可能性があります。
 *  - 個人利用の範囲で使ってください。株価は約20分遅れです。
 *  - 会社名・業種・事業内容の日本語は scripts/meta.json（手書きの静的情報）から補います。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src/data/snapshot/stocks.json');
const fixtureMode = process.argv.includes('--fixture');

// ---------- 小道具 ----------
const num = (v) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'object' && 'raw' in v) v = v.raw;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const mil = (v) => (num(v) === undefined ? undefined : Math.round(num(v) / 1e6));
const round = (v, d = 2) => (v === undefined ? undefined : Math.round(v * 10 ** d) / 10 ** d);
const pct = (v, d = 1) => (v === undefined ? undefined : round(v * 100, d));
const ymd = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
const yoy = (cur, prev) => (cur !== undefined && prev !== undefined && prev > 0 ? round(((cur - prev) / prev) * 100, 1) : undefined);
const fiscalLabel = (date) => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}/${d.getUTCMonth() + 1}期`;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 取得 ----------
/** Yahoo は短時間に続けて呼ぶと 429（Too Many Requests）を返す。待ってから再試行する。 */
async function withRetry(fn, tries = 4) {
  let wait = 15000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message ?? e);
      const rateLimited = /Too Many Requests|429|rate/i.test(msg);
      if (!rateLimited || i >= tries) throw e;
      process.stdout.write(`（混雑のため ${wait / 1000}秒 待機）`);
      await sleep(wait);
      wait *= 2;
    }
  }
}

async function fetchRaw(code, yf) {
  const symbol = `${code}.T`;
  const period2 = new Date();
  const period1 = new Date(period2);
  period1.setFullYear(period1.getFullYear() - 5);
  const opt = { validateResult: false };

  const chart = await yf.chart(symbol, { period1, period2, interval: '1d', events: 'div', return: 'array' }, opt);
  await sleep(300);
  const summary = await yf.quoteSummary(
    symbol,
    { modules: ['price', 'summaryDetail', 'defaultKeyStatistics', 'financialData', 'calendarEvents', 'summaryProfile'] },
    opt
  );
  await sleep(300);
  let annual = [];
  let quarterly = [];
  try {
    annual = await yf.fundamentalsTimeSeries(symbol, { period1, period2, type: 'annual', module: 'all' }, opt);
    await sleep(300);
    quarterly = await yf.fundamentalsTimeSeries(symbol, { period1, period2, type: 'quarterly', module: 'financials' }, opt);
  } catch (e) {
    console.log(`（財務の時系列が取得できませんでした: ${e.message}）`);
  }
  return { chart, summary, annual, quarterly };
}

// ---------- 変換 ----------
export function normalize(code, raw, meta, fetchedAt) {
  const { chart, summary, annual = [], quarterly = [] } = raw;
  const sd = summary.summaryDetail ?? {};
  const ks = summary.defaultKeyStatistics ?? {};
  const fd = summary.financialData ?? {};
  const pr = summary.price ?? {};
  const prof = summary.summaryProfile ?? {};

  const fullHistory = (chart.quotes ?? [])
    .filter((q) => num(q.close) !== undefined)
    .map((q) => ({
      date: ymd(q.date),
      open: num(q.open) ?? num(q.close),
      high: num(q.high) ?? num(q.close),
      low: num(q.low) ?? num(q.close),
      close: num(q.close),
      volume: num(q.volume) ?? 0,
    }));
  if (fullHistory.length < 2) throw new Error(`${code}: 株価データが不足しています`);
  const history = fullHistory.slice(-300);
  const closes = fullHistory.map((p) => p.close);
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const price = num(pr.regularMarketPrice) ?? last.close;
  const previousClose = num(pr.regularMarketPreviousClose) ?? prev.close;

  // 通期（古い順・最大5期）
  const fyRows = [...annual]
    .filter((r) => r.date && (num(r.totalRevenue) !== undefined || num(r.netIncome) !== undefined))
    .sort((a, b) => (ymd(a.date) < ymd(b.date) ? -1 : 1))
    .slice(-5);
  const sharesNow = num(ks.sharesOutstanding);
  const fiscal = fyRows.map((r) => {
    const shares = num(r.ordinarySharesNumber) ?? sharesNow;
    const eq = num(r.stockholdersEquity);
    return {
      label: fiscalLabel(r.date),
      revenue: mil(r.totalRevenue),
      operatingIncome: mil(r.operatingIncome),
      netIncome: mil(r.netIncome),
      eps: num(r.dilutedEPS) ?? num(r.basicEPS),
      bps: eq !== undefined && shares ? round(eq / shares, 0) : undefined,
      dividendPerShare: undefined, // 下で配当履歴から補う
      isForecast: false,
    };
  });

  // 配当履歴（暦年ごとの合計）
  const divEvents = (chart.events?.dividends ?? []).map((d) => ({ date: ymd(d.date), amount: num(d.amount) ?? 0 }));
  const byYear = new Map();
  for (const d of divEvents) byYear.set(d.date.slice(0, 4), (byYear.get(d.date.slice(0, 4)) ?? 0) + d.amount);
  const thisYear = String(new Date().getUTCFullYear());
  const dpsHistory = [...byYear.entries()]
    .filter(([y]) => y < thisYear)
    .sort()
    .slice(-5)
    .map(([, v]) => round(v, 1));
  for (const f of fiscal) {
    const y = f.label.slice(0, 4);
    const v = byYear.get(y) ?? byYear.get(String(Number(y) - 1));
    if (v !== undefined && y < thisYear) f.dividendPerShare = round(v, 1);
  }

  // 予想（アナリスト平均ベース。会社予想ではないことをラベルで示す）
  const forwardEps = num(ks.forwardEps);
  const dividendRate = num(sd.dividendRate);
  const latestActual = fiscal[fiscal.length - 1];
  if (forwardEps !== undefined || dividendRate !== undefined) {
    fiscal.push({
      label: '今期(予想・アナリスト平均)',
      revenue: undefined,
      operatingIncome: undefined,
      netIncome: undefined,
      eps: forwardEps,
      bps: latestActual?.bps,
      dividendPerShare: dividendRate,
      isForecast: true,
    });
  }
  const forecast = fiscal.find((f) => f.isForecast);

  // 財務
  const lastFy = fyRows[fyRows.length - 1];
  const prevFy = fyRows[fyRows.length - 2];
  const equity = num(lastFy?.stockholdersEquity);
  const totalAssets = num(lastFy?.totalAssets);
  const financials = {
    equityRatio: equity !== undefined && totalAssets ? round((equity / totalAssets) * 100, 1) : undefined,
    interestBearingDebt: mil(lastFy?.totalDebt) ?? mil(fd.totalDebt),
    cash: mil(lastFy?.cashAndCashEquivalents) ?? mil(fd.totalCash),
    operatingCF: mil(lastFy?.operatingCashFlow) ?? mil(fd.operatingCashflow),
    operatingCFPrev: mil(prevFy?.operatingCashFlow),
    investingCF: mil(lastFy?.investingCashFlow),
    financingCF: mil(lastFy?.financingCashFlow),
    roe: pct(num(fd.returnOnEquity)),
    roa: pct(num(fd.returnOnAssets)),
    operatingMargin: pct(num(fd.operatingMargins)),
  };

  // 過去平均PER/PBR：各決算期末の株価 ÷ その期のEPS/BPS
  const perS = [];
  const pbrS = [];
  for (const [i, r] of fyRows.entries()) {
    const end = ymd(r.date);
    const at = [...fullHistory].reverse().find((p) => p.date <= end);
    const f = fiscal[i];
    if (!at || !f) continue;
    if (f.eps > 0) perS.push(at.close / f.eps);
    if (f.bps > 0) pbrS.push(at.close / f.bps);
  }
  const avg = (a) => (a.length >= 2 ? round(a.reduce((x, y) => x + y, 0) / a.length, 2) : undefined);

  const marketCapYen = num(pr.marketCap) ?? num(sd.marketCap);
  const valuation = {
    per: num(sd.trailingPE) ?? (latestActual?.eps > 0 ? round(price / latestActual.eps, 1) : undefined),
    forwardPer: forwardEps > 0 ? round(price / forwardEps, 1) : num(sd.forwardPE),
    perAvg5y: avg(perS),
    pbr: num(ks.priceToBook) ?? (latestActual?.bps > 0 ? round(price / latestActual.bps, 2) : undefined),
    pbrAvg5y: avg(pbrS),
    psr: num(sd.priceToSalesTrailing12Months),
    dividendYield: dividendRate > 0 ? round((dividendRate / price) * 100, 2) : pct(num(sd.dividendYield), 2),
  };
  const dps = dividendRate ?? dpsHistory[dpsHistory.length - 1];
  const epsForPayout = forwardEps ?? latestActual?.eps;
  let streak = 0;
  for (let i = dpsHistory.length - 1; i > 0; i--) if (dpsHistory[i] > dpsHistory[i - 1]) streak++; else break;
  const dividend = {
    yield: valuation.dividendYield,
    perShare: dps,
    payoutRatio: num(sd.payoutRatio) !== undefined ? pct(num(sd.payoutRatio)) : dps && epsForPayout > 0 ? round((dps / epsForPayout) * 100, 1) : undefined,
    consecutiveIncreaseYears: dpsHistory.length >= 2 ? streak : undefined,
    hasCutHistory: dpsHistory.length >= 2 ? dpsHistory.some((v, i) => i > 0 && v < dpsHistory[i - 1]) : undefined,
    historyPerShare: dpsHistory.length ? dpsHistory : undefined,
  };

  // 直近四半期と前年同期比
  const qRows = [...quarterly].filter((r) => r.date && num(r.totalRevenue) !== undefined).sort((a, b) => (ymd(a.date) < ymd(b.date) ? -1 : 1));
  const q = qRows[qRows.length - 1];
  const qPrevYear = qRows[qRows.length - 5];
  const latestEarnings = q
    ? {
        period: `${ymd(q.date)} までの四半期`,
        announcedAt: ymd(q.date),
        revenue: mil(q.totalRevenue),
        operatingIncome: mil(q.operatingIncome),
        netIncome: mil(q.netIncome),
        revenueYoY: yoy(num(q.totalRevenue), num(qPrevYear?.totalRevenue)),
        operatingIncomeYoY: yoy(num(q.operatingIncome), num(qPrevYear?.operatingIncome)),
        netIncomeYoY: yoy(num(q.netIncome), num(qPrevYear?.netIncome)),
        progressRate: undefined,
        guidanceRevision: 'unknown',
        vsConsensus: undefined,
      }
    : undefined;

  const nextDates = summary.calendarEvents?.earnings?.earningsDate ?? [];
  const nextEarningsDate = nextDates.length ? ymd(nextDates[0]) : undefined;
  const sizeClass = marketCapYen === undefined ? 'mid' : marketCapYen >= 1e12 ? 'large' : marketCapYen >= 1e11 ? 'mid' : 'small';
  const w52 = history.map((p) => p.close);

  return {
    code,
    name: meta?.name ?? pr.longName ?? pr.shortName ?? code,
    aliases: [...(meta?.aliases ?? []), pr.shortName, pr.longName].filter(Boolean),
    sector: meta?.sector ?? prof.sector ?? '不明',
    market: meta?.market ?? '東証',
    business: meta?.business ?? (prof.longBusinessSummary ? `（英語）${prof.longBusinessSummary}` : '事業内容の説明は未取得です。証券会社のページで「企業情報」を確認してください。'),
    tags: meta?.tags ?? [prof.sector, prof.industry].filter(Boolean),
    sizeClass,
    tradingUnit: meta?.tradingUnit ?? 100,
    quote: {
      price,
      previousClose,
      change: round(price - previousClose, 1),
      changePercent: round(((price - previousClose) / previousClose) * 100, 2),
      marketCapOku: marketCapYen === undefined ? undefined : Math.round(marketCapYen / 1e8),
      high52w: num(sd.fiftyTwoWeekHigh) ?? Math.max(...w52),
      low52w: num(sd.fiftyTwoWeekLow) ?? Math.min(...w52),
      allTimeHigh: Math.max(...closes),
    },
    history,
    fiscal,
    financials,
    valuation,
    dividend,
    nextEarningsDate,
    latestEarnings,
    news: [],
    marginRatio: undefined,
    meta: {
      sourceName: 'Yahoo Finance（非公式・約20分遅れ）',
      kind: 'api',
      asOf: fetchedAt,
      isDemo: false,
      notice:
        '登録不要の非公式データ口から取得しています。株価は約20分遅れ。「予想」はアナリスト平均で会社予想ではありません。ニュース・信用倍率・会社予想の売上/利益は未取得です。',
    },
  };
}

// ---------- main ----------
async function main() {
  const codes = JSON.parse(await readFile(path.join(__dirname, 'codes.json'), 'utf8'));
  const metaAll = JSON.parse(await readFile(path.join(__dirname, 'meta.json'), 'utf8'));
  const fetchedAt = new Date().toISOString();
  const stocks = [];

  if (fixtureMode) {
    const raw = JSON.parse(await readFile(path.join(__dirname, 'fixtures/yahoo-sample.json'), 'utf8'));
    stocks.push(normalize('7203', raw, metaAll['7203'], fetchedAt));
  } else {
    const { default: YahooFinance } = await import('yahoo-finance2');
    const yf = new YahooFinance({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
    console.log(`Yahoo Finance から ${codes.length} 銘柄を取得します（登録不要・約20分遅れ）…`);
    for (const code of codes) {
      process.stdout.write(`  ${code} … `);
      try {
        const raw = await withRetry(() => fetchRaw(code, yf));
        const s = normalize(code, raw, metaAll[code], fetchedAt);
        stocks.push(s);
        console.log(`${s.name} ${s.quote.price}円  PER ${s.valuation.forwardPer ?? '-'}  利回り ${s.dividend.yield ?? '-'}%`);
      } catch (e) {
        console.log(`スキップ: ${e.message}`);
      }
      await sleep(1500);
    }
  }
  if (stocks.length === 0) throw new Error('1銘柄も取得できませんでした。');
  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ fetchedAt, stocks }), 'utf8');
  console.log(`\n${stocks.length}銘柄を ${path.relative(ROOT, OUT)} に書き出しました。npm run dev / npm run build で実データ表示になります。`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error('\nエラー:', e.message); process.exit(1); });
}
