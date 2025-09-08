"use client";
import React, { useEffect, useState } from "react";

type Status = {
  last_run_utc: string;
  stale: boolean;
  public?: { sizes_kb?: Record<string, number>; total_public_kb?: number; payload_ok?: boolean };
  symbols?: Record<string, { exists: boolean; rows?: number; latest?: string | null }>;
};

export default function StatusPage() {
  const [data, setData] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    fetch("/data/public/status.json")
      .then((r) => r.json())
      .then((d: Status) => setData(d))
      .catch(() => setErr("Unable to load status"));
  }, []);

  if (err) return <div className="p-4 text-red-600">{err}</div>;
  if (!data) return <div className="p-4 text-gray-500">Loading…</div>;

  const sizes = data.public?.sizes_kb || {};
  return (
    <main className="space-y-4">
      <h2 className="text-xl font-semibold">Data Status</h2>
      <div className="text-sm text-gray-700">Last run (UTC): {data.last_run_utc}</div>
      <div className={`text-sm ${data.stale ? 'text-red-700' : 'text-green-700'}`}>Stale: {String(data.stale)}</div>
      <div className="rounded border p-4">
        <div className="text-sm font-medium mb-2">Public payload</div>
        <div className="text-xs text-gray-700">Total: {(data.public?.total_public_kb || 0).toFixed(1)} KB · OK: {String(data.public?.payload_ok)}</div>
        <ul className="mt-2 text-xs">
          {Object.entries(sizes).map(([name, kb]) => (
            <li key={name} className="flex justify-between"><span>{name}</span><span>{kb} KB</span></li>
          ))}
        </ul>
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


