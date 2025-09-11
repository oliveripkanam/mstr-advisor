"use client";
import React, { useEffect, useMemo, useState } from "react";
import Sparkline from "../../components/Sparkline";

type Row = { date: string; actual: number; pred: number; abs_err: number };
type PredFile = { asof: string; predict_next_close: number; history: Row[]; metrics: { mae: number; mape: number; cv: { mae: number; mape: number }[] } };

export default function PredictPage() {
  const [data, setData] = useState<PredFile | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const REPO = 'oliveripkanam/mstr-advisor';
    const rawMain = `https://raw.githubusercontent.com/${REPO}/main/data/public/close_predictions.json?t=${Date.now()}`;
    const pagesPath = `/mstr-advisor/data/public/close_predictions.json`;
    const paths = [
      'data/public/close_predictions.json',
      pagesPath,
      rawMain,
    ];
    (async () => {
      for (const p of paths) {
        try {
          const res = await fetch(p, { cache: 'no-store' });
          if (!res.ok) continue;
          const d: PredFile = await res.json();
          // Basic schema sanity: ensure arrays are arrays of numbers
          d.history = Array.isArray(d.history) ? d.history : [];
          setData(d);
          setErr(null);
          return;
        } catch {}
      }
      setErr('Unable to load predictions');
    })();
  }, []);

  const accuracyPct = useMemo(() => {
    if (!data?.history?.length) return null;
    const a = data.history;
    const tol = 0.01; // 1% tolerance
    const hits = a.filter((r) => Math.abs((r.pred - r.actual) / Math.max(1e-6, r.actual)) <= tol).length;
    return Math.round((hits / a.length) * 100);
  }, [data]);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!data) return <div className="p-4 text-gray-500">Loading…</div>;

  const closes = data.history.map((r) => r.actual).filter((v) => typeof v === 'number');
  const preds = data.history.map((r) => r.pred).filter((v) => typeof v === 'number');
  const errs = data.history.map((r) => r.abs_err).filter((v) => typeof v === 'number');
  const latest = data.history.length ? data.history[data.history.length - 1] : null;
  const latestPctErr = latest && typeof latest.actual === 'number' && typeof latest.pred === 'number'
    ? Math.abs((latest.pred - latest.actual) / Math.max(1e-6, latest.actual)) * 100
    : null;

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Close Price Prediction</h1>
      <div className="rounded border p-4 text-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-gray-700">Next predicted close</div>
            <div className="text-xl font-semibold">${typeof data.predict_next_close === 'number' ? data.predict_next_close.toFixed(2) : '--'}</div>
            <div className="text-xs text-gray-500">As of {data.asof}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-700">Accuracy (±1%)</div>
            <div className="text-xl font-semibold">{accuracyPct !== null ? `${accuracyPct}%` : '—'}</div>
            <div className="text-xs text-gray-500">MAE: ${typeof data.metrics?.mae === 'number' ? data.metrics.mae.toFixed(2) : '--'} · MAPE: {typeof data.metrics?.mape === 'number' ? data.metrics.mape.toFixed(2) : '--'}%</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border p-4">
          <div className="mb-2 text-sm text-gray-600">Actual vs Predicted</div>
          <Sparkline data={closes} stroke="#111827" fill="#e5e7eb" />
          <div className="mt-2 text-xs text-gray-500">Actual closes</div>
          <div className="mt-2">
            <Sparkline data={preds} stroke="#2563eb" fill="#dbeafe" />
            <div className="mt-1 text-xs text-blue-700">Predicted closes</div>
          </div>
        </div>
        <div className="rounded border p-4">
          <div className="mb-2 text-sm text-gray-600">Absolute error ($)</div>
          <Sparkline data={errs} stroke="#dc2626" fill="#fee2e2" />
        </div>
      </div>

      <div className="rounded border p-4">
        <div className="text-sm font-medium mb-2">Latest check</div>
        <div className="text-sm text-gray-700 flex flex-wrap gap-4">
          <div>Date: <span className="font-mono">{latest?.date ?? '—'}</span></div>
          <div>Actual: <span className="font-mono">{typeof latest?.actual === 'number' ? `$${latest!.actual.toFixed(2)}` : '—'}</span></div>
          <div>Predicted: <span className="font-mono">{typeof latest?.pred === 'number' ? `$${latest!.pred.toFixed(2)}` : '—'}</span></div>
          <div>Error: <span className="font-mono">{typeof latest?.abs_err === 'number' ? `$${latest!.abs_err.toFixed(2)}` : '—'}</span></div>
          <div>% Error: <span className="font-mono">{latestPctErr !== null ? `${latestPctErr.toFixed(2)}%` : '—'}</span></div>
        </div>
        {(!latest || typeof latest?.actual !== 'number') && (
          <div className="mt-2 text-xs text-gray-500">Note: Latest actual may be blank until the next trading day’s official close is ingested.</div>
        )}
      </div>

      <div className="rounded border p-4">
        <div className="mb-2 text-sm font-medium">History</div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th className="py-1">Date</th>
                <th className="py-1">Actual</th>
                <th className="py-1">Predicted</th>
                <th className="py-1">Abs err</th>
                <th className="py-1">% err</th>
              </tr>
            </thead>
            <tbody>
              {data.history.slice(-120).reverse().map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1">{r.date}</td>
                  <td className="py-1">${typeof r.actual === 'number' ? r.actual.toFixed(2) : '--'}</td>
                  <td className="py-1">${typeof r.pred === 'number' ? r.pred.toFixed(2) : '--'}</td>
                  <td className="py-1">${typeof r.abs_err === 'number' ? r.abs_err.toFixed(2) : '--'}</td>
                  <td className="py-1">{(typeof r.actual === 'number' && typeof r.pred === 'number') ? `${(Math.abs((r.pred - r.actual) / Math.max(1e-6, r.actual)) * 100).toFixed(2)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}


