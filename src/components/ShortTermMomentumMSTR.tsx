import { useEffect, useMemo, useState, useCallback } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";

type TF = '5m' | '15m' | '1h';

interface TFResult {
  timeframe: TF;
  rsi?: number;
  macd?: number; // MACD line (fast-slow) or histogram, we keep parity with BTC card by using line
  signal?: number; // signal line
  roc?: number; // %
  state: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0..100
  lastTimestamp?: number; // ms since epoch of most recent bar
  exchangeTimezone?: string;
  marketState?: string;
  lastRegularTimestamp?: number;
}

const YAHOO_BASE = (import.meta.env.VITE_YAHOO_PROXY_URL as string | undefined)
  ?? (import.meta.env.VITE_YAHOO_VERCEL_URL as string | undefined)
  ?? '/api/yahoo';

function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
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
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const rsiScore = rsi == null ? 0 : clamp((rsi - 50) / 25, -1, 1);
  const macdScore = macd == null || signal == null ? 0 : (macd - signal > 0 ? 0.6 : -0.6);
  const rocScore = roc == null ? 0 : clamp(roc / 2, -1, 1);
  const total = 0.45 * rsiScore + 0.35 * rocScore + 0.20 * macdScore;
  const state: TFResult['state'] = total > 0.12 ? 'bullish' : total < -0.12 ? 'bearish' : 'neutral';
  const confidence = Math.round(Math.min(1, Math.abs(total)) * 100);
  return { state, confidence };
}

type YahooInterval = '5m' | '15m' | '60m';
function tfToYahoo(tf: TF): { interval: YahooInterval; range: string } {
  switch (tf) {
    case '5m': return { interval: '5m', range: '5d' };
    case '15m': return { interval: '15m', range: '1mo' };
    case '1h': return { interval: '60m', range: '3mo' };
  }
}

interface FetchMstrClosesResult {
  closes: number[];
  timestamps: number[];
  exchangeTimezone?: string;
  marketState?: string;
  regularMarketTime?: number;
  regularSessionClose?: number;
}

interface MomentumContext {
  exchangeTimezone: string;
  marketState?: string;
  latestTimestamp?: number;
  lastRegularTimestamp?: number;
}

interface StaleInfo {
  message: string;
  exchangeTimezone: string;
  referenceTimestamp?: number;
}

function formatInTimeZone(ms: number, timeZone: string): string {
  const date = new Date(ms);
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

function isWeekendInTimeZone(ms: number, timeZone: string): boolean {
  const date = new Date(ms);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date);
  return weekday === 'Saturday' || weekday === 'Sunday';
}

function determineStaleInfo(context: MomentumContext, nowMs: number): StaleInfo | null {
  const exchangeTimezone = context.exchangeTimezone || 'America/New_York';
  const referenceTimestamp = context.lastRegularTimestamp ?? context.latestTimestamp;
  const marketState = (context.marketState ?? '').toUpperCase();
  const weekend = isWeekendInTimeZone(nowMs, exchangeTimezone);
  const hoursSinceReference = referenceTimestamp ? (nowMs - referenceTimestamp) / 3_600_000 : Number.POSITIVE_INFINITY;
  const isWeekendClosure = weekend;
  const isExtendedClosure = !weekend && marketState === 'CLOSED' && hoursSinceReference >= 36;
  if (!isWeekendClosure && !isExtendedClosure) return null;
  const messageBase = isWeekendClosure ? 'Market closed for weekend' : 'Market closed';
  if (!referenceTimestamp || !isFinite(referenceTimestamp)) {
    return { message: messageBase, exchangeTimezone };
  }
  const formatted = formatInTimeZone(referenceTimestamp, exchangeTimezone);
  return {
    message: `${messageBase} — showing data from ${formatted}`,
    exchangeTimezone,
    referenceTimestamp,
  };
}

async function fetchMstrCloses(tf: TF, limit = 320): Promise<FetchMstrClosesResult> {
  const { interval, range } = tfToYahoo(tf);
  const url = `${YAHOO_BASE}/v8/finance/chart/MSTR?interval=${interval}&range=${range}&includePrePost=true`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('MSTR chart fetch failed');
  const j = await r.json();
  const result = j?.chart?.result?.[0];
  const meta: Record<string, any> | undefined = result?.meta ?? undefined;
  const timestampsRaw: Array<number | null | undefined> = Array.isArray(result?.timestamp) ? result?.timestamp ?? [] : [];
  const quote = result?.indicators?.quote?.[0];
  const closesRaw: Array<number | null | undefined> = Array.isArray(quote?.close) ? quote.close : [];

  const filteredCloses: number[] = [];
  const filteredTs: number[] = [];
  const len = Math.min(closesRaw.length, timestampsRaw.length);
  for (let i = 0; i < len; i++) {
    const close = closesRaw[i];
    const ts = timestampsRaw[i];
    if (typeof close === 'number' && isFinite(close) && typeof ts === 'number' && isFinite(ts)) {
      filteredCloses.push(close);
      filteredTs.push(ts);
    }
  }

  const end = filteredCloses.length;
  const start = Math.max(0, end - limit);
  return {
    closes: filteredCloses.slice(start),
    timestamps: filteredTs.slice(start),
    exchangeTimezone: typeof meta?.exchangeTimezoneName === 'string' ? meta.exchangeTimezoneName : undefined,
    marketState: typeof meta?.marketState === 'string' ? meta.marketState : undefined,
    regularMarketTime: typeof meta?.regularMarketTime === 'number' ? meta.regularMarketTime : undefined,
    regularSessionClose: typeof meta?.currentTradingPeriod?.regular?.end === 'number'
      ? meta.currentTradingPeriod.regular.end
      : undefined,
  };
}

