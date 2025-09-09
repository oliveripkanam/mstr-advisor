"use client";
import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, ISeriesApi } from "lightweight-charts";

type Bar = { timestamp: string; open: number; high: number; low: number; close: number; volume: number };

function toChartData(bars: Bar[]) {
  // Convert YYYY-MM-DD to epoch seconds for lightweight-charts
  return bars.map((b) => ({
    time: b.timestamp as unknown as any,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
  }));
}

export default function PriceChart() {
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<"1M"|"3M"|"1Y"|"ALL">(() => {
    if (typeof window === 'undefined') return 'ALL';
    const q = new URLSearchParams(window.location.search).get('range');
    return (q === '1M' || q === '3M' || q === '1Y' || q === 'ALL') ? (q as any) : 'ALL';
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#111827' },
      width: ref.current.clientWidth,
      height: 420,
      rightPriceScale: { visible: true, borderColor: '#e5e7eb' },
      leftPriceScale: { visible: true, borderColor: '#e5e7eb' },
      timeScale: { rightOffset: 2, fixLeftEdge: true, borderColor: '#e5e7eb' },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
      crosshair: { horzLine: { color: '#9ca3af' }, vertLine: { color: '#9ca3af' } },
    });
    const series: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderUpColor: '#10b981', borderDownColor: '#ef4444', wickUpColor: '#10b981', wickDownColor: '#ef4444'
    });
    // Allocate bottom area for volume
    series.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.2 } });
    const volSeries = chart.addHistogramSeries({
      color: '#9ca3af',
      priceFormat: { type: 'volume' },
      priceScaleId: 'left',
      priceLineVisible: false,
    });
    volSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    fetch('data/public/mstr_ohlcv.json')
      .then((r) => r.json())
      .then((bars: Bar[]) => {
        const data = toChartData(bars);
        series.setData(data);
        const volData = bars.map((b) => ({
          time: b.timestamp as unknown as any,
          value: b.volume || 0,
          color: (b.close >= b.open) ? '#10b981' : '#ef4444',
        }));
        volSeries.setData(volData as any);
        // Apply range
        const clampRange = () => {
          const n = data.length;
          if (n === 0) return;
          let fromIdx = 0;
          if (range === '1M') fromIdx = Math.max(0, n - 22);
          if (range === '3M') fromIdx = Math.max(0, n - 66);
          if (range === '1Y') fromIdx = Math.max(0, n - 252);
          const from = data[fromIdx].time as any;
          const to = data[n-1].time as any;
          chart.timeScale().setVisibleRange({ from, to });
        };
        clampRange();
        setLoading(false);
      })
      .catch(() => { setLoading(false); });
    const onResize = () => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
  }, [range]);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        {(['1M','3M','1Y','ALL'] as const).map(r => (
          <button key={r} className={`rounded px-2 py-1 text-xs border ${range===r? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`} onClick={()=>{ setRange(r); try { const url = new URL(window.location.href); url.searchParams.set('range', r); window.history.replaceState({}, '', url); } catch {} }}>{r}</button>
        ))}
        <button
          className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          onClick={() => {
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('range', range);
              navigator.clipboard.writeText(url.toString());
            } catch {}
          }}
          aria-label="Copy link with current range"
        >Copy link</button>
      </div>
      <div className="relative w-full rounded border border-gray-200">
        <div ref={ref} className="w-full h-[420px]" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-gray-600">Loading chart…</div>
        )}
        <div aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">Volume (shares)</div>
        <div aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">Price (USD)</div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-gray-500">Date</div>
      </div>
    </div>
  );
}


