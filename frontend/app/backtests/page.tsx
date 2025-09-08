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
          <div className="mt-2 text-xs text-gray-500">Params hash: {/** @ts-ignore **/summary.params_hash}</div>
          <div className="mt-2 text-xs">
            <Link className="text-primary underline" href="/docs/BACKTEST">Backtester docs →</Link>
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
                      const color = typeof v === 'number' ? (v >= 0 ? 'text-green-700' : 'text-red-700') : 'text-gray-400';
                      const disp = typeof v === 'number' ? `${(v*100).toFixed(1)}%` : '—';
                      return <td key={m} className={`px-2 py-1 text-right ${color}`}>{disp}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}


