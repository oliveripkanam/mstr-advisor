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

export function MonitorTiles({ onTileClick, timeframe = '15m' }: MonitorTilesProps) {
  const [btc, setBtc] = useState<Summary>({ price: 0, changePct: 0 });
  const [mstr, setMstr] = useState<Summary>({ price: 0, changePct: 0 });
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
  // Placeholder correlation for now; real calc would need closing series alignment
  const correlation = 0.73;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
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
            <div>30D Correlation: {correlation}</div>
            <div>Beta vs BTC: 1.8x</div>
          </div>
        </div>
      </Card>
    </div>
  );
}