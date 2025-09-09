"use client";
import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, ISeriesApi } from "lightweight-charts";

type Bar = { timestamp: string; open: number; high: number; low: number; close: number };

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
  const [range, setRange] = useState<"1M"|"3M"|"1Y"|"ALL">("ALL");

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#111827' },
      width: ref.current.clientWidth,
      height: 420,
      rightPriceScale: { visible: true, borderColor: '#e5e7eb' },
      leftPriceScale: { visible: false },
      timeScale: { rightOffset: 2, fixLeftEdge: true, borderColor: '#e5e7eb' },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
      crosshair: { horzLine: { color: '#9ca3af' }, vertLine: { color: '#9ca3af' } },
    });
    const series: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor: '#10b981', downColor: '#ef4444', borderUpColor: '#10b981', borderDownColor: '#ef4444', wickUpColor: '#10b981', wickDownColor: '#ef4444'
    });
    fetch('data/public/mstr_ohlcv.json')
      .then((r) => r.json())
      .then((bars: Bar[]) => {
        const data = toChartData(bars);
        series.setData(data);
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
      })
      .catch(() => {});
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
          <button key={r} className={`rounded px-2 py-1 text-xs border ${range===r? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'}`} onClick={()=>setRange(r)}>{r}</button>
        ))}
      </div>
      <div ref={ref} className="w-full rounded border border-gray-200" />
    </div>
  );
}


