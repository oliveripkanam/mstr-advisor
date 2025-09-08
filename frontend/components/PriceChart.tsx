"use client";
import React, { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#111827' },
      width: ref.current.clientWidth,
      height: 360,
      rightPriceScale: { visible: true },
      timeScale: { rightOffset: 2, fixLeftEdge: true },
      grid: { vertLines: { color: '#f3f4f6' }, horzLines: { color: '#f3f4f6' } },
    });
    const series: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries();
    fetch('/data/public/mstr_ohlcv.json')
      .then((r) => r.json())
      .then((bars: Bar[]) => {
        series.setData(toChartData(bars));
        chart.timeScale().fitContent();
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
  }, []);

  return <div ref={ref} className="w-full" />;
}


