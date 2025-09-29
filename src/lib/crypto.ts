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
