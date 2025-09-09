"use client";
import React, { useEffect, useState } from "react";

type Status = {
  last_run_utc: string;
  stale: boolean;
  public?: { sizes_kb?: Record<string, number>; total_public_kb?: number; payload_ok?: boolean; payload_budget_kb?: number };
  symbols?: Record<string, { exists: boolean; rows?: number; latest?: string | null }>;
};

export default function StatusPage() {
  const [data, setData] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("data/public/status.json")
      .then((r) => r.json())
      .then((d: Status) => setData(d))
      .catch(() => setErr("Unable to load status"));
  }, []);

  if (err) return <div role="alert" aria-live="assertive" className="p-4 rounded border border-red-200 bg-red-50 text-red-700">{err}</div>;
  if (!data) return <div role="status" aria-live="polite" className="p-4 text-gray-500">Loading…</div>;

  const sizes = data.public?.sizes_kb || {};
  const budget = data.public?.payload_budget_kb || 2000;
  const total = Math.max(0, data.public?.total_public_kb || 0);
  const used = Object.values(sizes).reduce((a, b) => a + (b || 0), 0);
  const usedPctRaw = (used / budget) * 100;
  const usedPct = Math.max(0, Math.min(100, usedPctRaw));
  const ok = Boolean(data.public?.payload_ok);
  const maxFile = Math.max(0, ...Object.values(sizes).map((v) => v || 0));
  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Data Status</h2>
      <div className="text-sm text-gray-700">Last run (UTC): {data.last_run_utc}</div>
      <div className={`text-sm ${data.stale ? 'text-red-700' : 'text-green-700'}`}>Stale: {String(data.stale)}</div>
      <div className="rounded border p-4">
        <div className="text-sm font-medium mb-2">Public payload</div>
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24">
            <svg viewBox="0 0 100 100" className="h-24 w-24">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={usedPctRaw <= 100 ? "#16a34a" : "#dc2626"}
                strokeWidth="12"
                strokeDasharray={`${Math.round(2 * Math.PI * 42 * (usedPct/100))} ${Math.round(2 * Math.PI * 42)}`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="text-xs font-semibold">{usedPct.toFixed(0)}%</div>
            </div>
          </div>
          <div className="text-xs text-gray-700" aria-live="polite">
            <div aria-label="Payload summary">Budget: {budget.toFixed(0)} KB · Used: {used.toFixed(1)} KB ({usedPct.toFixed(0)}%) · OK: {String(ok)}</div>
            <div className="mt-2 space-y-1">
              {Object.entries(sizes).map(([name, kb]) => {
                const pctOfMax = maxFile > 0 ? Math.min(100, Math.max(0, ((kb||0) / maxFile) * 100)) : 0;
                const pctOfBudget = Math.min(100, Math.max(0, ((kb||0) / budget) * 100));
                return (
                  <div key={name}>
                    <div className="flex justify-between"><span>{name}</span><span>{(kb||0).toFixed(1)} KB · {pctOfBudget.toFixed(1)}% of budget</span></div>
                    <div className="mt-0.5 h-1.5 w-full rounded bg-gray-200" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Number.isFinite(pctOfMax)? Math.round(pctOfMax): 0} aria-label={`${name} size percent of largest file`}>
                      <div className={`h-1.5 rounded ${pctOfBudget>15? 'bg-blue-600' : 'bg-blue-400'} transition-[width] duration-500 ease-out`} style={{ width: `${pctOfMax}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs text-gray-600">
        This section audits the JSON payload the frontend downloads. The ring shows what percent of the budget we’re using. Each bar is a file’s contribution. If OK is false, consider trimming heavy files like `mstr_technical.json`.
      </div>
      {data.symbols && (
        <div className="rounded border p-4">
          <div className="text-sm font-medium mb-2">Raw symbols</div>
          <table className="text-xs w-full">
            <thead>
              <tr><th className="text-left">Symbol</th><th className="text-right">Rows</th><th className="text-right">Latest</th></tr>
            </thead>
            <tbody>
              {Object.entries(data.symbols).map(([sym, s]) => (
                <tr key={sym}><td>{sym}</td><td className="text-right">{s.rows ?? '—'}</td><td className="text-right">{s.latest ?? '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}


