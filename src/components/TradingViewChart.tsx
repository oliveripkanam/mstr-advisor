import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { TrendingUp, TrendingDown, Target } from "lucide-react";

interface TradingViewChartProps {
  selectedSymbols: string[];
  selectedTimeframes: string[];
}

// Mock price data
const generatePriceData = (symbol: string, points: number = 100) => {
  const basePrice = symbol === 'BTC' ? 64000 : symbol === 'MSTR' ? 180 : 1;
  const data = [];
  let price = basePrice;
  
  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.5) * (basePrice * 0.02);
    price += change;
    data.push({
      time: new Date(Date.now() - (points - i) * 15 * 60 * 1000).toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      [symbol]: Math.round(price * 100) / 100,
      timestamp: Date.now() - (points - i) * 15 * 60 * 1000
    });
  }
  return data;
};

export function TradingViewChart({ selectedSymbols, selectedTimeframes }: TradingViewChartProps) {
  const btcData = generatePriceData('BTC');
  const mstrData = generatePriceData('MSTR');
  
  // Combine data for comparison
  const combinedData = btcData.map((item, index) => ({
    ...item,
    MSTR: mstrData[index]?.MSTR || 0,
    BTCPercent: ((item.BTC - btcData[0].BTC) / btcData[0].BTC) * 100,
    MSTRPercent: ((mstrData[index]?.MSTR - mstrData[0]?.MSTR) / mstrData[0]?.MSTR) * 100
  }));

  const currentBTC = combinedData[combinedData.length - 1];
  const btcChange = ((currentBTC.BTC - combinedData[0].BTC) / combinedData[0].BTC) * 100;
  const mstrChange = ((currentBTC.MSTR - combinedData[0].MSTR) / combinedData[0].MSTR) * 100;

  const showCompare = selectedSymbols.includes('Compare');
  const primarySymbol = selectedSymbols.includes('BTC') ? 'BTC' : 'MSTR';

  return (
    <Card className="h-[65vh] min-h-[400px] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {primarySymbol}USD
            </Badge>
            {showCompare && (
              <Badge variant="secondary" className="text-xs">
                Compare Mode
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg font-mono">
                ${primarySymbol === 'BTC' ? currentBTC.BTC.toLocaleString() : currentBTC.MSTR.toFixed(2)}
              </span>
              <span className={`flex items-center gap-1 ${(primarySymbol === 'BTC' ? btcChange : mstrChange) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(primarySymbol === 'BTC' ? btcChange : mstrChange) >= 0 ? 
                  <TrendingUp className="h-3 w-3" /> : 
                  <TrendingDown className="h-3 w-3" />
                }
                {Math.abs(primarySymbol === 'BTC' ? btcChange : mstrChange).toFixed(2)}%
              </span>
            </div>
            
            {showCompare && (
              <div className="text-muted-foreground">
                <span>Correlation (30D): 0.73</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            EMA
          </Button>
          <Button variant="outline" size="sm">
            VWAP
          </Button>
          <Button variant="outline" size="sm">
            <Target className="h-3 w-3 mr-1" />
            S/R
          </Button>
        </div>
      </div>

      <div className="h-[calc(100%-5rem)]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={combinedData}>
            <XAxis 
              dataKey="time" 
              stroke="#666"
              fontSize={12}
              tick={{ fill: '#666' }}
            />
            <YAxis 
              yAxisId="price"
              stroke="#666"
              fontSize={12}
              tick={{ fill: '#666' }}
              domain={['dataMin - 1000', 'dataMax + 1000']}
            />
            {showCompare && (
              <YAxis 
                yAxisId="percent"
                orientation="right"
                stroke="#666"
                fontSize={12}
                tick={{ fill: '#666' }}
              />
            )}
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--background))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px'
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            
            {selectedSymbols.includes('BTC') && (
              <Line
                yAxisId={showCompare ? "percent" : "price"}
                type="monotone"
                dataKey={showCompare ? "BTCPercent" : "BTC"}
                stroke="#f59e0b"
                strokeWidth={1.5}
                dot={false}
                name={showCompare ? "BTC %" : "BTC"}
              />
            )}
            
            {selectedSymbols.includes('MSTR') && (
              <Line
                yAxisId={showCompare ? "percent" : "price"}
                type="monotone"
                dataKey={showCompare ? "MSTRPercent" : "MSTR"}
                stroke="#22c55e"
                strokeWidth={1.5}
                dot={false}
                name={showCompare ? "MSTR %" : "MSTR"}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}