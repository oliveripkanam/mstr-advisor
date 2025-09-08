"use client";
import React, { useEffect, useState } from "react";

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

export default function ExplainerPage() {
  const [changed, setChanged] = useState<Changed | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("data/public/what_changed.json").then((r) => r.json()),
      fetch("data/public/baseline_signal.json").then((r) => r.json()),
    ])
      .then(([c, s]) => {
        setChanged(c);
        setSignal(s);
      })
      .catch(() => setErr("Unable to load explainer data"));
  }, []);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!changed || !signal) return <div className="p-4 text-gray-500">Loading…</div>;

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
    </main>
  );
}


