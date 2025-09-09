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
  const [today, setToday] = useState<Record<string, string>>({});
  const [metrics, setMetrics] = useState<Record<string, number | string>>({});

  useEffect(() => {
    fetch("/mstr-advisor/configs/terminology.json")
      .then((r) => r.json())
      .then((d) => setTerms(d.terms || []))
      .catch(() => setErr("Unable to load terminology"));
  }, []);

  // Load current values from published JSONs and compute simple states
  useEffect(() => {
    Promise.all([
      fetch("/mstr-advisor/data/public/mstr_technical.json").then(r=>r.json()).catch(()=>null),
      fetch("/mstr-advisor/data/public/mstr_crossasset.json").then(r=>r.json()).catch(()=>null),
      fetch("/mstr-advisor/data/public/backtest_rolling.json").then(r=>r.json()).catch(()=>null),
      fetch("/mstr-advisor/data/public/backtest_baseline.json").then(r=>r.json()).catch(()=>null)
    ]).then(([tech, xas, rolling, summary]) => {
      const s: Record<string,string> = {};
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
        }
      } catch {}
      try {
        if (xas && xas.length) {
          const x = xas[xas.length-1];
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
          }
        }
        if (rolling && rolling.rolling_sharpe_252 && rolling.rolling_sharpe_252.length) {
          const arr = rolling.rolling_sharpe_252.filter((p:any)=>p && p.value!==null);
          if (arr.length) {
            const v = Number(arr[arr.length-1].value);
            s["sharpe"] = `Rolling Sharpe(12m) = ${v.toFixed(2)}`;
            metrics["sharpe_roll"] = v;
          }
        }
        if (rolling && rolling.drawdown && rolling.drawdown.length) {
          const arr = rolling.drawdown;
          if (arr.length) {
            const v = Number(arr[arr.length-1].value);
            s["drawdown"] = `Drawdown = ${(v*100).toFixed(1)}%`;
            metrics["dd"] = v;
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
          {(() => {
            // Show today's value/state if we have it for this term
            const keyMap: Record<string,string[]> = {
              trend: ["trend","dma"],
              dma: ["dma"],
              rsi: ["rsi"],
              vix: ["vix"],
              uup: ["uup"],
              corr: ["corr"],
              atr: ["atr"],
              sharpe: ["sharpe","sharpe_total"],
              drawdown: ["drawdown"],
              hit_rate: ["hit_rate"]
            };
            const keys = keyMap[activeTerm.key] || [];
            const lines = keys.map(k => today[k]).filter(Boolean);
            if (!lines.length) return (
              <div className="mt-3 rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-gray-800">No live value available for today.</div>
            );

            // Guidance sentence based on simple thresholds
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
                <div className="text-sm font-medium">Today</div>
                <ul className="mt-1 list-disc pl-5 text-sm text-gray-800">
                  {lines.map((ln,i)=>(<li key={i}>{ln}</li>))}
                </ul>
                {g && <div className="mt-2 text-sm text-gray-900">{g}</div>}
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
    </main>
  );
}


