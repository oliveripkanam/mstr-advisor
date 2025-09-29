// Cross-exchange helpers for BTC data (OKX primary, Bybit fallback)

export type TF = '5m' | '15m' | '1h';

function okxBar(tf: TF): string {
  return tf === '5m' ? '5m' : tf === '15m' ? '15m' : '1H';
}

function bybitInterval(tf: TF): string {
  return tf === '5m' ? '5' : tf === '15m' ? '15' : '60';
}

function asc<T>(arr: T[], getTs: (t: T) => number): T[] {
  return [...arr].sort((a, b) => getTs(a) - getTs(b));
}

function isOk(res: Response) { return res.ok && res.status >= 200 && res.status < 300; }

// Normalized Kline tuple shape (compatible subset with Binance indices used in code):
// [0] openTime(ms), [1] open, [2] high, [3] low, [4] close, [5] baseVol, [7] quoteVol
export type NormKline = [number, number, number, number, number, number, undefined?, number?];

export async function fetchOkxKlinesNormalized(tf: TF, limit: number): Promise<NormKline[]> {
  const bar = okxBar(tf);
  const url = `/proxy/okx/api/v5/market/candles?instId=BTC-USDT-SWAP&bar=${encodeURIComponent(bar)}&limit=${limit}`;
  const r = await fetch(url);
  if (!isOk(r)) throw new Error('okx klines failed');
  const j = await r.json();
  const data: any[] = j?.data || [];
  const rows = data.map((row) => {
    const ts = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    const vol = Number(row[5]);
    const volCcyQuote = Number(row[7]);
    return [ts, o, h, l, c, vol, undefined, volCcyQuote] as NormKline;
  });
  return asc(rows, (r) => r[0]);
}

export async function fetchBybitKlinesNormalized(tf: TF, limit: number): Promise<NormKline[]> {
  const interval = bybitInterval(tf);
  const url = `/proxy/bybit/v5/market/kline?category=linear&symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!isOk(r)) throw new Error('bybit klines failed');
  const j = await r.json();
  const list: any[] = j?.result?.list || [];
  const rows = list.map((row) => {
    const ts = Number(row[0]);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    const volQuote = Number(row[7] ?? row[5] * row[4]);
    const volBase = Number(row[5]);
    return [ts, o, h, l, c, volBase, undefined, volQuote] as NormKline;
  });
  return asc(rows, (r) => r[0]);
}

export async function fetchBtcKlinesNormalized(tf: TF, limit: number): Promise<NormKline[]> {
  try { return await fetchOkxKlinesNormalized(tf, limit); } catch {}
  return await fetchBybitKlinesNormalized(tf, limit);
}

export async function fetchBtcCloses(tf: TF, limit: number): Promise<number[]> {
  const ks = await fetchBtcKlinesNormalized(tf, limit);
  return ks.map(k => k[4]).filter((v) => isFinite(v));
}

export async function fetchBtcTicker(): Promise<number> {
  // OKX primary
  try {
    const r = await fetch('/proxy/okx/api/v5/market/ticker?instId=BTC-USDT-SWAP');
    if (isOk(r)) {
      const j = await r.json();
      const row = j?.data?.[0];
      const last = Number(row?.last ?? row?.lastPx);
      if (isFinite(last)) return last;
    }
  } catch {}
  // Bybit fallback
  try {
    const r2 = await fetch('/proxy/bybit/v5/market/tickers?category=linear&symbol=BTCUSDT');
    if (isOk(r2)) {
      const j2 = await r2.json();
      const item = j2?.result?.list?.[0];
      const last = Number(item?.lastPrice);
      if (isFinite(last)) return last;
    }
  } catch {}
  return 0;
}

// --- Funding (OKX primary, Bybit fallback) ---
export interface FundingSnapshot {
  fundingRate8h?: number; // decimal per 8h
  nextFundingTime?: number; // ms
  ts?: number; // ms
}

export async function fetchOkxFunding(): Promise<FundingSnapshot> {
  const r = await fetch('/proxy/okx/api/v5/public/funding-rate?instId=BTC-USDT-SWAP');
  if (!isOk(r)) throw new Error('okx funding failed');
  const j = await r.json();
  const row = j?.data?.[0];
  const fundingRate8h = Number(row?.fundingRate);
  const nextFundingTime = Number(row?.nextFundingTime);
  const ts = Number(row?.ts ?? row?.fundingTime);
  return { fundingRate8h: isFinite(fundingRate8h) ? fundingRate8h : undefined,
           nextFundingTime: isFinite(nextFundingTime) ? nextFundingTime : undefined,
           ts: isFinite(ts) ? ts : undefined };
}

export async function fetchBybitFundingFromTicker(): Promise<FundingSnapshot> {
  const r = await fetch('/proxy/bybit/v5/market/tickers?category=linear&symbol=BTCUSDT');
  if (!isOk(r)) throw new Error('bybit ticker funding failed');
  const j = await r.json();
  const it = j?.result?.list?.[0];
  const fr = Number(it?.fundingRate);
  const nft = Number(it?.nextFundingTime);
  const ts = Number(j?.time ?? Date.now());
  return { fundingRate8h: isFinite(fr) ? fr : undefined,
           nextFundingTime: isFinite(nft) ? nft : undefined,
           ts: isFinite(ts) ? ts : undefined };
}

// --- Open Interest (Bybit 5m series primary, OKX current fallback) ---
export interface OiPoint { ts: number; value: number; }

export async function fetchBybitOpenInterestSeries(interval: '5min' | '15min', limit: number): Promise<OiPoint[]> {
  const r = await fetch(`/proxy/bybit/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=${encodeURIComponent(interval)}&limit=${limit}`);
  if (!isOk(r)) throw new Error('bybit oi failed');
  const j = await r.json();
  const retCode = Number(j?.retCode);
  if (retCode !== 0) throw new Error(`bybit oi retCode ${retCode}`);
  const list: any[] = j?.result?.list || [];
  if (!Array.isArray(list) || list.length === 0) throw new Error('bybit oi empty');
  const rows = list.map((row: any) => {
    const ts = Number(row?.timestamp ?? row?.ts ?? row?.t);
    const val = Number(row?.openInterestValue ?? row?.openInterestUsd ?? row?.value);
    return { ts, value: val } as OiPoint;
  }).filter(p => isFinite(p.ts) && isFinite(p.value));
  return asc(rows, (p) => p.ts);
}

export async function fetchOkxCurrentOpenInterestUsd(): Promise<OiPoint | undefined> {
  const r = await fetch('/proxy/okx/api/v5/public/open-interest?instId=BTC-USDT-SWAP');
  if (!isOk(r)) return undefined;
  const j = await r.json();
  const row = j?.data?.[0];
  const ts = Number(row?.ts);
  const val = Number(row?.oiUsd ?? row?.oiCcy);
  if (!isFinite(ts) || !isFinite(val)) return undefined;
  return { ts, value: val };
}
