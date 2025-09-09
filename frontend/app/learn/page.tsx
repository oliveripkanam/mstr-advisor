"use client";
import React, { useEffect, useMemo, useState } from "react";

type Term = {
  key: string;
  name: string;
  definition: string;
  how_to_read?: Record<string, string>;
  impact?: string[];
};

export default function LearnPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/mstr-advisor/configs/terminology.json")
      .then((r) => r.json())
      .then((d) => setTerms(d.terms || []))
      .catch(() => setErr("Unable to load terminology"));
  }, []);

  const activeTerm = useMemo(() => terms.find(t => t.key === active) || null, [terms, active]);

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Learn & Explain</h1>
        <p className="text-sm text-gray-700 mt-2">
          This advisor fetches daily prices, computes features, applies simple rules (trend + RSI + macro risk),
          and publishes a Buy/Hold/Reduce with risk bounds. Backtests show historical behaviour. Use the terms below
          to understand what each signal means and how it can nudge the decision.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Key terms</h2>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div className="flex flex-wrap gap-2">
          {terms.map(t => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`rounded border px-3 py-1 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary ${active===t.key? 'bg-gray-100' : ''}`}
              aria-pressed={active===t.key}
            >{t.name}</button>
          ))}
        </div>
      </section>

      {activeTerm && (
        <section className="rounded border p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium">{activeTerm.name}</h3>
              <p className="text-sm text-gray-700 mt-1">{activeTerm.definition}</p>
            </div>
            <button onClick={() => setActive(null)} className="text-sm text-gray-500 underline">Close</button>
          </div>
          {activeTerm.how_to_read && (
            <div className="mt-3">
              <div className="text-sm font-medium">How to read</div>
              <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
                {Object.entries(activeTerm.how_to_read).map(([k,v]) => (
                  <li key={k}><span className="font-medium">{k}</span>: {v}</li>
                ))}
              </ul>
            </div>
          )}
          {activeTerm.impact && (
            <div className="mt-3">
              <div className="text-sm font-medium">Typical impact on action</div>
              <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
                {activeTerm.impact.map((s, i) => (<li key={i}>{s}</li>))}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}


