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

  return (
    <main className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">What changed — {changed.timestamp}</h2>
        <p className="text-sm text-gray-600">{changed.summary}</p>
        <ul className="mt-2 list-disc pl-5 text-sm text-gray-800">
          {changed.items.map((it, idx) => (
            <li key={idx}>{it}</li>
          ))}
        </ul>
      </div>
      <div className="rounded border p-4">
        <div className="mb-1 text-sm text-gray-600">Today’s baseline</div>
        <div className="text-base">Action: <span className="font-medium">{signal.action}</span> · Confidence: {signal.confidence}%</div>
        {signal.why && <div className="mt-2 text-sm text-gray-700">Why: {signal.why}</div>}
      </div>

      <div className="rounded border p-4">
        <div className="mb-1 text-sm text-gray-600">Explainability</div>
        <div className="text-sm text-gray-800">{explain.narrative}</div>
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


