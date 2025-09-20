import { useEffect, useRef } from "react";

// Minimal types to avoid adding tv typings
declare global {
  interface Window {
    TradingView?: any;
  }
}

export type TVInterval = "1" | "3" | "5" | "15" | "30" | "60" | "120" | "180" | "240" | "D" | "W" | "M";

export interface TradingViewWidgetProps {
  symbol: string; // e.g., "BTCUSD", "MSTR"
  interval?: TVInterval; // default "15"
  theme?: "dark" | "light";
  studies?: string[]; // array of built-in indicators e.g. ["VWAP@tv-basicstudies"]
  withToolbar?: boolean;
  autosize?: boolean;
  allowCompare?: boolean; // whether users can add symbols from UI
  height?: string | number; // css height for the container, default 65vh
  minHeight?: string | number; // css min-height, default 400
}

const TV_SCRIPT_SRC = "https://s3.tradingview.com/tv.js";

function loadTradingViewScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TradingView) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${TV_SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("tv.js failed to load")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = TV_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("tv.js failed to load"));
    document.head.appendChild(script);
  });
}

export function mapTimeframeToTVInterval(tf: string): TVInterval {
  // Accepts: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 3h, 4h, 1D, 1W, 1M
  const normalized = tf.toLowerCase();
  if (normalized.endsWith("m")) {
    const n = normalized.replace("m", "");
    return (parseInt(n, 10) as any).toString() as TVInterval; // "1" | "5" | "15" | "30"
  }
  if (normalized.endsWith("h")) {
    const n = normalized.replace("h", "");
    const mins = parseInt(n, 10) * 60;
    return (mins.toString() as any) as TVInterval; // "60", "120", "240", etc.
  }
  if (normalized === "1d" || normalized === "d") return "D";
  if (normalized === "1w" || normalized === "w") return "W";
  if (normalized === "1m" || normalized === "m") return "M";
  // fallback
  return "15";
}

export default function TradingViewWidget({
  symbol,
  interval = "15",
  theme = "dark",
  studies = [],
  withToolbar = true,
  autosize = true,
  allowCompare = true,
  height = "65vh",
  minHeight = 400,
}: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      await loadTradingViewScript();
      if (cancelled || !containerRef.current) return;

      // Clean up previous widget if any
      if (widgetRef.current && typeof widgetRef.current.remove === "function") {
        try { widgetRef.current.remove(); } catch {}
      }

      // TradingView expects symbols like "NASDAQ:MSTR" or "CRYPTO:BTCUSD"
      // We'll try a smart mapping with safe defaults
      const tvSymbol = resolveTVSymbol(symbol);

      const widget = new window.TradingView.widget({
        symbol: tvSymbol,
        interval,
        container_id: containerRef.current.id,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Etc/UTC",
        theme: theme === "dark" ? "dark" : "light",
        style: "1", // candles
        locale: "en",
        toolbar_bg: "transparent",
        enable_publishing: false,
        hide_side_toolbar: !withToolbar,
        hide_top_toolbar: !withToolbar,
        withdateranges: true,
        autosize,
        studies,
        allow_symbol_change: allowCompare,
        details: true,
        hotlist: false,
        calendar: false,
        studies_overrides: {},
        overrides: {
          "paneProperties.background": "rgba(0,0,0,0)",
          "paneProperties.vertGridProperties.color": "rgba(128,128,128,0.12)",
          "paneProperties.horzGridProperties.color": "rgba(128,128,128,0.12)",
          "scalesProperties.lineColor": theme === "dark" ? "#666" : "#999",
          "scalesProperties.textColor": theme === "dark" ? "#9CA3AF" : "#4B5563",
        },
      });

      widgetRef.current = widget;
    }

    init();

    return () => {
      cancelled = true;
      if (widgetRef.current && typeof widgetRef.current.remove === "function") {
        try { widgetRef.current.remove(); } catch {}
        widgetRef.current = null;
      }
    };
  }, [symbol, interval, theme, withToolbar, autosize, allowCompare, JSON.stringify(studies)]);

  // Removed S/R drawing listener per request

  // Unique container id per mount
  const containerId = useRef(`tv_${Math.random().toString(36).slice(2)}`);

  return (
    <div id={containerId.current} ref={containerRef} style={{ height, minHeight }} />
  );
}

function resolveTVSymbol(input: string): string {
  // Common mappings. For BTC in USD we’ll default to BINANCE:BTCUSDT, else try CRYPTO:BTCUSD
  const sym = input.trim().toUpperCase();
  if (sym === "BTC" || sym === "BTCUSD" || sym === "XBT" || sym === "XBTUSD") {
    return "BINANCE:BTCUSDT"; // popular and supported without API keys
  }
  if (sym === "MSTR" || sym === "NASDAQ:MSTR") {
    return sym.includes(":") ? sym : "NASDAQ:MSTR";
  }
  // If user passes already qualified symbol, use as-is
  if (sym.includes(":")) return sym;
  // Fallback to TradingView generic
  return sym;
}
