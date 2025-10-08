// Utilities for fetching daily open/close data since Monday and summarizing
// Uses Yahoo Finance chart v8 via existing proxy configuration

type SeriesPoint = {
  ts: number; // unix seconds (UTC)
  open: number;
  close: number;
};

export type DailyRow = {
  date: string; // e.g., 2025-10-06
  ts: number;
  open: number;
  close: number;
  prevClose?: number;
  changeAbs?: number; // close - prevClose
  changePct?: number; // (close - prevClose)/prevClose * 100
  intradayPct?: number; // (close - open)/open * 100
  up?: boolean; // changePct > 0
};

export type DailySinceMonday = {
  rows: DailyRow[];
  greenCount: number;
  redCount: number;
};

// Resolve Yahoo base from envs used elsewhere in the app
function getYahooBase(): string {
  const PROXY = (import.meta as any).env?.VITE_YAHOO_PROXY_URL as string | undefined;
  const VERCEL = (import.meta as any).env?.VITE_YAHOO_VERCEL_URL as string | undefined;
  return PROXY ?? VERCEL ?? '/api/yahoo';
}

function toISODateUTC(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function startOfMondayUTC(nowMs = Date.now()): number {
  const d = new Date(nowMs);
  // Convert to UTC midnight
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utc).getUTCDay(); // 0=Sun, 1=Mon, ...
  const diffToMon = (day + 6) % 7; // days since Monday
  const mondayMs = utc - diffToMon * 24 * 60 * 60 * 1000;
  return Math.floor(mondayMs / 1000);
}

function startOfTodayUTC(nowMs = Date.now()): number {
  const d = new Date(nowMs);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor(utc / 1000);
}

async function fetchYahooDailySeries(symbol: string, includePrePost = false): Promise<{ series: SeriesPoint[]; metaPrevClose?: number; }> {
  const base = getYahooBase();
  // Fetch last 10 days just to be safe
  const params = new URLSearchParams({
    interval: '1d',
    range: '10d',
    includePrePost: String(includePrePost),
  });
  const url = `${base}/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`yahoo_chart_failed_${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] | undefined = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  const opens: Array<number | null | undefined> | undefined = quote?.open;
  const closes: Array<number | null | undefined> | undefined = quote?.close;
  const out: SeriesPoint[] = [];
  if (Array.isArray(ts) && Array.isArray(opens) && Array.isArray(closes)) {
    for (let i = 0; i < ts.length; i++) {
      const o = opens[i];
      const c = closes[i];
      if (typeof o === 'number' && typeof c === 'number' && isFinite(o) && isFinite(c)) {
        out.push({ ts: ts[i], open: o, close: c });
      }
    }
  }
  const metaPrevClose = typeof result?.meta?.chartPreviousClose === 'number' && isFinite(result.meta.chartPreviousClose)
    ? Number(result.meta.chartPreviousClose)
    : undefined;
  return { series: out, metaPrevClose };
}

export async function getDailySinceMonday(symbol: 'BTC-USD' | 'MSTR' | string): Promise<DailySinceMonday> {
  // For MSTR we use regular session only (includePrePost=false). For BTC-USD, daily bars are OK.
  const includePrePost = false;
  const { series, metaPrevClose } = await fetchYahooDailySeries(symbol === 'MSTR' ? 'MSTR' : symbol, includePrePost);

  // Determine indices for Monday..yesterday (UTC)
  const mondayTs = startOfMondayUTC();
  const todayStartTs = startOfTodayUTC();
  let startIdx = series.findIndex((p) => p.ts >= mondayTs);
  if (startIdx < 0) startIdx = series.length; // nothing in range
  let endIdx = series.findIndex((p) => p.ts >= todayStartTs);
  if (endIdx < 0) endIdx = series.length; // include up to last complete bar

  const rows: DailyRow[] = [];
  for (let i = startIdx; i < endIdx; i++) {
    const cur = series[i];
    const prev = series[i - 1]; // may be before Monday, which is what we want
    let prevClose = prev?.close;
    if (typeof prevClose !== 'number' && i === startIdx && typeof metaPrevClose === 'number') {
      // Use Yahoo meta chartPreviousClose as a fallback for the first visible day
      prevClose = metaPrevClose;
    }
    const row: DailyRow = {
      date: toISODateUTC(cur.ts),
      ts: cur.ts,
      open: cur.open,
      close: cur.close,
      prevClose,
    };
    if (typeof prevClose === 'number' && isFinite(prevClose) && prevClose > 0) {
      row.changeAbs = cur.close - prevClose;
      row.changePct = ((cur.close - prevClose) / prevClose) * 100;
      row.up = (row.changePct ?? 0) > 0;
    }
    if (cur.open > 0) {
      row.intradayPct = ((cur.close - cur.open) / cur.open) * 100;
    }
    if (typeof row.prevClose === 'number') rows.push(row);
  }

  const greenCount = rows.filter((r) => (r.up ?? false)).length;
  const redCount = rows.filter((r) => (r.up === false)).length;

  return { rows, greenCount, redCount };
}
