// Lightweight market data fetchers for BTC (Binance) and MSTR (Yahoo Finance)
// Designed to align with the UI timeframe selections and power the Monitor tiles.

export type Timeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1D';

export interface Summary {
  price: number;
  changePct: number; // percentage e.g., 2.34
  volume?: number | string; // may be large; leave as number for BTC (quote volume in USDT) and MSTR shares
  low?: number;
  high?: number;
  sparkline?: number[]; // recent close prices for a small sparkline
  priceSource?: 'regular' | 'pre' | 'post' | 'chart' | 'ticker';
  ts?: number; // unix seconds when price was observed (if known)
}

// --- Timeframe mappers ---
function tfToBinance(tf: Timeframe): { interval: string; limit: number } {
  switch (tf) {
    case '1m': return { interval: '1m', limit: 60 };
    case '5m': return { interval: '5m', limit: 48 };
    case '15m': return { interval: '15m', limit: 48 };
    case '1h': return { interval: '1h', limit: 48 };
    case '4h': return { interval: '4h', limit: 36 };
    case '1D': return { interval: '1d', limit: 60 };
    default: return { interval: '15m', limit: 48 };
  }
}

function tfToYahoo(tf: Timeframe): { interval: string; range: string } {
  switch (tf) {
    case '1m': return { interval: '1m', range: '1d' };
    case '5m': return { interval: '5m', range: '1d' };
    case '15m': return { interval: '15m', range: '5d' };
    case '1h': return { interval: '60m', range: '1mo' };
    case '4h': return { interval: '60m', range: '3mo' }; // approximate
    case '1D': return { interval: '1d', range: '6mo' };
    default: return { interval: '15m', range: '5d' };
  }
}

