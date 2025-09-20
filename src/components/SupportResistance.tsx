import { useEffect, useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Target, Circle } from "lucide-react";

interface SRLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  origin: 'volume' | 'swing' | 'fibonacci' | 'confluence';
  probability: number;
  target?: number;
}

interface SupportResistanceProps {
  onLevelHover: (price: number) => void;
  onTargetClick: (price: number) => void;
}

export function SupportResistance({ onLevelHover, onTargetClick }: SupportResistanceProps) {
  const [method, setMethod] = useState<'volume' | 'swing' | 'fibonacci' | 'all'>("volume");
  const [count, setCount] = useState<number>(10);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [levels, setLevels] = useState<SRLevel[]>([]);
  const [klines, setKlines] = useState<any[] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  async function getJson(url: string) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('fetch failed');
    return r.json();
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const prem = await getJson('/proxy/binance-fapi/fapi/v1/premiumIndex?symbol=BTCUSDT');
        const mark = Number(prem?.markPrice);
        if (!cancelled && isFinite(mark)) setCurrentPrice(mark);
        const ks = await getJson('/proxy/binance-fapi/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=1000');
        if (!cancelled && Array.isArray(ks)) setKlines(ks);
      } catch {
        
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const computedLevels = useMemo<SRLevel[]>(() => {
    if (!klines || !currentPrice) return [];
    const highs = klines.map(k => Number(k[2]));
    const lows = klines.map(k => Number(k[3]));
    const closes = klines.map(k => Number(k[4]));
    const volQuote = klines.map(k => Number(k[7]) || (Number(k[5]) * Number(k[4])));

    const pivots: { price: number; type: 'high' | 'low'; score: number }[] = [];
    const window = 3;
    const maxVolQ = Math.max(1, ...volQuote);
    for (let i = window; i < highs.length - window; i++) {
      const rangeHighs = highs.slice(i - window, i + window + 1);
      const rangeLows = lows.slice(i - window, i + window + 1);
      const isHigh = rangeHighs.every((h) => h <= highs[i]);
      const isLow = rangeLows.every((l) => l >= lows[i]);
      if (isHigh) {
        const amp = (highs[i] - Math.min(...rangeLows)) / Math.max(1, Math.min(...rangeLows));
        const score = amp * 0.6 + (volQuote[i] / maxVolQ) * 0.4;
        pivots.push({ price: highs[i], type: 'high', score });
      }
      if (isLow) {
        const amp = (Math.max(...rangeHighs) - lows[i]) / Math.max(1, lows[i]);
        const score = amp * 0.6 + (volQuote[i] / maxVolQ) * 0.4;
        pivots.push({ price: lows[i], type: 'low', score });
      }
    }

    const typPrices = klines.map(k => (Number(k[2]) + Number(k[3]) + Number(k[4])) / 3);
    const minP = Math.min(...typPrices);
    const maxP = Math.max(...typPrices);
    const bins = 40;
    const binSize = (maxP - minP) / bins || 1;
    const volBins = new Array(bins).fill(0);
    for (let i = 0; i < typPrices.length; i++) {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((typPrices[i] - minP) / binSize)));
      volBins[idx] += volQuote[i];
    }
    const volLevels = volBins.map((v, i) => ({ price: minP + (i + 0.5) * binSize, score: v }));
    const maxVol = Math.max(1, ...volBins);

    const lastHigh = Math.max(...highs.slice(-200));
    const lastLow = Math.min(...lows.slice(-200));
    const range = lastHigh - lastLow || 1;
    const fibs = [0.382, 0.5, 0.618].map(r => lastHigh - r * range);

    const tol = currentPrice * 0.0025; // ~0.25%
    const pivotClusters: { price: number; type: 'support' | 'resistance'; swingScore: number }[] = [];
    const pivotSorted = [...pivots].sort((a, b) => a.price - b.price);
    let cluster: { prices: number[]; type: 'support' | 'resistance'; score: number } | null = null;
    for (const p of pivotSorted) {
      const t: 'support' | 'resistance' = p.type === 'low' ? 'support' : 'resistance';
      if (!cluster) {
        cluster = { prices: [p.price], type: t, score: p.score };
      } else if (Math.abs(p.price - cluster.prices[cluster.prices.length - 1]) <= tol) {
        cluster.prices.push(p.price);
        cluster.score += p.score;
      } else {
        const price = cluster.prices.reduce((a, b) => a + b, 0) / cluster.prices.length;
        pivotClusters.push({ price, type: cluster.type, swingScore: cluster.score });
        cluster = { prices: [p.price], type: t, score: p.score };
      }
    }
    if (cluster) {
      const price = cluster.prices.reduce((a, b) => a + b, 0) / cluster.prices.length;
      pivotClusters.push({ price, type: cluster.type, swingScore: cluster.score });
    }

    const candidates: SRLevel[] = [];
    if (method === 'volume' || method === 'all') {
      const topVol = volLevels
        .map(v => ({ ...v, norm: v.score / maxVol }))
        .sort((a, b) => b.norm - a.norm)
        .slice(0, 30);
      for (const v of topVol) {
        const type: 'support' | 'resistance' = v.price <= currentPrice ? 'support' : 'resistance';
        const prob = Math.round(v.norm * 80);
        candidates.push({ price: v.price, type, strength: Math.max(1, Math.round(v.norm * 5)), origin: 'volume', probability: prob });
      }
    }
    if (method === 'swing' || method === 'all') {
      const maxSwing = Math.max(1, ...pivotClusters.map(p => p.swingScore));
      for (const s of pivotClusters) {
        const norm = s.swingScore / maxSwing;
        candidates.push({ price: s.price, type: s.type, strength: Math.max(1, Math.round(norm * 5)), origin: 'swing', probability: Math.round(norm * 85) });
      }
    }
    if (method === 'fibonacci' || method === 'all') {
      for (const fp of fibs) {
        const type: 'support' | 'resistance' = fp <= currentPrice ? 'support' : 'resistance';
        candidates.push({ price: fp, type, strength: 3, origin: 'fibonacci', probability: 55 });
      }
    }

    const merged: SRLevel[] = [];
    const sorted = candidates.sort((a, b) => a.price - b.price);
    let cur: SRLevel | null = null;
    for (const c of sorted) {
      if (!cur) { cur = { ...c }; continue; }
      if (Math.abs(c.price - cur.price) <= tol) {
        const weight1 = cur.probability;
        const weight2 = c.probability;
        const price = (cur.price * weight1 + c.price * weight2) / (weight1 + weight2 || 1);
        cur.price = price;
        cur.probability = Math.min(95, Math.round(Math.max(cur.probability, c.probability) * 0.6 + (cur.probability + c.probability) * 0.2));
        cur.strength = Math.min(5, Math.max(cur.strength, c.strength));
        cur.origin = cur.origin === c.origin ? cur.origin : 'confluence';
        cur.type = price <= currentPrice ? 'support' : 'resistance';
      } else {
        merged.push(cur);
        cur = { ...c };
      }
    }
    if (cur) merged.push(cur);

    const uniq: SRLevel[] = [];
    for (const lvl of merged) {
      if (!uniq.some(u => Math.abs(u.price - lvl.price) <= tol)) uniq.push(lvl);
    }

    const supports = uniq.filter(l => l.type === 'support').sort((a, b) => b.price - a.price);
    const resistances = uniq.filter(l => l.type === 'resistance').sort((a, b) => a.price - b.price);
    supports.forEach((l, i) => { l.target = supports[i + 1]?.price ?? l.price * 0.975; });
    resistances.forEach((l, i) => { l.target = resistances[i + 1]?.price ?? l.price * 1.025; });

    const ranked = uniq
      .map(l => ({
        ...l,
        score: l.probability * (1 - Math.min(0.15, Math.abs(l.price - currentPrice) / (currentPrice * 0.15)))
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(({ score, ...rest }) => rest);

    return ranked;
  }, [klines, currentPrice, count, method]);

  useEffect(() => { setLevels(computedLevels); }, [computedLevels]);

  const getStrengthDots = (strength: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Circle
        key={i}
        className={`h-1.5 w-1.5 ${
          i < strength ? 'fill-current text-blue-500' : 'text-muted-foreground/30'
        }`}
      />
    ));
  };

  const getDistanceFromCurrent = (price: number) => {
    const distance = Math.abs(price - currentPrice);
    const percentage = (distance / currentPrice) * 100;
    return percentage;
  };

  const getProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'bg-green-400';
    if (probability >= 50) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  return (
  <Card className="p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h3 className="font-medium">Support/Resistance + Targets</h3>
          <Badge variant="outline" className="text-xs">
            Current: ${currentPrice.toLocaleString()}
          </Badge>
        </div>
        
  <div className="flex items-center gap-2 flex-wrap w-full">
          <Select value={method} onValueChange={(v) => setMethod((v as any))}>
            <SelectTrigger className="h-8 w-full sm:w-36 max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="volume">Volume Profile</SelectItem>
              <SelectItem value="swing">Swing Levels</SelectItem>
              <SelectItem value="fibonacci">Fibonacci</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
            <SelectTrigger className="h-8 w-24 sm:w-24 max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            Show on Chart
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {(levels.length ? levels : Array.from({ length: Math.min(5, count) }, () => null)).map((level, index) => {
          if (!level) {
            return (
              <div key={index} className="p-3 rounded-lg border bg-muted/10 animate-pulse" />
            );
          }
          const isAboveCurrent = level.price > currentPrice;
          const distance = getDistanceFromCurrent(level.price);
          
          return (
            <div
              key={index}
              className="group p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer overflow-hidden"
              onMouseEnter={() => onLevelHover(level.price)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <div className="text-sm font-mono whitespace-nowrap">
                    ${level.price.toLocaleString()}
                  </div>
                  
                  <Badge 
                    variant={level.type === 'support' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {level.type === 'support' ? 'Support' : 'Resistance'}
                  </Badge>
                  
                  <div className="flex items-center gap-1">
                    {getStrengthDots(level.strength)}
                  </div>
                  
                  <Badge variant="outline" className="text-xs capitalize">
                    {level.origin}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {distance.toFixed(1)}% {isAboveCurrent ? 'above' : 'below'}
                  </div>
                  
                  {level.target && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs shrink-0"
                      onClick={() => onTargetClick(level.target!)}
                    >
                      <Target className="h-3 w-3 mr-1" />
                      ${level.target.toLocaleString()}
                    </Button>
                  )}
                </div>
              </div>

              {/* Mini chart visualization */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-2 bg-muted rounded-full relative overflow-hidden">
                  {/* Current price indicator */}
                  <div 
                    className="absolute top-0 w-0.5 h-full bg-foreground z-10"
                    style={{ 
                      left: `${(() => {
                        const prices = levels.map(l => l.price);
                        const lo = Math.min(...prices);
                        const hi = Math.max(...prices);
                        return ((currentPrice - lo) / Math.max(1, hi - lo)) * 100;
                      })()}%` 
                    }}
                  />
                  
                  {/* Level indicator */}
                  <div 
                    className={`absolute top-0 w-1 h-full z-20 ${
                      level.type === 'support' ? 'bg-green-400' : 'bg-red-400'
                    }`}
                    style={{ 
                      left: `${(() => {
                        const prices = levels.map(l => l.price);
                        const lo = Math.min(...prices);
                        const hi = Math.max(...prices);
                        return ((level.price - lo) / Math.max(1, hi - lo)) * 100;
                      })()}%` 
                    }}
                  />
                  
                  {/* Probability bar */}
                  <div 
                    className={`h-full ${getProbabilityColor(level.probability)}`}
                    style={{ width: `${level.probability}%` }}
                  />
                </div>
                
                <div className="text-xs text-muted-foreground w-12 text-right">
                  {level.probability}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}