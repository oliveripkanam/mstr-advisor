"use client";
import React, { useEffect, useState } from "react";
import GlossaryTooltip from "../../components/GlossaryTooltip";

type Changed = {
  timestamp: string;
  items: string[];
  summary: string;
  deltas: Record<string, unknown>;
};

type Signal = {
  action: string;
  confidence: number;
  why?: string;
  timestamp: string;
};

type Explain = {
  timestamp: string;
  narrative: string;
  drivers: { name: string; detail: string; impact: string }[];
};

export default function ExplainerPage() {
  const [changed, setChanged] = useState<Changed | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [explain, setExplain] = useState<Explain | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([
      fetch("data/public/what_changed.json").then((r) => r.json()),
      fetch("data/public/baseline_signal.json").then((r) => r.json()),
      fetch("data/public/explain_latest.json").then((r) => r.json()),
    ])
      .then(([c, s, e]) => {
        setChanged(c);
        setSignal(s);
        setExplain(e);
      })
      .catch(() => setErr("Unable to load explainer data"));
  }, []);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!changed || !signal || !explain) return <div className="p-4 text-gray-500">Loading…</div>;

  const rows = Object.entries(changed.deltas || {});

  const fmt = (k: string, v: any) => {
    try {
      switch (k) {
        case 'price_vs_50dma': return `${v.from} → ${v.to}`;
        case 'trend_cross': return `${v.from} → ${v.to}`;
        case 'rsi_band': return `${v.from} → ${v.to} (${v.prev}→${v.curr})`;
        case 'vix_band': return `${v.from} → ${v.to}`;
        case 'uup_trend_up': return `${v.from===1?'up':'down'} → ${v.to===1?'up':'down'}`;
        default:
          if (k.includes('corr')) return `${v.delta>0?'+':''}${v.delta}`;
          return String(v);
      }
    } catch { return '-'; }
  };

  const label = (k: string) => {
    const map: Record<string,string> = {
      price_vs_50dma: 'Price vs 50DMA',
      trend_cross: 'Trend (50 vs 200)',
      rsi_band: 'RSI band',
      vix_band: 'VIX regime',
      uup_trend_up: 'USD trend',
      corr_BTCUSD_20: 'BTC 20d corr',
      corr_SPY_20: 'SPY 20d corr',
      corr_QQQ_20: 'QQQ 20d corr',
    };
    return map[k] || k;
  };

  const topChips = (explain.drivers || []).slice(0, 3);

  return (
    <main className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">What changed — {changed.timestamp}</h2>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">Action: <span className="font-medium">{signal.action}</span></span>
          <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-700">Confidence: {signal.confidence}%</span>
          {topChips.map((d, i) => (
            <a key={i} href="/learn" className={`ml-1 rounded px-2 py-0.5 ${d.impact==='+'? 'bg-green-50 text-green-700 border border-green-200' : d.impact==='-'? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>{d.name}</a>
          ))}
        </div>
        <p className="mt-2 text-sm text-gray-600">{changed.summary}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
          {changed.items.map((it, idx) => (
            <li key={idx}>{it}</li>
          ))}
        </ul>
      </div>

      {rows.length > 0 && (
        <div className="rounded border p-4">
          <div className="mb-2 text-sm font-medium">Changes since yesterday</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between rounded border border-gray-200 bg-white px-3 py-2 text-sm">
                <div className="text-gray-700">{label(k)}</div>
                <div className="text-gray-900">{fmt(k, v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded border p-4" aria-live="polite">
        <div className="mb-1 text-sm text-gray-600">Today’s baseline</div>
        <div className="text-base">Action: <span className="font-medium">{signal.action}</span> · Confidence: {signal.confidence}%</div>
        {signal.why && <div className="mt-2 text-sm text-gray-700">Why: {signal.why}</div>}
      </div>

      <div className="rounded border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-gray-600">Explainability</div>
          <button className="text-xs text-blue-700 underline" onClick={() => setOpen((o) => !o)}>{open? 'Hide' : 'Show'} narrative</button>
        </div>
        {open && <div className="text-sm text-gray-800">{explain.narrative}</div>}
        <ul className="mt-3 space-y-1 text-sm">
          {explain.drivers.map((d, i) => (
            <li key={i} className="flex items-start justify-between gap-2">
              <span className="text-gray-800"><GlossaryTooltip term={d.name} />: {d.detail}</span>
              <span className={`text-xs ${d.impact === '+' ? 'text-green-700' : d.impact === '-' ? 'text-red-700' : 'text-gray-500'}`}>{d.impact}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}


