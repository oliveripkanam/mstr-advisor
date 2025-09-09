"use client";
import React, { useEffect, useMemo, useState } from "react";
import Sparkline from "../../components/Sparkline";

type Term = {
  key: string;
  name: string;
  definition: string;
  how_to_read?: Record<string, string>;
  impact?: string[];
};

export default function InfoPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [today, setToday] = useState<Record<string, string>>({});
  const [metrics, setMetrics] = useState<Record<string, number | string>>({});
  const [query, setQuery] = useState<string>("");
  const [status, setStatus] = useState<{ last_run_utc?: string; stale?: boolean } | null>(null);

  useEffect(() => {
    fetch("/mstr-advisor/configs/terminology.json")
      .then((r) => r.json())
      .then((d) => setTerms(d.terms || []))
      .catch(() => setErr("Unable to load terminology"));
    fetch("data/public/status.json").then(r=>r.json()).then((d)=>setStatus({ last_run_utc: d?.last_run_utc, stale: d?.stale})).catch(()=>{});
  }, []);

  useEffect(() => {
    const fetchFirst = async (paths: string[]) => {
      for (const p of paths) {
        try { const res = await fetch(p); if (res.ok) return await res.json(); } catch {}
      }
      return null;
    };
    Promise.all([
      fetchFirst(["/mstr-advisor/data/public/mstr_technical.json","data/public/mstr_technical.json"]),
      fetchFirst(["/mstr-advisor/data/public/mstr_crossasset.json","data/public/mstr_crossasset.json"]),
      fetchFirst(["/mstr-advisor/data/public/backtest_rolling.json","data/public/backtest_rolling.json"]),
      fetchFirst(["/mstr-advisor/data/public/backtest_baseline.json","data/public/backtest_baseline.json"]) 
    ]).then(([tech, xas, rolling, summary]) => {
      const s: Record<string,string> = {};
      const lastValid = (arr: any[], key: string) => {
        if (!Array.isArray(arr)) return null;
        for (let i=arr.length-1; i>=0; i--) {
          const v = arr[i]?.[key];
          if (v !== undefined && v !== null && !(typeof v === 'number' && isNaN(v))) return arr[i];
        }
        return null;
      };
      try {
        if (tech && tech.length) {
          const t = tech[tech.length-1];
          const price = Number(t.close);
          const sma50 = Number(t.sma50);
          const sma200 = Number(t.sma200);
          const rsi = Number(t.rsi14);
          const atr = Number(t.atr14);
          if (Number.isFinite(price) && Number.isFinite(sma50) && Number.isFinite(sma200)) {
            const uptrend = price> sma50 && sma50> sma200;
            s["trend"] = uptrend ? "Uptrend (price>50>200)" : (price < sma50 ? "Below 50DMA" : "Mixed");
            s["dma"] = `Price ${price>=sma50?"≥":"<"} 50DMA ${sma50>=sma200?"and 50≥200":"and 50<200"}`;
            metrics["trend_up"] = uptrend ? 1 : 0;
            metrics["below_50"] = price < sma50 ? 1 : 0;
          }
          if (Number.isFinite(rsi)) s["rsi"] = `RSI 14 = ${rsi.toFixed(1)}`;
          if (Number.isFinite(atr)) s["atr"] = `ATR(14) = ${atr.toFixed(2)}`;
          if (Number.isFinite(price)) metrics["price"] = price;
          if (Number.isFinite(rsi)) metrics["rsi"] = rsi;
          if (Number.isFinite(atr)) metrics["atr"] = atr;
          const rsiSeries = tech.map((row: any) => Number(row?.rsi14)).filter((v: number) => Number.isFinite(v));
          if (rsiSeries.length) metrics["rsi_series"] = JSON.stringify(rsiSeries);
        }
      } catch {}
      try {
        if (xas && xas.length) {
          const x = lastValid(xas, 'vix_band') || lastValid(xas, 'uup_trend_up') || lastValid(xas, 'corr_BTCUSD_20') || xas[xas.length-1];
          if (x.vix_band) s["vix"] = `VIX regime: ${String(x.vix_band)}`;
          if (typeof x.uup_trend_up !== 'undefined') {
            const up = Number(x.uup_trend_up)===1;
            s["uup"] = up ? "USD uptrend" : "USD not in uptrend";
            metrics["uup_up"] = up ? 1 : 0;
          }
          if (typeof x.corr_BTCUSD_20 !== 'undefined') {
            const c = Number(x.corr_BTCUSD_20);
            s["corr"] = `BTC 20d corr = ${c.toFixed(2)}`;
            metrics["corr_btc20"] = c;
          }
          if (x.vix_band) metrics["vix_band"] = String(x.vix_band);
        }
      } catch {}
      try {
        if (rolling && rolling.hit_rate_252 && rolling.hit_rate_252.length) {
          const arr = rolling.hit_rate_252.filter((p:any)=>p && p.value!==null);
          if (arr.length) {
            const v = Number(arr[arr.length-1].value);
            s["hit_rate"] = `Hit‑rate(12m) = ${(v*100).toFixed(0)}%`;
            metrics["hit_rate"] = v;
            metrics["hit_rate_series"] = JSON.stringify(arr.map((p:any)=>Number(p.value)));
          }
        }
        if (rolling && rolling.rolling_sharpe_252 && rolling.rolling_sharpe_252.length) {
          const arr = rolling.rolling_sharpe_252.filter((p:any)=>p && p.value!==null);
          if (arr.length) {
            const v = Number(arr[arr.length-1].value);
            s["sharpe"] = `Rolling Sharpe(12m) = ${v.toFixed(2)}`;
            metrics["sharpe_roll"] = v;
            metrics["sharpe_series"] = JSON.stringify(arr.map((p:any)=>Number(p.value)));
          }
        }
        if (rolling && rolling.drawdown && rolling.drawdown.length) {
          const arr = rolling.drawdown;
          if (arr.length) {
            const v = Number(arr[arr.length-1].value);
            s["drawdown"] = `Drawdown = ${(v*100).toFixed(1)}%`;
            metrics["dd"] = v;
            metrics["dd_series"] = JSON.stringify(arr.map((p:any)=>Number(p.value)));
          }
        }
        if (summary && typeof summary.sharpe !== 'undefined') {
          const v = Number(summary.sharpe);
          s["sharpe_total"] = `Sharpe (full sample) = ${v.toFixed(2)}`;
          metrics["sharpe_total"] = v;
        }
      } catch {}
      setToday(s);
      setMetrics(prev => ({...prev, ...metrics}));
    }).catch(()=>{});
  }, []);

  const filteredTerms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return terms;
    return terms.filter(t => t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q));
  }, [terms, query]);

  const activeTerm = useMemo(() => terms.find(t => t.key === active) || null, [terms, active]);

  return (
    <main className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Info & Methodology</h1>
        {status && (
          <div className={`mt-2 inline-block rounded px-2 py-1 text-xs ${status.stale? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>Last build: {status.last_run_utc}</div>
        )}
        <div className="mt-4 rounded border p-4 text-sm text-gray-800">
          <div className="font-medium mb-1">How this advisor works</div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Ingest daily prices → compute features (trend, RSI, macro).</li>
            <li>Apply rules and a small ML model to form Buy/Hold/Reduce with confidence.</li>
            <li>Publish JSONs and render this static site. No brokerage links, no fees.</li>
          </ol>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Signals & terms</h2>
          <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search terms" className="w-44 rounded border border-gray-300 px-2 py-1 text-sm" />
        </div>
        {err && <div className="text-red-600 text-sm">{err}</div>}
        <div className="flex flex-wrap gap-2">
          {filteredTerms.map(t => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={`rounded border px-3 py-1 text-sm transition-transform hover:scale-[1.02] hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 ${active===t.key? 'bg-gray-100 shadow-inner' : ''}`}
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
          {(() => {
            const keyMap: Record<string,string[]> = {
              trend: ["trend","dma"], dma: ["dma"], rsi: ["rsi"], vix: ["vix"], uup: ["uup"], corr: ["corr"], atr: ["atr"], sharpe: ["sharpe","sharpe_total"], drawdown: ["drawdown"], hit_rate: ["hit_rate"],
            };
            const keys = keyMap[activeTerm.key] || [];
            const lines = keys.map(k => today[k]).filter(Boolean);
            if (!lines.length) return (
              <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-800">No live value available for today.</div>
            );
            const g = (() => {
              const tu = Number(metrics["trend_up"]) === 1;
              const below50 = Number(metrics["below_50"]) === 1;
              const rsi = Number(metrics["rsi"]);
              const vix = String(metrics["vix_band"] || "");
              const uupUp = Number(metrics["uup_up"]) === 1;
              const corr = Number(metrics["corr_btc20"]);
              const sharpe = Number(metrics["sharpe_roll"] || metrics["sharpe_total"]);
              const dd = Number(metrics["dd"]);
              switch (activeTerm.key) {
                case "trend":
                case "dma":
                  if (tu) return "Uptrend supports Buy/Hold on pullbacks.";
                  if (below50) return "Below 50DMA suggests caution or trims.";
                  return "Mixed trend; neutral bias.";
                case "rsi":
                  if (rsi >= 80) return "Very hot momentum — trim/reduce risk.";
                  if (rsi >= 70) return "Overbought — avoid new buys.";
                  if (rsi <= 30 && tu) return "Oversold pullback within uptrend — buy-the-dip friendly with risk controls.";
                  return "Neutral momentum.";
                case "vix":
                  if (vix === "high") return "High volatility — cap confidence and widen stops.";
                  if (vix === "low") return "Calm conditions — normal sizing.";
                  return "Normal volatility.";
                case "uup":
                  return uupUp ? "Strong USD — mild headwind; slightly reduce risk." : "USD neutral — no adjustment.";
                case "corr":
                  if (corr >= 0.6) return "Moves closely with BTC — expect crypto sensitivity.";
                  if (corr <= -0.2) return "Negatively correlated — more idiosyncratic.";
                  return "Moderate correlation.";
                case "atr":
                  return "ATR reflects daily range — larger ATR implies wider stops.";
                case "sharpe":
                  if (sharpe >= 1) return "Good risk-adjusted performance recently.";
                  if (sharpe < 0) return "Negative risk-adjusted performance — caution.";
                  return "Mixed risk-adjusted performance.";
                case "drawdown":
                  if (dd <= -0.2) return "Deep drawdown — significant risk realized.";
                  if (dd <= -0.1) return "Moderate drawdown.";
                  return "Shallow drawdown.";
                case "hit_rate":
                  const hr = Number(metrics["hit_rate"]);
                  if (hr >= 0.55) return "Consistent recent wins (hit‑rate >55%).";
                  if (hr <= 0.45) return "Choppy period (hit‑rate <45%).";
                  return "Near coin‑flip consistency.";
                default:
                  return "";
              }
            })();
            return (
              <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Today</div>
                    <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
                      {lines.map((ln,i)=>(<li key={i}>{ln}</li>))}
                    </ul>
                    {g && <div className="mt-2 text-sm text-gray-900">{g}</div>}
                  </div>
                  <div className="shrink-0">
                    {activeTerm.key === 'rsi' && metrics['rsi_series'] && (
                      <Sparkline data={JSON.parse(String(metrics['rsi_series']))} stroke="#7c3aed" fill="#ede9fe" />
                    )}
                    {activeTerm.key === 'sharpe' && metrics['sharpe_series'] && (
                      <Sparkline data={JSON.parse(String(metrics['sharpe_series']))} />
                    )}
                    {activeTerm.key === 'drawdown' && metrics['dd_series'] && (
                      <Sparkline data={JSON.parse(String(metrics['dd_series']))} stroke="#dc2626" fill="#fee2e2" />
                    )}
                    {activeTerm.key === 'hit_rate' && metrics['hit_rate_series'] && (
                      <Sparkline data={JSON.parse(String(metrics['hit_rate_series']))} stroke="#1f2937" fill="#e5e7eb" />
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
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

      <section className="rounded border p-4">
        <div className="text-sm font-medium mb-1">FAQ</div>
        <details className="text-sm">
          <summary className="cursor-pointer">What does confidence mean?</summary>
          <div className="mt-1 text-gray-700">It reflects rule strength blended with ML probability; capped during high volatility (VIX).</div>
        </details>
        <details className="text-sm mt-2">
          <summary className="cursor-pointer">Why did the action change?</summary>
          <div className="mt-1 text-gray-700">Often due to price crossing moving averages, RSI shifts, or macro regime flips. See the Explainer page for day‑to‑day changes.</div>
        </details>
        <details className="text-sm mt-2">
          <summary className="cursor-pointer">Is this financial advice?</summary>
          <div className="mt-1 text-gray-700">No. This is an automated, free, informational site. Use your own judgment.</div>
        </details>
      </section>
    </main>
  );
}


