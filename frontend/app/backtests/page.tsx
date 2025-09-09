"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createChart, ColorType, ISeriesApi } from "lightweight-charts";

type Summary = {
  days: number;
  total_return: number;
  CAGR: number;
  volatility: number;
  max_drawdown: number;
  sharpe: number;
  turnover: number;
  params_hash?: string;
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
  const ref2 = useRef<HTMLDivElement>(null);

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

  const rolling = useJson<{ rolling_sharpe_252: { timestamp: string; value: number|null }[]; drawdown: { timestamp: string; value: number }[]; hit_rate_252?: { timestamp: string; value: number|null }[] }>("data/public/backtest_rolling.json");
  useEffect(() => {
    if (!ref2.current || !rolling) return;
    const chart = createChart(ref2.current, {
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#111827" },
      width: ref2.current.clientWidth,
      height: 240,
      timeScale: { rightOffset: 2, fixLeftEdge: true },
      grid: { vertLines: { color: "#f3f4f6" }, horzLines: { color: "#f3f4f6" } },
    });
    const s1: ISeriesApi<'Line'> = chart.addLineSeries({ color: "#16a34a" });
    s1.setData(rolling.rolling_sharpe_252.filter(p=>p.value!==null).map(p => ({ time: p.timestamp as unknown as any, value: p.value as number })));
    const s2: ISeriesApi<'Line'> = chart.addLineSeries({ color: "#dc2626" });
    s2.setData(rolling.drawdown.map(p => ({ time: p.timestamp as unknown as any, value: p.value })));
    if (rolling.hit_rate_252) {
      const s3: ISeriesApi<'Line'> = chart.addLineSeries({ color: "#1f2937" });
      s3.setData(rolling.hit_rate_252.filter(p=>p.value!==null).map(p => ({ time: p.timestamp as unknown as any, value: p.value as number })));
    }
    chart.timeScale().fitContent();
    const onResize = () => { if (ref2.current) chart.applyOptions({ width: ref2.current.clientWidth }); };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); chart.remove(); };
  }, [rolling]);

  const monthly = useJson<{ year: number; [k: string]: any }[]>("data/public/backtest_monthly.json");

  function formatPct(v: number) {
    return `${(v * 100).toFixed(2)}%`;
  }

  function tile(label: string, value: string, accent?: "up" | "down" | "neutral") {
    const chipColor = accent === 'up' ? 'bg-green-100 text-green-700' : accent === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';
    return (
      <div className="rounded border border-gray-200 p-3">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
          <span>{value}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] ${chipColor}`}>{accent === 'up' ? '↑' : accent === 'down' ? '↓' : '—'}</span>
        </div>
      </div>
    );
  }

  function colorForReturn(v: number) {
    // Clamp around +/-15% for monthly hue intensity
    const a = Math.min(1, Math.abs(v) / 0.15);
    if (v >= 0) {
      const light = 98 - Math.round(a * 40); // 98% -> 58%
      return `hsl(142, 60%, ${light}%)`; // green-ish
    } else {
      const light = 98 - Math.round(a * 40);
      return `hsl(0, 70%, ${light}%)`; // red-ish
    }
  }

  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Baseline Backtest</h2>
      {!summary && <div className="text-sm text-gray-600">Loading metrics…</div>}
      {summary && (
        <div className="rounded border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {tile("CAGR", formatPct(summary.CAGR), summary.CAGR >= 0 ? 'up' : 'down')}
            {tile("Total Return", formatPct(summary.total_return), summary.total_return >= 0 ? 'up' : 'down')}
            {tile("Max Drawdown", formatPct(summary.max_drawdown), 'down')}
            {tile("Sharpe (12m)", summary.sharpe.toFixed(2), summary.sharpe >= 1 ? 'up' : summary.sharpe < 0.5 ? 'down' : 'neutral')}
            {tile("Volatility", formatPct(summary.volatility), 'neutral')}
            {tile("Turnover", summary.turnover.toFixed(2), 'neutral')}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
            <div>Params hash: {/** @ts-ignore **/summary.params_hash}</div>
            <div>
              <a href="/mstr-advisor/docs/BACKTEST.md" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">Backtester docs →</a>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-sm text-gray-700">Equity curve</div>
        <div ref={ref} className="w-full" />
      </div>
      <div>
        <div className="mb-2 text-sm text-gray-700">Rolling Sharpe (12m) and Drawdown</div>
        <div ref={ref2} className="w-full" />
      </div>
      <div>
        <div className="mb-2 text-sm text-gray-700">Monthly returns (heatmap)</div>
        {!monthly && <div className="text-sm text-gray-600">Loading monthly returns…</div>}
        {monthly && (
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left">Year</th>
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                    <th key={m} className="px-2 py-1 text-right">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthly.map(row => (
                  <tr key={row.year}>
                    <td className="px-2 py-1">{row.year}</td>
                    {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => {
                      const v = row[m];
                      const disp = typeof v === 'number' ? `${(v*100).toFixed(1)}%` : '—';
                      const style = typeof v === 'number' ? { backgroundColor: colorForReturn(v) } as React.CSSProperties : undefined;
                      const textCls = typeof v === 'number' ? (Math.abs(v) > 0.08 ? 'text-white' : 'text-gray-800') : 'text-gray-400';
                      return (
                        <td key={m} className={`px-2 py-1 text-right font-mono ${textCls}`} style={style}>{disp}</td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-[10px] text-gray-500">Cell color intensity scales with monthly return (±15% clamp).</div>
          </div>
        )}
      </div>
    </main>
  );
}


