import { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type TF = '5m' | '15m' | '1h';

interface TFResult {
  timeframe: TF;
  rsi?: number;
  macd?: number; // MACD line (fast-slow)
  signal?: number; // signal line
  roc?: number; // %
  state: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0..100
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function calcMACD(closes: number[]): { macd?: number; signal?: number } {
  if (closes.length < 35) return {};
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif: number[] = closes.map((_, i) => ema12[i] - ema26[i]);
  const sig = ema(dif, 9);
  return { macd: dif[dif.length - 1], signal: sig[sig.length - 1] };
}

function calcRSI14(closes: number[]): number | undefined {
  const period = 14;
  if (closes.length < period + 1) return undefined;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch > 0) gains += ch; else losses -= ch;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, ch)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -ch)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcROC(closes: number[], n = 10): number | undefined {
  if (closes.length < n + 1) return undefined;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - n];
  if (prev === 0) return undefined;
  return ((last - prev) / prev) * 100;
}

function scoreAndState(rsi?: number, macd?: number, signal?: number, roc?: number): { state: TFResult['state']; confidence: number } {
  const rsiScore = rsi == null ? 0 : Math.max(-1, Math.min(1, (rsi - 50) / 25));
  const macdScore = macd == null || signal == null ? 0 : (macd - signal > 0 ? 0.6 : -0.6);
  const rocScore = roc == null ? 0 : Math.max(-1, Math.min(1, roc / 2));
  const total = 0.45 * rsiScore + 0.35 * rocScore + 0.20 * macdScore;
  const state: TFResult['state'] = total > 0.12 ? 'bullish' : total < -0.12 ? 'bearish' : 'neutral';
  const confidence = Math.round(Math.min(1, Math.abs(total)) * 100);
  return { state, confidence };
}

async function fetchCloses(interval: TF, limit = 300): Promise<number[]> {
  const url = `/proxy/binance-fapi/fapi/v1/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('klines fetch failed');
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error('bad klines');
  return j.map((k: any) => Number(k[4])).filter((v: any) => isFinite(v));
}

export function MomentumIndicator() {
  const [results, setResults] = useState<TFResult[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  async function computeFor(tf: TF): Promise<TFResult> {
    try {
      const closes = await fetchCloses(tf, 300);
      const rsi = calcRSI14(closes);
      const { macd, signal } = calcMACD(closes);
      const roc = calcROC(closes, 10);
      const { state, confidence } = scoreAndState(rsi, macd, signal, roc);
      return { timeframe: tf, rsi, macd, signal, roc, state, confidence };
    } catch {
      return { timeframe: tf, state: 'neutral', confidence: 0 };
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const res = await Promise.all([computeFor('5m'), computeFor('15m'), computeFor('1h')]);
      if (!cancelled) { setResults(res); setUpdatedAt(Date.now()); }
    }
    run();
    const id = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const getStateIcon = (state: string) => {
    switch (state) {
      case 'bullish':
        return <TrendingUp className="h-3 w-3 text-green-400" />;
      case 'bearish':
        return <TrendingDown className="h-3 w-3 text-red-400" />;
      default:
        return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'bullish':
        return 'text-green-400 border-green-400/20 bg-green-400/5';
      case 'bearish':
        return 'text-red-400 border-red-400/20 bg-red-400/5';
      default:
        return 'text-muted-foreground border-border bg-muted/10';
    }
  };

  const composite = useMemo(() => {
    if (!results) return { percent: 0, state: 'neutral' as const };
    // Weights: 5m 0.2, 15m 0.3, 1h 0.5 using signed confidence
    const score = results.reduce((acc, r) => {
      const w = r.timeframe === '5m' ? 0.2 : r.timeframe === '15m' ? 0.3 : 0.5;
      const s = r.state === 'bullish' ? 1 : r.state === 'bearish' ? -1 : 0;
      return acc + w * s * (r.confidence / 100);
    }, 0);
    const percent = Math.round(Math.min(1, Math.abs(score)) * 100);
    const state = score > 0.15 ? 'bullish' : score < -0.15 ? 'bearish' : 'neutral';
    return { percent, state };
  }, [results]);

  const displayResults: TFResult[] = useMemo(() => {
    return results ?? [
      { timeframe: '5m', state: 'neutral', confidence: 0 },
      { timeframe: '15m', state: 'neutral', confidence: 0 },
      { timeframe: '1h', state: 'neutral', confidence: 0 },
    ];
  }, [results]);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Short-term Momentum</h3>
          <Badge variant="outline" className={getStateColor(composite.state)}>
            {composite.state.charAt(0).toUpperCase() + composite.state.slice(1)}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {displayResults.map((item) => (
            <div
              key={item.timeframe}
              className={`p-3 rounded-lg border ${getStateColor(item.state)} transition-colors`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{item.timeframe}</span>
                {getStateIcon(item.state)}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Confidence</span>
                  <div className="flex-1">
                    <Progress 
                      value={item.confidence} 
                      className="h-1"
                    />
                  </div>
                  <span className="text-xs">{item.confidence}%</span>
                </div>
                
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>RSI(14):</span>
                    <span>{item.rsi != null ? Math.round(item.rsi) : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MACD:</span>
                    <span>{item.macd != null ? (item.macd > 0 ? '+' : '') + item.macd.toFixed(3) : '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ROC:</span>
                    <span>{item.roc != null ? (item.roc > 0 ? '+' : '') + item.roc.toFixed(1) + '%' : '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-muted/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Composite Momentum</span>
            <div className="flex items-center gap-1">
              {getStateIcon(composite.state)}
              <span className="text-sm">{composite.percent}%</span>
            </div>
          </div>
          <Progress 
            value={composite.percent} 
            className="h-2"
          />
          {updatedAt && (
            <div className="mt-2 text-[10px] text-muted-foreground">Updated {Math.max(0, Math.floor((Date.now()-updatedAt)/1000))}s ago</div>
          )}
        </div>
      </div>
    </Card>
  );
}