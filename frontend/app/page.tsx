"use client";
import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import HotPreview from '../components/HotPreview';
const PriceChart = dynamic(() => import('../components/PriceChart'), { ssr: false });
import RecommendationCard from '../components/RecommendationCard';

function LastUpdatedBadge() {
  const [ts, setTs] = React.useState<string | null>(null);
  const [stale, setStale] = React.useState<boolean>(false);
  React.useEffect(() => {
    fetch('data/public/status.json')
      .then((r) => r.json())
      .then((d) => { setTs(d?.last_run_utc || null); setStale(Boolean(d?.stale)); })
      .catch(() => {});
  }, []);
  if (!ts) return null;
  return (
    <span className={`ml-2 rounded px-2 py-0.5 text-xs ${stale? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`} title={stale? 'Data may be stale' : 'Data fresh'}>
      Updated: {ts}
    </span>
  );
}

export default function HomePage() {
  return (
    <main>
      <div className="mb-4 flex items-center gap-2">
        <p className="text-sm text-gray-700">MSTR daily price chart:</p>
        <LastUpdatedBadge />
      </div>
      <HotPreview />
      {/* KPI bar */}
      <KpiBar />
      <PriceChart />
      <div className="mt-6">
        <RecommendationCard />
      </div>
      <div className="mt-4 text-sm">
        <Link className="text-primary underline focus:outline-none focus:ring-2 focus:ring-primary mr-4" href="/backtests">Backtests →</Link>
        <Link className="text-primary underline focus:outline-none focus:ring-2 focus:ring-primary mr-4" href="/status">Data Status →</Link>
        <Link className="text-primary underline focus:outline-none focus:ring-2 focus:ring-primary mr-4" href="/predict">Predict →</Link>
        <Link className="text-primary underline focus:outline-none focus:ring-2 focus:ring-primary mr-4" href="/news">News →</Link>
        <Link className="text-primary underline focus:outline-none focus:ring-2 focus:ring-primary" href="/info">Info & Methodology →</Link>
      </div>
    </main>
  );
}

function KpiBar() {
  const [vals, setVals] = React.useState<{ price?: number; changePct?: number; rsi?: number; gap50?: number; vix?: string; livePrice?: boolean; liveDay?: boolean; sma50?: number } | null>(null);
  React.useEffect(() => {
    const REPO = 'oliveripkanam/mstr-advisor';
    const BRANCH = 'hotdata';
    const PATH = 'data/public/hot.json';
    const hotUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PATH}?t=${Date.now()}`;
    Promise.all([
      fetch('data/public/mstr_technical.json').then(r=>r.json()).catch(()=>null),
      fetch('data/public/mstr_crossasset.json').then(r=>r.json()).catch(()=>null),
      fetch(hotUrl, { cache: 'no-store' }).then(r=> r.ok? r.json(): null).catch(()=>null)
    ]).then(([tech, xas, hot]) => {
      try {
        const t = Array.isArray(tech) && tech.length? tech[tech.length-1] : null;
        const prev = Array.isArray(tech) && tech.length>1? tech[tech.length-2] : null;
        let price = t? Number(t.close) : undefined;
        let prevClose = prev? Number(prev.close) : undefined;
        let changePct = (price && prevClose)? ((price - prevClose) / prevClose) * 100 : undefined;
        let livePrice = false, liveDay = false;
        if (hot && typeof hot.last_price === 'number') {
          price = Number(hot.last_price);
          livePrice = true;
        }
        if (hot && typeof hot.prev_close === 'number' && typeof hot.last_price === 'number') {
          changePct = ((Number(hot.last_price) - Number(hot.prev_close)) / Number(hot.prev_close)) * 100;
          liveDay = true;
        }
        const rsi = t? Number(t.rsi14) : undefined;
        const sma50 = t? Number(t.sma50) : undefined;
        const gap50 = (price && sma50)? ((price - sma50)/sma50)*100 : undefined;
        const x = Array.isArray(xas) && xas.length? xas[xas.length-1] : null;
        const vix = x && x.vix_band ? String(x.vix_band) : undefined;
        setVals({ price, changePct, rsi, gap50, vix, livePrice, liveDay, sma50 });
      } catch { setVals(null); }
    }).catch(()=>{});
    const interval = setInterval(async () => {
      try {
        const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${PATH}?t=${Date.now()}`;
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return;
        const hot = await r.json();
        if (!hot || typeof hot.last_price !== 'number') return;
        setVals((prev) => {
          if (!prev) return prev;
          const price = Number(hot.last_price);
          const prevClose = typeof hot.prev_close === 'number' ? Number(hot.prev_close) : undefined;
          const changePct = (prevClose !== undefined) ? ((price - prevClose) / prevClose) * 100 : prev.changePct;
          const gap50 = (prev.sma50 && typeof prev.sma50 === 'number') ? ((price - prev.sma50) / prev.sma50) * 100 : prev.gap50;
          return { ...prev, price, changePct, gap50, livePrice: true, liveDay: prevClose !== undefined ? true : prev.liveDay };
        });
      } catch {}
    }, 90000);
    return () => { try { clearInterval(interval); } catch {} };
  }, []);
  if (!vals) return null;
  const chip = (label: string, value: string, tone: 'neutral'|'good'|'bad'='neutral') => (
    <div className={`rounded border px-3 py-1 text-xs ${tone==='good'? 'border-green-200 bg-green-50 text-green-800' : tone==='bad'? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50 text-gray-800'}`}>{label}: {value}</div>
  );
  const toneChange = (vals.changePct ?? 0) > 0 ? 'good' : (vals.changePct ?? 0) < 0 ? 'bad' : 'neutral';
  const toneGap = (vals.gap50 ?? 0) >= 0 ? 'good' : 'bad';
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {typeof vals.price === 'number' && chip(vals.livePrice? 'Price (Live)' : 'Price', `$${vals.price.toFixed(2)}`)}
      {typeof vals.changePct === 'number' && chip(vals.liveDay? 'Day (Live)' : 'Day', `${vals.changePct.toFixed(2)}%`, toneChange as any)}
      {typeof vals.rsi === 'number' && chip('RSI14', vals.rsi.toFixed(1), vals.rsi>=70? 'bad' : vals.rsi<=30? 'good' : 'neutral' as any)}
      {typeof vals.gap50 === 'number' && chip('vs 50DMA', `${vals.gap50.toFixed(1)}%`, toneGap as any)}
      {vals.vix && chip('VIX', vals.vix.toUpperCase(), vals.vix==='high'? 'bad' : vals.vix==='low'? 'good' : 'neutral' as any)}
    </div>
  );
}