export function ShortTermMomentumMSTR() {
  const [results, setResults] = useState<TFResult[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [momentumContext, setMomentumContext] = useState<MomentumContext | null>(null);
  const [staleInfo, setStaleInfo] = useState<StaleInfo | null>(null);

  const computeFor = useCallback(async (tf: TF): Promise<TFResult> => {
    try {
      const data = await fetchMstrCloses(tf, 320);
      const closes = data.closes;
      const rsi = calcRSI14(closes);
      const { macd, signal } = calcMACD(closes);
      const roc = calcROC(closes, 10);
      const { state, confidence } = scoreAndState(rsi, macd, signal, roc);
      const lastTimestampSec = data.timestamps[data.timestamps.length - 1];
      const lastTimestamp = typeof lastTimestampSec === 'number' ? lastTimestampSec * 1000 : undefined;
      const regularMarketMs = typeof data.regularMarketTime === 'number' ? data.regularMarketTime * 1000 : undefined;
      const regularSessionCloseMs = typeof data.regularSessionClose === 'number' ? data.regularSessionClose * 1000 : undefined;
      const lastRegularTimestamp = regularMarketMs ?? regularSessionCloseMs ?? lastTimestamp;
          return {
            timeframe: tf,
            rsi,
            macd,
            signal,
            roc,
            state,
            confidence,
            lastTimestamp,
            exchangeTimezone: data.exchangeTimezone,
            marketState: data.marketState,
            lastRegularTimestamp,
          };
    } catch {
      return { timeframe: tf, state: 'neutral', confidence: 0 };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setStatus('loading');
      const res = await Promise.all([computeFor('5m'), computeFor('15m'), computeFor('1h')]);
      if (cancelled) return;
      setResults(res);
      const latestTimestampValue = res.reduce<number>((max, r) => {
        const ts = typeof r.lastTimestamp === 'number' ? r.lastTimestamp : 0;
        return ts > max ? ts : max;
      }, 0);
      const latestTimestamp = latestTimestampValue > 0 ? latestTimestampValue : undefined;

      const exchangeTimezone = (() => {
        for (const r of res) {
          if (r.exchangeTimezone) return r.exchangeTimezone;
        }
        return 'America/New_York';
      })();

      const marketState = (() => {
        for (const r of res) {
          if (r.marketState) return r.marketState;
        }
        return undefined;
      })();

      let lastRegularTimestamp: number | undefined;
      for (const r of res) {
        if (typeof r.lastRegularTimestamp === 'number') {
          lastRegularTimestamp = r.lastRegularTimestamp;
          break;
        }
      }

      const context: MomentumContext = {
        exchangeTimezone,
        marketState,
        latestTimestamp,
        lastRegularTimestamp,
      };

      setMomentumContext(context);
      setStaleInfo(determineStaleInfo(context, Date.now()));
      setUpdatedAt(latestTimestamp ?? Date.now());
      setStatus('ready');
    }
    run();
    const id = setInterval(run, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [computeFor]);

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

  const exchangeTimezone = useMemo(() => {
    if (momentumContext?.exchangeTimezone) return momentumContext.exchangeTimezone;
    if (results) {
      for (const r of results) {
        if (r.exchangeTimezone) return r.exchangeTimezone;
      }
    }
    if (staleInfo?.exchangeTimezone) return staleInfo.exchangeTimezone;
    return 'America/New_York';
  }, [momentumContext, results, staleInfo]);

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium">Short-term Momentum (MSTR)</h3>
          <Badge variant="outline" className={getStateColor(composite.state)}>
            {composite.state.charAt(0).toUpperCase() + composite.state.slice(1)}
          </Badge>
        </div>

        {staleInfo && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
            <Clock className="h-3 w-3" />
            <span>{staleInfo.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        </div>

        <div className="mt-2 text-xs text-muted-foreground space-y-1">
          <div>
            For each timeframe (5m, 15m, 1h), we pull the latest intraday MSTR closes from Yahoo Finance via the app proxy and apply the same RSI/MACD/ROC blend.
          </div>
          {updatedAt && (
            <div>
              Last update: {formatInTimeZone(updatedAt, exchangeTimezone)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default ShortTermMomentumMSTR;
