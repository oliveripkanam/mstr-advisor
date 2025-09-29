import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './ui/card';

interface SeriesPoint { ts: number; value: number; }

interface Snapshot {
  fundingRate8h?: number; // 8h rate (e.g., 0.01 => 1%)
  nextFundingTime?: number; // ms
  oiNotionalUsd?: number; // USD
  lastUpdated?: number; // ms
}

function fmtPct(x?: number) {
  if (!x && x !== 0) return '-';
  return `${(x * 100).toFixed(3)}%`;
}
function fmtMoney(x?: number) {
  if (!x && x !== 0) return '-';
  const n = Number(x);
  if (!isFinite(n)) return '-';
  if (n >= 1e9) return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function useInterval(cb: () => void, ms: number) {
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; }, [cb]);
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export default function PerpFundingOI() {
  const [snap, setSnap] = useState<Snapshot>({});
  const [oiSeries, setOiSeries] = useState<SeriesPoint[]>([]);

  async function getJson(url: string) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('fetch failed');
    return r.json();
  }

  async function fetchBinance() {
    try {
      const prem = await getJson('/proxy/binance-fapi/fapi/v1/premiumIndex?symbol=BTCUSDT');
      const fundingRate8h = Number(prem?.lastFundingRate ?? prem?.lastFundingRate);
      const nextFundingTime = Number(prem?.nextFundingTime);
      const oiHist = await getJson('/proxy/binance-fapi/futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=200');
      const series: SeriesPoint[] = Array.isArray(oiHist)
        ? oiHist.map((p: any) => ({ ts: Number(p.timestamp), value: Number(p.sumOpenInterestValue) }))
        : [];
      const oiNotionalUsd = series.length ? series[series.length - 1].value : undefined;
      setOiSeries(series);
      setSnap({ fundingRate8h, nextFundingTime, oiNotionalUsd, lastUpdated: Date.now() });
    } catch {}
  }

  useEffect(() => { fetchBinance(); }, []);
  useInterval(() => { fetchBinance(); }, 30_000);

  const activeSeries = oiSeries;
  const latest = snap;
  const annualized = latest?.fundingRate8h != null ? (latest.fundingRate8h * 3 * 365) : undefined;
  const oiDelta = useMemo(() => {
    if (!activeSeries || activeSeries.length < 2) return undefined as number | undefined;
    const first = activeSeries[0].value;
    const last = activeSeries[activeSeries.length - 1].value;
    if (!isFinite(first) || first <= 0 || !isFinite(last)) return undefined;
    return (last - first) / first;
  }, [activeSeries]);
  const windowHours = useMemo(() => {
    const points = activeSeries?.length ?? 0;
    if (points < 2) return undefined as number | undefined;
    const mins = (points - 1) * 5;
    return Math.max(0.1, mins / 60);
  }, [activeSeries]);
  const countdown = useMemo(() => {
    if (!latest?.nextFundingTime) return '';
    const ms = Math.max(0, latest.nextFundingTime - Date.now());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }, [latest?.nextFundingTime, latest?.lastUpdated]);

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">BTC Perp (Binance): Funding + Open Interest</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Funding (8h)</div>
          <div className="text-lg">{fmtPct(latest?.fundingRate8h)}</div>
          <div className="text-xs text-muted-foreground">Annualized: {(annualized != null ? (annualized*100).toFixed(2) + '%' : '-')}</div>
        </Card>

        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Next funding in</div>
          <div className="text-lg">{countdown || '-'}</div>
          <div className="text-xs text-muted-foreground">Last updated {latest?.lastUpdated ? Math.max(0, Math.floor((Date.now()-latest.lastUpdated)/1000)) + 's' : '-'} ago</div>
        </Card>

        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Open Interest (Notional)</div>
          <div className="text-lg">{fmtMoney(latest?.oiNotionalUsd)}</div>
          <div className="text-xs text-muted-foreground">
            Δ OI: {oiDelta != null ? `${(oiDelta*100).toFixed(2)}%` : '-'} {windowHours != null ? `(≈${windowHours.toFixed(1)}h)` : ''}
          </div>
        </Card>
      </div>

      <div className="rounded-sm border border-border p-1">
        {activeSeries.length === 0 ? (
          <div className="text-xs text-muted-foreground">No data yet. Waiting for exchange responses...</div>
        ) : (
          <svg className="w-full h-10" viewBox={`0 0 1000 100`} preserveAspectRatio="none">
            {(() => {
              // Decimate to at most ~250 points for smoothness
              const maxPts = 250;
              const vals = activeSeries.map(p => p.value);
              let min = Math.min(...vals);
              let max = Math.max(...vals);
              const span0 = max - min || 1;
              const pad = span0 * 0.06; // 6% vertical padding
              min -= pad; max += pad;
              const span = max - min || 1;
              const step = Math.max(1, Math.ceil(activeSeries.length / maxPts));
              const sampled = activeSeries.filter((_, i) => i % step === 0);
              const n = sampled.length;
              const points = sampled.map((p, i) => {
                const x = n > 1 ? (i / (n - 1)) * 1000 : 0;
                const y = 100 - ((p.value - min) / span) * 100;
                return { x, y };
              });

              function crToBezierPath(pts: {x:number,y:number}[]) {
                if (pts.length === 0) return '';
                if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
                let d = `M ${pts[0].x},${pts[0].y}`;
                for (let i = 0; i < pts.length - 1; i++) {
                  const p0 = pts[i - 1] || pts[i];
                  const p1 = pts[i];
                  const p2 = pts[i + 1];
                  const p3 = pts[i + 2] || p2;
                  const c1x = p1.x + (p2.x - p0.x) / 6;
                  const c1y = p1.y + (p2.y - p0.y) / 6;
                  const c2x = p2.x - (p3.x - p1.x) / 6;
                  const c2y = p2.y - (p3.y - p1.y) / 6;
                  d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
                }
                return d;
              }

              const d = crToBezierPath(points);
              const areaD = d + ` L ${points[points.length - 1]?.x || 0},100 L ${points[0]?.x || 0},100 Z`;

              return (
                <>
                  <defs>
                    <linearGradient id="oiGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(99,102,241,0.22)" />
                      <stop offset="100%" stopColor="rgba(99,102,241,0.0)" />
                    </linearGradient>
                  </defs>
                  <path d={areaD} fill="url(#oiGrad)" />
                  <path d={d} stroke="rgba(99, 102, 241, 0.28)" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d={d} stroke="rgba(120, 125, 255, 0.98)" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </>
              );
            })()}
          </svg>
        )}
      </div>


      <div className="mt-2 text-xs text-muted-foreground">
        Above 0% funding: longs pay shorts. Below 0%: shorts pay longs. Rising OI usually means leverage building.
      </div>
    </Card>
  );
}
