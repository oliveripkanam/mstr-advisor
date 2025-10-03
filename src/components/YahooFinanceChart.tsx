import { useEffect, useRef } from "react";
import { 
  createChart, 
  IChartApi, 
  CandlestickData, 
  Time, 
  ISeriesApi,
  CandlestickSeries 
} from "lightweight-charts";
import { fetchMstrOHLCV, type Timeframe } from "../lib/marketData";

export interface YahooFinanceChartProps {
  timeframe: Timeframe;
  theme: "dark" | "light";
  height?: string | number;
  minHeight?: string | number;
}

export function YahooFinanceChart({
  timeframe,
  theme,
  height = "65vh",
  minHeight = 400,
}: YahooFinanceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: typeof minHeight === "number" ? minHeight : 400,
      layout: {
        background: { color: "transparent" },
        textColor: theme === "dark" ? "#9CA3AF" : "#4B5563",
      },
      grid: {
        vertLines: { color: theme === "dark" ? "rgba(128,128,128,0.12)" : "rgba(128,128,128,0.2)" },
        horzLines: { color: theme === "dark" ? "rgba(128,128,128,0.12)" : "rgba(128,128,128,0.2)" },
      },
      timeScale: {
        borderColor: theme === "dark" ? "#666" : "#999",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: theme === "dark" ? "#666" : "#999",
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    seriesRef.current = candlestickSeries as ISeriesApi<"Candlestick">;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [theme, minHeight]);

  useEffect(() => {
    if (!seriesRef.current) return;

    let cancelled = false;

    async function loadData() {
      try {
        const bars = await fetchMstrOHLCV(timeframe);
        if (cancelled || !seriesRef.current) return;

        const candleData: CandlestickData[] = bars.map((bar) => ({
          time: bar.time as Time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }));

        seriesRef.current.setData(candleData);

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      } catch (err) {
        console.error("[YahooFinanceChart] Failed to load data:", err);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  return (
    <div
      ref={containerRef}
      style={{
        height,
        minHeight,
        width: "100%",
        position: "relative",
      }}
    />
  );
}
