"use client";
import React, { useEffect, useRef, useState } from "react";
import { createChart, ColorType, ISeriesApi } from "lightweight-charts";

type Summary = {
  days: number;
  total_return: number;
  CAGR: number;
  volatility: number;
  max_drawdown: number;
  sharpe: number;
  turnover: number;
};

type Eq = { timestamp: string; equity: number };

function useJson<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    fetch(path)
      .then((r) => r.json())
      .then((d: T) => setData(d))
      .catch(() => setData(null));
  }, [path]);
  return data;
}

export default function BacktestsPage() {
  const summary = useJson<Summary>("data/public/backtest_baseline.json");
  const equity = useJson<Eq[]>("data/public/backtest_equity.json");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !equity) return;
    const chart = createChart(ref.current, {
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#111827" },
      width: ref.current.clientWidth,
      height: 360,
      timeScale: { rightOffset: 2, fixLeftEdge: true },
      grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
    });
    const series: ISeriesApi<'Area'> = chart.addAreaSeries({ lineColor: "#0369a1", topColor: "#93c5fd", bottomColor: "#e0f2fe" });
    series.setData(
      equity.map((p) => ({ time: p.timestamp as unknown as any, value: p.equity }))
    );
    chart.timeScale().fitContent();
    const onResize = () => { if (ref.current) chart.applyOptions({ width: ref.current.clientWidth }); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, [equity]);

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Baseline Backtest</h2>
      {!summary && <div className="text-sm text-gray-600">Loading metrics…</div>}
      {summary && (
        <div className="rounded border p-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><div className="text-gray-600">CAGR</div><div>{(summary.CAGR*100).toFixed(2)}%</div></div>
            <div><div className="text-gray-600">Max DD</div><div>{(summary.max_drawdown*100).toFixed(2)}%</div></div>
            <div><div className="text-gray-600">Sharpe</div><div>{summary.sharpe.toFixed(2)}</div></div>
            <div><div className="text-gray-600">Volatility</div><div>{(summary.volatility*100).toFixed(2)}%</div></div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-sm text-gray-700">Equity curve</div>
        <div ref={ref} className="w-full" />
      </div>
    </main>
  );
}


