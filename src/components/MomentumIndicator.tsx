import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Progress } from "./ui/progress";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MomentumData {
  timeframe: string;
  state: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  rsi: number;
  macd: number;
  roc: number;
}

export function MomentumIndicator() {
  const momentumData: MomentumData[] = [
    {
      timeframe: '5m',
      state: 'bullish',
      confidence: 78,
      rsi: 64,
      macd: 0.12,
      roc: 2.3
    },
    {
      timeframe: '15m',
      state: 'bullish',
      confidence: 65,
      rsi: 58,
      macd: 0.08,
      roc: 1.8
    },
    {
      timeframe: '1h',
      state: 'neutral',
      confidence: 45,
      rsi: 52,
      macd: -0.02,
      roc: 0.4
    }
  ];

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

  // Calculate composite momentum
  const compositeMomentum = momentumData.reduce((acc, item) => {
    const weight = item.timeframe === '5m' ? 0.2 : item.timeframe === '15m' ? 0.3 : 0.5;
    const stateValue = item.state === 'bullish' ? 1 : item.state === 'bearish' ? -1 : 0;
    return acc + (stateValue * item.confidence * weight / 100);
  }, 0);

  const compositeMomentumPercent = Math.abs(compositeMomentum) * 50;
  const compositeState = compositeMomentum > 0.2 ? 'bullish' : compositeMomentum < -0.2 ? 'bearish' : 'neutral';

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Short-term Momentum</h3>
          <Badge variant="outline" className={getStateColor(compositeState)}>
            {compositeState.charAt(0).toUpperCase() + compositeState.slice(1)}
          </Badge>
        </div>

        {/* Timeframe chips */}
        <div className="grid grid-cols-3 gap-3">
          {momentumData.map((item) => (
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
                    <span>{item.rsi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MACD:</span>
                    <span>{item.macd > 0 ? '+' : ''}{item.macd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ROC:</span>
                    <span>{item.roc > 0 ? '+' : ''}{item.roc.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Composite meter */}
        <div className="mt-4 p-3 bg-muted/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Composite Momentum</span>
            <div className="flex items-center gap-1">
              {getStateIcon(compositeState)}
              <span className="text-sm">{compositeMomentumPercent.toFixed(0)}%</span>
            </div>
          </div>
          <Progress 
            value={compositeMomentumPercent} 
            className="h-2"
          />
        </div>
      </div>
    </Card>
  );
}