// --- BTC (Binance) ---
export async function fetchBtcSummary(tf: Timeframe): Promise<Summary> {
  try {
    const tickerUrl = 'https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT';
    const tickerRes = await fetch(tickerUrl);
    if (!tickerRes.ok) throw new Error('Binance ticker failed');
    const t = await tickerRes.json();
    const price = parseFloat(t.lastPrice);
    const changePct = parseFloat(t.priceChangePercent);
    const volume = parseFloat(t.quoteVolume); // USDT value traded
    const low = parseFloat(t.lowPrice);
    const high = parseFloat(t.highPrice);

    // Sparkline for last ~24h using 5m klines (288 points)
    const klinesUrl = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=288`;
    const kRes = await fetch(klinesUrl);
    const sparkline = kRes.ok ? (await kRes.json()).map((k: any) => parseFloat(k[4])) as number[] : undefined;

  return { price, changePct, volume, low, high, sparkline, priceSource: 'ticker' };
  } catch {
    // Fallback to safe defaults if network/CORS fails
    return {
      price: 64000,
      changePct: 0,
      volume: undefined,
      low: undefined,
      high: undefined,
      sparkline: Array.from({ length: 24 }, (_, i) => 64000 + Math.sin(i / 3) * 200),
    };
  }
}

// --- MSTR (Yahoo Finance) ---
export async function fetchMstrSummary(tf: Timeframe): Promise<Summary> {
  try {
    // Fetch intraday regular-session bars only
    const interval = '1m';
    const range = '1d';
  const PROXY = import.meta.env.VITE_YAHOO_PROXY_URL as string | undefined; // Cloudflare Worker URL
  const VERCEL = import.meta.env.VITE_YAHOO_VERCEL_URL as string | undefined; // Optional Vercel function base e.g. https://your-app.vercel.app/api/yahoo

    // 1) Prefer chart endpoint (more CORS-friendly via proxy) and derive price/change/range from it
  const chartParams = `interval=${interval}&range=${range}&includePrePost=false`;
    const chartUrl = PROXY
      ? `${PROXY}/v8/finance/chart/MSTR?${chartParams}`
      : VERCEL
      ? `${VERCEL}/v8/finance/chart/MSTR?${chartParams}`
      : import.meta.env.DEV
      ? `/api/yahoo/v8/finance/chart/MSTR?${chartParams}`
      : `https://query1.finance.yahoo.com/v8/finance/chart/MSTR?${chartParams}`;
    const c = (PROXY || VERCEL || import.meta.env.DEV) ? await fetchJson(chartUrl) : await fetchJsonWithCorsFallback(chartUrl);

  const result = c?.chart?.result?.[0];
  const meta = result?.meta;
    const quoteBlock = result?.indicators?.quote?.[0];
    const ts: number[] | undefined = result?.timestamp;
    const closes: Array<number | null | undefined> | undefined = quoteBlock?.close;
    const vols: Array<number | null | undefined> | undefined = quoteBlock?.volume;
  const metaRegPrice = Number(meta?.regularMarketPrice);
  const metaRegTime = Number(meta?.regularMarketTime);
  const prevClose = Number(meta?.chartPreviousClose);
    let series: number[] = [];
    if (Array.isArray(closes)) {
      series = closes.filter((v): v is number => typeof v === 'number');
    }

  let price = series.length ? series[series.length - 1] : 0;
    const base = series.length ? series[0] : 0;
    let changePct = base > 0 ? ((price - base) / base) * 100 : 0;
    let low = series.length ? Math.min(...series) : undefined;
    let high = series.length ? Math.max(...series) : undefined;
    const sparkline = series;
  let volume = undefined as number | undefined;
  let priceSource: 'regular' | 'pre' | 'post' | 'chart' = 'chart';
  let tsOut: number | undefined = undefined;

    // 2) Try to enhance with quote endpoint, but don't fail if it errors
    try {
      const quoteUrl = PROXY
        ? `${PROXY}/v7/finance/quote?symbols=MSTR`
        : VERCEL
        ? `${VERCEL}/v7/finance/quote?symbols=MSTR`
        : import.meta.env.DEV
        ? '/api/yahoo/v7/finance/quote?symbols=MSTR'
        : 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=MSTR';
      const q = (PROXY || VERCEL || import.meta.env.DEV) ? await fetchJson(quoteUrl) : await fetchJsonWithCorsFallback(quoteUrl);
      const item = q?.quoteResponse?.result?.[0];
      const marketState = String(item?.marketState || '').toUpperCase();
      const qRegPrice = Number(item?.regularMarketPrice);
      const qPostPrice = Number(item?.postMarketPrice);
      const qPrePrice  = Number(item?.preMarketPrice);
      const qChangePct = Number(item?.regularMarketChangePercent);
      const qLow = Number(item?.regularMarketDayLow);
      const qHigh = Number(item?.regularMarketDayHigh);
      const qVol = Number(item?.regularMarketVolume);
      const regTs = Number(item?.regularMarketTime);
  const postTs = Number(item?.postMarketTime);
  const preTs  = Number(item?.preMarketTime);

      // Regular-only logic: if REGULAR, show live regular price; otherwise, show previous close
      const prevClose = Number(item?.regularMarketPreviousClose);
      if (marketState === 'REGULAR' && isFinite(qRegPrice)) {
        price = qRegPrice;
        priceSource = 'regular';
        tsOut = isFinite(regTs) ? regTs : undefined;
        if (isFinite(qChangePct)) changePct = qChangePct;
      } else if (isFinite(prevClose)) {
        price = prevClose;
        priceSource = 'regular';
        tsOut = isFinite(regTs) ? regTs : undefined;
        // At close price: show 0% change (or keep day's change if desired). We use 0 to avoid confusion post-market.
        changePct = 0;
      }
      if (isFinite(qLow)) low = qLow;
      if (isFinite(qHigh)) high = qHigh;
      if (isFinite(qVol)) volume = qVol;
    } catch {}

    // Fallback to chart meta's regularMarketPrice if quote failed or was missing
    if (priceSource !== 'regular' && isFinite(metaRegPrice)) {
      price = metaRegPrice;
      priceSource = 'regular';
      tsOut = isFinite(metaRegTime) ? metaRegTime : tsOut;
    }
    // If we picked previous close above (market not REGULAR), ensure changePct is 0

    return { price, changePct, volume, low, high, sparkline, priceSource, ts: tsOut };
  } catch {
    return {
      price: 185,
      changePct: 0,
      volume: undefined,
      low: undefined,
      high: undefined,
      sparkline: Array.from({ length: 24 }, (_, i) => 185 + Math.cos(i / 3) * 2.5),
    };
  }
}

async function fetchJson(url: string): Promise<any> {
  const r = await fetch(url);
  if (!r.ok) throw new Error('fetch failed');
  return r.json();
}

async function fetchJsonWithCorsFallback(url: string): Promise<any> {
  // Try direct first
  try {
    const r = await fetch(url);
    if (r.ok) return await r.json();
  } catch {}
  // Try corsproxy.io
  try {
    const r2 = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (r2.ok) return await r2.json();
  } catch {}
  // Last resort: text then JSON.parse (some proxies return text/plain)
  try {
    const r3 = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (r3.ok) {
      const txt = await r3.text();
      return JSON.parse(txt);
    }
  } catch {}
  throw new Error('CORS fallback failed');
}

export function formatCompactNumber(n?: number | string, currency = false): string {
  if (n == null) return '-';
  const num = typeof n === 'string' ? Number(n) : n;
  if (!isFinite(num)) return '-';
  if (currency) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(num);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
}
