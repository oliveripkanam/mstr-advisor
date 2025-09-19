import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface LiquidationHeatmapProps {
  onPriceHover: (price: number) => void;
}

type LiqEvent = {
  ts: number; // ms
  price: number;
  side: 'long' | 'short'; // long liquidation = forced sell, short liquidation = forced buy
  qty: number; // in BTC
  usd: number; // price * qty
  exchange: 'BINANCE' | 'BYBIT' | 'BITMEX' | 'OKX';
};

function formatMillions(n: number): string {
  if (!isFinite(n)) return '-';
  const m = n / 1_000_000;
  return m >= 10 ? `${m.toFixed(0)}M` : `${m.toFixed(1)}M`;
}

async function fetchCurrentBtcPrice(): Promise<number> {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    if (!r.ok) throw new Error('price failed');
    const j = await r.json();
    const p = Number(j?.price);
    return isFinite(p) ? p : 0;
  } catch {
    return 0;
  }
}

export function LiquidationHeatmap({ onPriceHover }: LiquidationHeatmapProps) {
  const [events, setEvents] = useState<LiqEvent[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [rangeMode, setRangeMode] = useState<'24h' | '48h' | '7d'>('24h');
  const [colorMode, setColorMode] = useState<'viridis' | 'sided'>('sided');
  const [intensityScale, setIntensityScale] = useState<'linear' | 'log'>('log');
  const [priceSeries, setPriceSeries] = useState<Array<{ ts: number; close: number }>>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const wsBybitRef = useRef<WebSocket | null>(null);
  const wsBitmexRef = useRef<WebSocket | null>(null);
  const wsOkxRef = useRef<WebSocket | null>(null);

  // Exchange view toggles (only filter view; connections remain open)
  const [enabledExchanges, setEnabledExchanges] = useState<{ BINANCE: boolean; BYBIT: boolean; BITMEX: boolean }>({
    BINANCE: true,
    BYBIT: true,
    BITMEX: true,
  });
  // OKX toggle will be added after fetching ctVal
  const [enabledOkx, setEnabledOkx] = useState<boolean>(true);

  // OKX instrument contract value (ctVal) to convert contracts -> BTC qty
  const [okxCtVal, setOkxCtVal] = useState<number>(0.01); // sensible default; will fetch real value

  // Fetch current price initially and every 15s
  useEffect(() => {
    let cancel = false;
    async function tick() {
      const p = await fetchCurrentBtcPrice();
      if (!cancel && p > 0) setCurrentPrice(p);
    }
    tick();
    const id = setInterval(tick, 15000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  // Connect to Binance Futures liquidation stream and aggregate events
  useEffect(() => {
    try {
      const ws = new WebSocket('wss://fstream.binance.com/ws/!forceOrder@arr');
      wsRef.current = ws;
      ws.addEventListener('message', (ev) => {
        try {
          const data = JSON.parse(ev.data as string);
          // The aggregate stream may deliver an array of events or a single wrapper with .o
          const items: any[] = Array.isArray(data) ? data : [data];
          const now = Date.now();
          const newEvents: LiqEvent[] = [];
          for (const it of items) {
            const o = it?.o ?? it; // payload object
            const sym = String(o?.s || o?.symbol || '').toUpperCase();
            if (sym !== 'BTCUSDT') continue;
            const sideRaw = String(o?.S || o?.side || '').toUpperCase();
            const price = Number(o?.p || o?.ap || o?.price);
            const qty = Number(o?.q || o?.qty || o?.origQty);
            const ts = Number(o?.E || o?.T || it?.E || it?.eventTime || now);
            if (!isFinite(price) || !isFinite(qty)) continue;
            // Convention: forced SELL closes a long => long liquidation; forced BUY closes a short => short liquidation
            const side: 'long' | 'short' = sideRaw === 'SELL' ? 'long' : 'short';
            newEvents.push({ ts, price, side, qty, usd: price * qty, exchange: 'BINANCE' });
          }
          if (newEvents.length) {
            setEvents((prev) => {
              const merged = [...prev, ...newEvents];
              // prune to max horizon (7d) to bound memory
              const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
              return merged.filter(e => e.ts >= cutoff);
            });
          }
        } catch {}
      });
      return () => { try { ws.close(); } catch {} wsRef.current = null; };
    } catch {
      // ignore
    }
  }, []);

  // Connect to Bybit public WS (All Liquidation). Subscribe to both the new and deprecated topics to maximize coverage.
  useEffect(() => {
    try {
      const ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
      wsBybitRef.current = ws;
      ws.addEventListener('open', () => {
        try {
          // Prefer all_liquidation (all symbols); filter in handler. Also subscribe deprecated per-symbol as fallback.
          ws.send(JSON.stringify({ op: 'subscribe', args: ['all_liquidation'] }));
          ws.send(JSON.stringify({ op: 'subscribe', args: ['liquidation.BTCUSDT'] }));
        } catch {}
      });
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          const topic = String(msg?.topic || '');
          const type = String(msg?.type || '');
          const data = msg?.data;
          const rows: any[] = Array.isArray(data) ? data : data ? [data] : [];
          const newEvents: LiqEvent[] = [];
          for (const row of rows) {
            const symbol = String(row?.symbol || '').toUpperCase();
            if (symbol && symbol !== 'BTCUSDT') continue;
            const sideRaw = String(row?.side || row?.S || '').toLowerCase(); // 'Buy' | 'Sell' indicates liquidated position side per docs
            const price = Number(row?.price || row?.p);
            const size = Number(row?.size || row?.qty);
            const ts = Number(row?.updatedTime || row?.ts || msg?.ts || Date.now());
            if (!isFinite(price) || !isFinite(size)) continue;
            // Mapping per Bybit docs: Buy => long position liquidated; Sell => short liquidated
            const side: 'long' | 'short' = sideRaw === 'buy' ? 'long' : 'short';
            const usd = size; // for linear USDT perps, 1 contract ~ 1 USDT
            const qtyBtc = price > 0 ? usd / price : 0; // convert to BTC qty
            newEvents.push({ ts, price, side, qty: qtyBtc, usd, exchange: 'BYBIT' });
          }
          if (newEvents.length) {
            setEvents((prev) => {
              const merged = [...prev, ...newEvents];
              const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
              return merged.filter(e => e.ts >= cutoff);
            });
          }
        } catch {}
      });
      return () => { try { ws.close(); } catch {} wsBybitRef.current = null; };
    } catch {
      // ignore
    }
  }, []);

  // Fetch OKX instrument metadata (ctVal) for BTC-USDT-SWAP
  useEffect(() => {
    let cancelled = false;
    async function loadCtVal() {
      try {
        const r = await fetch('/proxy/okx/api/v5/public/instruments?instType=SWAP&instId=BTC-USDT-SWAP');
        if (!r.ok) return;
        const j = await r.json();
        const row = j?.data?.[0];
        // ctVal is a string, ctValCcy indicates unit (BTC for coin qty). For BTC-USDT-SWAP it's typically BTC.
        const cv = Number(row?.ctVal);
        if (!cancelled && isFinite(cv) && cv > 0) setOkxCtVal(cv);
      } catch {}
    }
    loadCtVal();
    return () => { cancelled = true; };
  }, []);

  // Connect to OKX public WS liquidation orders channel for BTC-USDT-SWAP
  useEffect(() => {
    try {
      const ws = new WebSocket('wss://ws.okx.com:8443/ws/v5/public');
      wsOkxRef.current = ws;
      ws.addEventListener('open', () => {
        try {
          const sub = {
            op: 'subscribe',
            args: [
              { channel: 'liquidation-orders', instType: 'SWAP', instId: 'BTC-USDT-SWAP' },
            ],
          };
          ws.send(JSON.stringify(sub));
        } catch {}
      });
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (!msg?.data) return;
          const rows: any[] = Array.isArray(msg.data) ? msg.data : [msg.data];
          const newEvents: LiqEvent[] = [];
          for (const row of rows) {
            const instId = String(row?.instId || '').toUpperCase();
            if (instId && instId !== 'BTC-USDT-SWAP') continue;
            // Price can be in px or bkPx depending on message; pick any valid numeric
            const priceRaw = row?.px ?? row?.bkPx ?? row?.fillPx ?? row?.last ?? row?.markPx;
            const price = Number(priceRaw);
            const sz = Number(row?.sz);
            const sideRaw = String(row?.side || '').toLowerCase(); // 'buy' | 'sell'
            const ts = Number(row?.ts || row?.uTime || Date.now());
            if (!isFinite(price) || price <= 0) continue;
            if (!isFinite(sz) || sz <= 0) continue;
            const side: 'long' | 'short' = sideRaw === 'sell' ? 'long' : 'short';
            // Convert contracts -> BTC using ctVal; if not available, approximate from notionalUsd if provided
            let qtyBtc = okxCtVal > 0 ? sz * okxCtVal : 0;
            if (!qtyBtc && isFinite(Number(row?.notionalUsd))) {
              const usd = Number(row.notionalUsd);
              qtyBtc = usd / price;
            }
            const usd = price * qtyBtc;
            if (!isFinite(qtyBtc) || qtyBtc <= 0) continue;
            newEvents.push({ ts, price, side, qty: qtyBtc, usd, exchange: 'OKX' });
          }
          if (newEvents.length) {
            setEvents((prev) => {
              const merged = [...prev, ...newEvents];
              const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
              return merged.filter(e => e.ts >= cutoff);
            });
          }
        } catch {}
      });
      return () => { try { ws.close(); } catch {} wsOkxRef.current = null; };
    } catch {
      // ignore
    }
  }, [okxCtVal]);

  // Connect to BitMEX liquidation stream
  useEffect(() => {
    try {
      const ws = new WebSocket('wss://ws.bitmex.com/realtime?subscribe=liquidation');
      wsBitmexRef.current = ws;
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg?.table !== 'liquidation' || !msg?.data) return;
          const rows: any[] = Array.isArray(msg.data) ? msg.data : [];
          const newEvents: LiqEvent[] = [];
          for (const row of rows) {
            const symbol = String(row?.symbol || '').toUpperCase();
            if (symbol !== 'XBTUSD') continue;
            const sideRaw = String(row?.side || '').toLowerCase(); // 'Buy' or 'Sell' indicates liquidation order side
            const price = Number(row?.price);
            const contracts = Number(row?.leavesQty ?? row?.orderQty ?? row?.qty);
            const ts = row?.timestamp ? Date.parse(row.timestamp) : Date.now();
            if (!isFinite(price) || !isFinite(contracts)) continue;
            // On BitMEX inverse perps, liquidation order side Sell => long liquidation; Buy => short liquidation
            const side: 'long' | 'short' = sideRaw === 'sell' ? 'long' : 'short';
            const usd = contracts; // XBTUSD: 1 contract ~ 1 USD
            const qtyBtc = price > 0 ? usd / price : 0;
            newEvents.push({ ts, price, side, qty: qtyBtc, usd, exchange: 'BITMEX' });
          }
          if (newEvents.length) {
            setEvents((prev) => {
              const merged = [...prev, ...newEvents];
              const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
              return merged.filter(e => e.ts >= cutoff);
            });
          }
        } catch {}
      });
      return () => { try { ws.close(); } catch {} wsBitmexRef.current = null; };
    } catch {
      // ignore
    }
  }, []);

  // Preload recent liquidation history to populate grid immediately
  useEffect(() => {
    let cancelled = false;
    async function fetchJson(url: string) {
      try {
        const r = await fetch(url);
        if (r.ok) return await r.json();
      } catch {}
      return null;
    }
    async function preload() {
      // Choose preload window based on range
      const horizonHours = rangeMode === '7d' ? 7 * 24 : rangeMode === '48h' ? 48 : 24;
      // Binance endpoint supports limit=1000; we may need multiple pages to approximate horizon
      // We'll fetch up to 3 pages in descending time order if available
  const pageLimits = [1000, 1000, 1000];
  const baseUrl = `/proxy/binance-fapi/futures/data/liquidationOrders?symbol=BTCUSDT`;
      const collected: LiqEvent[] = [];
      for (let i = 0; i < pageLimits.length; i++) {
        const url = `${baseUrl}&limit=${pageLimits[i]}`;
        const j = await fetchJson(url);
        if (!j || !Array.isArray(j)) break;
        for (const it of j) {
          const sideRaw = String(it?.side || '').toUpperCase();
          const side: 'long' | 'short' = sideRaw === 'SELL' ? 'long' : 'short';
          const price = Number(it?.price);
          const qty = Number(it?.origQty || it?.qty || it?.executedQty);
          const ts = Number(it?.time || it?.T || Date.now());
          if (!isFinite(price) || !isFinite(qty) || !isFinite(ts)) continue;
          collected.push({ ts, price, side, qty, usd: price * qty, exchange: 'BINANCE' });
        }
        // If we already have enough hours span, stop
        const minTs = Math.min(...collected.map(e => e.ts));
        if (Date.now() - minTs >= horizonHours * 3600 * 1000) break;
        // No pagination cursor available; multiple requests will return overlapping data; acceptable for coarse preload
      }

      // OKX REST preload (limited to recent records)
      try {
  const okxUrl = `/proxy/okx/api/v5/public/liquidation-orders?instType=SWAP&instId=BTC-USDT-SWAP&state=filled&limit=200`;
        const j = await fetchJson(okxUrl);
        const rows: any[] = j?.data || [];
        for (const row of rows) {
          const price = Number(row?.px ?? row?.bkPx);
          const sz = Number(row?.sz);
          const ts = Number(row?.ts || row?.uTime || Date.now());
          const sideRaw = String(row?.side || '').toLowerCase();
          if (!isFinite(price) || price <= 0) continue;
          if (!isFinite(sz) || sz <= 0) continue;
          const side: 'long' | 'short' = sideRaw === 'sell' ? 'long' : 'short';
          const qtyBtc = okxCtVal > 0 ? sz * okxCtVal : 0;
          if (!qtyBtc) continue;
          collected.push({ ts, price, side, qty: qtyBtc, usd: price * qtyBtc, exchange: 'OKX' });
        }
      } catch {}

      if (!cancelled && collected.length) {
        const cutoff = Date.now() - horizonHours * 3600 * 1000;
        setEvents((prev) => {
          const merged = [...prev.filter(e => e.ts >= cutoff), ...collected.filter(e => e.ts >= cutoff)];
          // Bound memory to 7d max
          const maxCutoff = Date.now() - 7 * 24 * 3600 * 1000;
          return merged.filter(e => e.ts >= maxCutoff);
        });
      }
    }
    preload();
    return () => { cancelled = true; };
  }, [rangeMode, okxCtVal]);

  // Derive price bins around current price (fixed ~$250 steps for stability)
  const [binMode, setBinMode] = useState<'auto' | 50 | 100 | 250>('auto');
  const priceBins = useMemo(() => {
    const levels = 24;
    const center = currentPrice > 0 ? currentPrice : 64000;
    let step: number;
    let bins: number[] = [];
    if (binMode === 'auto') {
      const span = Math.max(4000, center * 0.08); // ~+/-4% or at least $4k window
      const minP = center - span;
      const maxP = center + span;
      const roughStep = (maxP - minP) / levels;
      step = Math.max(50, Math.round(roughStep / 50) * 50); // snap to $50 increments
      for (let p = minP; p <= maxP; p += step) bins.push(p);
    } else {
      step = binMode as number;
      const minP = center - step * (levels / 2);
      for (let i = 0; i < levels; i++) bins.push(minP + i * step);
    }
    const actualLevels = bins.length;
    return { bins, step, levels: actualLevels };
  }, [currentPrice, binMode]);

  // Time bucket spec per range
  const rangeSpec = useMemo(() => {
    if (rangeMode === '24h') return { horizonMs: 24 * 3600 * 1000, bucketMs: 5 * 60 * 1000 } as const; // 5m buckets (288 cols)
    if (rangeMode === '48h') return { horizonMs: 48 * 3600 * 1000, bucketMs: 15 * 60 * 1000 } as const; // 15m (192 cols)
    return { horizonMs: 7 * 24 * 3600 * 1000, bucketMs: 60 * 60 * 1000 } as const; // 1h (168 cols)
  }, [rangeMode]);

  // Build heatmap matrix: rows = price bins (desc), cols = rolling time buckets
  const { matrix, maxCell, topClusters, cols, startTs } = useMemo(() => {
    const levels = priceBins.bins.length;
    const cols = Math.max(1, Math.ceil(rangeSpec.horizonMs / rangeSpec.bucketMs));
    const now = Date.now();
    const startTs = now - cols * rangeSpec.bucketMs;
    const mat: { long: number; short: number; total: number }[][] = Array.from({ length: levels }, () => Array.from({ length: cols }, () => ({ long: 0, short: 0, total: 0 })));
    const totalsByRow = new Array(levels).fill(0);

    // smoothing kernel across price rows to form bands
    const kernel = [0.25, 0.5, 0.25]; // applies to row-1,row,row+1

    // Apply exchange filters
    const filtered = events.filter((e) => {
      if (e.exchange === 'OKX') return enabledOkx;
      return (enabledExchanges as any)[e.exchange];
    });

    for (const e of filtered) {
      if (e.ts < startTs || e.ts > now) continue;
      const idx = Math.floor((e.price - priceBins.bins[0]) / priceBins.step);
      if (idx < 0 || idx >= levels) continue;
      const col = Math.floor((e.ts - startTs) / rangeSpec.bucketMs);
      if (col < 0 || col >= cols) continue;
      for (let k = -1; k <= 1; k++) {
        const rowIdx = idx + k;
        if (rowIdx < 0 || rowIdx >= levels) continue;
        const row = levels - 1 - rowIdx; // higher prices at top
        const w = kernel[k + 1];
        const add = e.usd * w;
        if (e.side === 'long') mat[row][col].long += add; else mat[row][col].short += add;
        mat[row][col].total += add;
        totalsByRow[row] += add;
      }
    }

    // Local horizontal smoothing (5-tap convolution) to avoid smearing across the whole row
    const kernelTime = [0.1, 0.2, 0.4, 0.2, 0.1];
    const base = mat.map(row => row.map(cell => ({...cell})));
    for (let r = 0; r < levels; r++) {
      for (let c = 0; c < cols; c++) {
        let longSum = 0, shortSum = 0;
        for (let t = -2; t <= 2; t++) {
          const cc = c + t;
          if (cc < 0 || cc >= cols) continue;
          const w = kernelTime[t + 2];
          longSum += base[r][cc].long * w;
          shortSum += base[r][cc].short * w;
        }
        mat[r][c].long = longSum;
        mat[r][c].short = shortSum;
        mat[r][c].total = longSum + shortSum;
      }
    }

    const maxCell = mat.reduce((m, row) => Math.max(m, ...row.map(c => c.total)), 0) || 1;
    // Top 3 clusters by row total
    const top = totalsByRow
      .map((v, r) => ({ price: Math.round(priceBins.bins[levels - 1 - r]), total: v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
    return { matrix: mat, maxCell, topClusters: top, cols, startTs };
  }, [events, priceBins, rangeSpec]);

  // Fetch klines to draw price overlay path aligned with buckets
  useEffect(() => {
    let cancelled = false;
    const interval = rangeMode === '24h' ? '5m' : rangeMode === '48h' ? '15m' : '1h';
    const intervalMs = rangeMode === '24h' ? 5 * 60 * 1000 : rangeMode === '48h' ? 15 * 60 * 1000 : 60 * 60 * 1000;
    const limit = Math.min(1000, Math.max(50, Math.ceil(rangeSpec.horizonMs / intervalMs) + 5));
    async function run() {
      try {
        const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
        const r = await fetch(url);
        if (!r.ok) return;
        const j = await r.json();
        if (!Array.isArray(j)) return;
        const arr = j.map((k: any) => ({ ts: Number(k[0]), close: Number(k[4]) })) as Array<{ ts: number; close: number }>;
        if (!cancelled) setPriceSeries(arr);
      } catch {}
    }
    run();
    return () => { cancelled = true; };
  }, [rangeMode, rangeSpec]);

  const getIntensityColor = (longLiq: number, shortLiq: number) => {
    const total = longLiq + shortLiq;
    const intensity = Math.min((total / maxCell) * 0.7, 0.7);
    if (longLiq > shortLiq) {
      return `rgba(34, 197, 94, ${intensity})`; // green for long liquidations
    }
    return `rgba(220, 38, 38, ${intensity})`; // red for short liquidations
  };

  // Minimal viridis implementation using 10-stop gradient
  const viridisStops = ['#440154','#482878','#3e4989','#31688e','#26828e','#1f9e89','#35b779','#6ece58','#b5de2b','#fde725'];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  function hexToRgb(h: string) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
    if (!m) return [0,0,0];
    return [parseInt(m[1],16), parseInt(m[2],16), parseInt(m[3],16)];
  }
  function viridisColor(t: number) {
    const x = Math.max(0, Math.min(1, t));
    const scaled = x * (viridisStops.length - 1);
    const i = Math.floor(scaled);
    const f = scaled - i;
    const c1 = hexToRgb(viridisStops[i]);
    const c2 = hexToRgb(viridisStops[Math.min(i + 1, viridisStops.length - 1)]);
    const r = Math.round(lerp(c1[0], c2[0], f));
    const g = Math.round(lerp(c1[1], c2[1], f));
    const b = Math.round(lerp(c1[2], c2[2], f));
    return `rgb(${r}, ${g}, ${b})`;
  }
  const minPaintT = 0.035; // suppress near-zero purple haze in viridis

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="font-medium">BTC Liquidation Heatmap</h3>
          <div className="flex items-center gap-2">
            {topClusters.map((cluster) => (
              <Badge key={cluster.price} variant="outline" className="text-xs">
                ${cluster.price.toLocaleString()}: {formatMillions(cluster.total)}
              </Badge>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={rangeMode} onValueChange={(v) => setRangeMode(v as any)}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24h</SelectItem>
              <SelectItem value="48h">48h</SelectItem>
              <SelectItem value="7d">7D</SelectItem>
            </SelectContent>
          </Select>

          <Button variant={colorMode === 'viridis' ? 'default' : 'outline'} size="sm" onClick={() => setColorMode(m => m === 'viridis' ? 'sided' : 'viridis')}>
            {colorMode === 'viridis' ? 'Viridis' : 'By Side'}
          </Button>

          {/* Intensity scale toggle */}
          <Button
            variant={intensityScale === 'linear' ? 'outline' : 'default'}
            size="sm"
            onClick={() => setIntensityScale(s => s === 'linear' ? 'log' : 'linear')}
            title="Toggle intensity scale"
          >
            {intensityScale === 'linear' ? 'Linear' : 'Log'}
          </Button>

          {/* Fixed bin width selector */}
          <Select value={String(binMode)} onValueChange={(v) => setBinMode((v === 'auto' ? 'auto' : Number(v)) as any)}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto bins</SelectItem>
              <SelectItem value="50">$50 bins</SelectItem>
              <SelectItem value="100">$100 bins</SelectItem>
              <SelectItem value="250">$250 bins</SelectItem>
            </SelectContent>
          </Select>

          {/* Exchange toggles */}
          <Button
            variant={enabledExchanges.BINANCE ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEnabledExchanges((s) => ({ ...s, BINANCE: !s.BINANCE }))}
            title="Toggle Binance"
          >
            Binance
          </Button>
          <Button
            variant={enabledExchanges.BYBIT ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEnabledExchanges((s) => ({ ...s, BYBIT: !s.BYBIT }))}
            title="Toggle Bybit"
          >
            Bybit
          </Button>
          <Button
            variant={enabledExchanges.BITMEX ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEnabledExchanges((s) => ({ ...s, BITMEX: !s.BITMEX }))}
            title="Toggle BitMEX"
          >
            BitMEX
          </Button>
          <Button
            variant={enabledOkx ? 'default' : 'outline'}
            size="sm"
            onClick={() => setEnabledOkx((v) => !v)}
            title="Toggle OKX"
          >
            OKX
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded"></div>
            <span>Long Liquidations</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-400 rounded"></div>
            <span>Short Liquidations</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="relative overflow-hidden">
          <div className="rounded-lg p-2 bg-border">
            {!events.length && (
              <div className="text-xs text-muted-foreground mb-2">
                No liquidation data yet. Waiting for websocket events. If this persists, check network/proxy settings.
              </div>
            )}
            {/* Time labels */}
            <div
              className="grid gap-px mb-1"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: cols }, (_, c) => {
                const ts = startTs + c * rangeSpec.bucketMs;
                const d = new Date(ts);
                const label = rangeMode === '7d'
                  ? `${(d.getUTCMonth()+1).toString().padStart(2,'0')}/${d.getUTCDate().toString().padStart(2,'0')}\n${d.getUTCHours().toString().padStart(2,'0')}`
                  : d.getUTCHours().toString().padStart(2, '0');
                // Downsample labels to avoid clutter
                const show = (rangeMode === '24h' && c % 12 === 0) || (rangeMode === '48h' && c % 8 === 0) || (rangeMode === '7d' && c % 12 === 0);
                return (
                  <div key={c} className="text-[10px] text-center text-muted-foreground py-1 whitespace-pre">
                    {show ? label : ''}
                  </div>
                );
              })}
            </div>
            
            {Array.from({ length: priceBins.bins.length }).map((_, r) => (
              <div
                key={r}
                className="grid gap-px"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: cols }).map((__, c) => {
                  const cell = matrix[r][c];
                  const priceLevel = Math.round(priceBins.bins[priceBins.bins.length - 1 - r]);
                  const lin = Math.min(1, (cell.total || 0) / (maxCell || 1));
                  const t = intensityScale === 'linear' ? lin : (() => {
                    const num = Math.log1p(cell.total || 0);
                    const den = Math.log1p(maxCell || 1);
                    return Math.min(1, den > 0 ? num / den : 0);
                  })();
                  const color = colorMode === 'viridis' ? (t > minPaintT ? viridisColor(t) : 'transparent') : getIntensityColor(cell.long, cell.short);
                  const ts = startTs + c * rangeSpec.bucketMs;
                  const d = new Date(ts);
                  return (
                    <TooltipProvider key={`${r}-${c}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className="h-4 cursor-pointer rounded-sm"
                            style={{ backgroundColor: (t > 0 ? color : 'transparent') }}
                            onMouseEnter={() => onPriceHover(priceLevel)}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-xs space-y-1">
                            <div>Time (UTC): {d.toISOString().slice(11,16)}</div>
                            <div>Price: ${priceLevel.toLocaleString()}</div>
                            <div>Long Liq: {formatMillions(cell.long)}</div>
                            <div>Short Liq: {formatMillions(cell.short)}</div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            ))}
          </div>
          
          {/* Price overlay (SVG) */}
          <svg className="absolute inset-0 pointer-events-none" viewBox={`0 0 ${cols} ${priceBins.bins.length}`} preserveAspectRatio="none">
            {/* Day separators at UTC 00:00 */}
            {Array.from({ length: cols }).map((_, c) => {
              const ts = startTs + c * rangeSpec.bucketMs;
              const d = new Date(ts);
              const isDayStart = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
              if (!isDayStart) return null;
              return (
                <line key={`sep-${c}`} x1={c} y1={0} x2={c} y2={priceBins.bins.length} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
              );
            })}
            <polyline
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="0.8"
              points={(() => {
                if (!priceSeries.length) return '';
                const minTs = startTs; const maxTs = startTs + cols * rangeSpec.bucketMs;
                const pts: string[] = [];
                for (const p of priceSeries) {
                  if (p.ts < minTs || p.ts > maxTs) continue;
                  const c = Math.floor((p.ts - startTs) / rangeSpec.bucketMs);
                  const idx = Math.floor((p.close - priceBins.bins[0]) / priceBins.step);
                  if (c < 0 || c >= cols || idx < 0 || idx >= priceBins.bins.length) continue;
                  const r = priceBins.bins.length - 1 - idx;
                  pts.push(`${c},${r}`);
                }
                return pts.join(' ');
              })()}
            />
          </svg>

          {/* Price axis */}
          <div className="absolute left-0 top-8 -ml-16 space-y-2">
            {Array.from({ length: priceBins.bins.length }).map((_, r) => {
              const priceLevel = Math.round(priceBins.bins[priceBins.bins.length - 1 - r]);
              return (
                <div key={r} className="text-xs text-muted-foreground h-4 flex items-center">
                  ${(priceLevel / 1000).toFixed(0)}k
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}