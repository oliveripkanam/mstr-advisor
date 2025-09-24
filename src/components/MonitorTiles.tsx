import { useEffect, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
// percent indicators removed
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { fetchBtcSummary, fetchMstrSummary, formatCompactNumber, type Timeframe } from "../lib/marketData";
import type { Summary } from "../lib/marketData";

interface MonitorTilesProps {
  onTileClick: (symbol: string) => void;
  timeframe?: Timeframe; // single selected timeframe drives summaries
}

// --- Compare card helpers (Yahoo daily closes) ---
type DailyClose = { day: string; close: number };

const YAHOO_BASE = (import.meta.env.VITE_YAHOO_PROXY_URL as string | undefined)
  ?? (import.meta.env.VITE_YAHOO_VERCEL_URL as string | undefined)
  ?? '/api/yahoo';

async function fetchYahooDailyCloses(symbol: string): Promise<DailyClose[]> {
  try {
    const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2mo&includePrePost=false`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    const ts: number[] | undefined = result?.timestamp;
    const closes: Array<number | null | undefined> | undefined = result?.indicators?.quote?.[0]?.close;
    if (!Array.isArray(ts) || !Array.isArray(closes)) return [];
    const out: DailyClose[] = [];
    const n = Math.min(ts.length, closes.length);
    for (let i = 0; i < n; i++) {
      const c = closes[i];
      const t = ts[i];
      if (typeof c === 'number' && isFinite(c) && typeof t === 'number' && isFinite(t)) {
        const day = new Date(t * 1000).toISOString().slice(0, 10); // YYYY-MM-DD UTC
        out.push({ day, close: c });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function MonitorTiles({ onTileClick, timeframe = '15m' }: MonitorTilesProps) {
  const [btc, setBtc] = useState<Summary>({ price: 0, changePct: 0 });
  const [mstr, setMstr] = useState<Summary>({ price: 0, changePct: 0 });
  // Compare card analytics (MSTR/BTC)
  const [corr, setCorr] = useState<number | undefined>(undefined);
  const [beta, setBeta] = useState<number | undefined>(undefined);
  const [corrLoading, setCorrLoading] = useState<boolean>(false);
  const [corrLastTs, setCorrLastTs] = useState<number | undefined>(undefined);
  const fmt2 = (v?: number) => (v != null && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancel = false;
    async function load() {
      const [b, m] = await Promise.allSettled([
        fetchBtcSummary(timeframe),
        fetchMstrSummary(timeframe),
      ]);
      if (cancel) return;
      if (b.status === 'fulfilled') setBtc(b.value);
      if (m.status === 'fulfilled') setMstr(m.value);
    }
    load();
  const id = setInterval(load, 5_000); // refresh MSTR every 5s; BTC will stream via WS

    // Live BTC via Binance WS to match TradingView BINANCE:BTCUSDT
    try {
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker');
      wsRef.current = ws;
      ws.addEventListener('message', (ev) => {
        try {
          const d = JSON.parse(ev.data as string);
          // Fields: c = last price, P = change percent, h = high, l = low, q = quote volume (24h)
          const price = parseFloat(d.c);
          const changePct = parseFloat(d.P);
          const high = parseFloat(d.h);
          const low = parseFloat(d.l);
          const volume = parseFloat(d.q);
          setBtc((prev) => ({
            ...prev,
            price: isFinite(price) ? price : prev.price,
            changePct: isFinite(changePct) ? changePct : prev.changePct,
            high: isFinite(high) ? high : prev.high,
            low: isFinite(low) ? low : prev.low,
            volume: isFinite(volume) ? volume : prev.volume,
          }));
        } catch {}
      });
    } catch {}

    return () => {
      cancel = true;
      clearInterval(id);
      try { wsRef.current?.close(); } catch {}
      wsRef.current = null;
    };
  }, [timeframe]);

  // Compute 30D correlation and beta (hourly cadence)
  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    async function compute() {
      setCorrLoading(true);
      try {
        const [mstrDaily, btcDaily] = await Promise.all([
          fetchYahooDailyCloses('MSTR'),
          fetchYahooDailyCloses('BTC-USD'),
        ]);
        if (!mounted) return;
        const { a: mPrices, b: bPrices } = alignLast31(mstrDaily, btcDaily);
        const rx = computeLogReturns(mPrices);
        const ry = computeLogReturns(bPrices);
        const { corr: c, beta: be } = statsCorrBeta(rx, ry);
        setCorr(c);
        setBeta(be);
        setCorrLastTs(Date.now());
      } catch {
        if (!mounted) return;
        setCorr(undefined);
        setBeta(undefined);
      } finally {
        if (mounted) setCorrLoading(false);
      }
    }

    compute();
    // hourly cadence
    timer = window.setInterval(compute, 60 * 60 * 1000);
    return () => {
      mounted = false;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const btcRaw = btc.sparkline ?? [];
  const mstrRaw = mstr.sparkline ?? [];
  const btcSparkline = (function(){
    if (!btcRaw.length) return [] as { value: number }[];
    const base = btcRaw[0];
    if (!isFinite(base) || base === 0) return btcRaw.map((v) => ({ value: 0 }));
    // Normalize to percent change for visual clarity in small height
    return btcRaw.map((v) => ({ value: ((v / base) - 1) * 100 }));
  })();
  const mstrSparkline = (function(){
    if (!mstrRaw.length) return [] as { value: number }[];
    const base = mstrRaw[0];
    if (!isFinite(base) || base === 0) return mstrRaw.map((v) => ({ value: 0 }));
    return mstrRaw.map((v) => ({ value: ((v / base) - 1) * 100 }));
  })();
  // percent removed; the mini-graph conveys direction/magnitude
  const ratioNum = btc.price > 0 ? (mstr.price / btc.price * 1000) : 0;
  const ratio = ratioNum ? ratioNum.toFixed(3) : '-';
  const corrStr = corrLoading ? '...' : (corr != null && isFinite(corr) ? Number(corr).toFixed(2) : '-');
  const betaStr = corrLoading ? '...' : (beta != null && isFinite(beta) ? `${Number(beta).toFixed(2)}x` : '-');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6 px-3 sm:px-4">
      {/* BTC Tile */}
      <Card 
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => onTileClick('BTC')}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">BTC</Badge>
            <div className="h-8 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={btcSparkline}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#f59e0b" 
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* percent removed */}
        </div>
        
        <div className="space-y-2">
          <div className="text-2xl font-mono">${btc.price ? btc.price.toLocaleString() : '-'}</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Range: ${fmt2(btc.low)} - ${fmt2(btc.high)}</div>
            <div>24h Volume: {formatCompactNumber(btc.volume, true)}</div>
          </div>
        </div>
      </Card>

      {/* MSTR Tile */}
      <Card 
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => onTileClick('MSTR')}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">MSTR</Badge>
            <div className="h-8 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mstrSparkline}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#22c55e" 
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* percent removed */}
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="text-2xl font-mono">${mstr.price ? mstr.price.toFixed(2) : '-'}</div>
            {mstr.priceSource === 'regular' && (
              <Badge variant="outline" className="text-[10px] uppercase">Reg</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Range: ${fmt2(mstr.low)} - ${fmt2(mstr.high)} </div>
          </div>
        </div>
      </Card>

      {/* Compare Tile */}
      <Card 
        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors md:col-span-2 lg:col-span-1"
        onClick={() => onTileClick('Compare')}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">MSTR/BTC</Badge>
            <div className="h-8 w-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={(function(){
                  // Compute ratio from raw prices to avoid artifacts of percent normalization
                  const len = Math.min(btcRaw.length, mstrRaw.length);
                  const arr = [] as { value: number }[];
                  for (let i=0; i<len; i++) {
                    const b = btcRaw[i];
                    const m = mstrRaw[i];
                    if (typeof b === 'number' && b > 0 && typeof m === 'number' && m > 0) {
                      arr.push({ value: (m / b) * 1000 });
                    }
                  }
                  return arr;
                })()}>
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#a855f7" 
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-2xl font-mono">{ratio}</div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>30D Correlation: {corrStr}</div>
            <div>Beta vs BTC: {betaStr}</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Inner-join two series by day and keep last 31 days (for 30 return samples)
function alignLast31(a: DailyClose[], b: DailyClose[]): { a: number[]; b: number[] } {
  const mapA = new Map(a.map(d => [d.day, d.close] as const));
  const mapB = new Map(b.map(d => [d.day, d.close] as const));
  const days = [...mapA.keys()].filter(d => mapB.has(d)).sort();
  const keep = days.slice(-31);
  const outA: number[] = [];
  const outB: number[] = [];
  for (const d of keep) {
    const va = mapA.get(d);
    const vb = mapB.get(d);
    if (typeof va === 'number' && isFinite(va) && typeof vb === 'number' && isFinite(vb)) {
      outA.push(va);
      outB.push(vb);
    }
  }
  return { a: outA, b: outB };
}

function computeLogReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const p0 = prices[i - 1];
    const p1 = prices[i];
    if (p0 > 0 && p1 > 0 && isFinite(p0) && isFinite(p1)) {
      out.push(Math.log(p1 / p0));
    }
  }
  return out;
}

function statsCorrBeta(x: number[], y: number[]): { corr?: number; beta?: number } {
  const n = Math.min(x.length, y.length);
  if (n < 10) return {}; // guard: insufficient samples
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i];
    const yi = y[i];
    sx += xi; sy += yi;
    sxx += xi * xi; syy += yi * yi; sxy += xi * yi;
  }
  const nx = n;
  const mx = sx / nx;
  const my = sy / nx;
  const cov = (sxy / nx) - (mx * my);
  const varx = (sxx / nx) - (mx * mx);
  const vary = (syy / nx) - (my * my);
  if (!(varx > 0) || !(vary > 0)) return {};
  const corr = cov / Math.sqrt(varx * vary);
  const beta = cov / vary; // beta of x relative to y (x = MSTR, y = BTC)
  return { corr, beta };
}
