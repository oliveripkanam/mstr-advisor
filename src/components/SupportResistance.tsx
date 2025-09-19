import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Target, TrendingUp, TrendingDown, Circle } from "lucide-react";
import { Progress } from "./ui/progress";

interface SRLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  origin: 'volume' | 'swing' | 'fibonacci';
  probability: number;
  target?: number;
}

interface SupportResistanceProps {
  onLevelHover: (price: number) => void;
  onTargetClick: (price: number) => void;
}

export function SupportResistance({ onLevelHover, onTargetClick }: SupportResistanceProps) {
  const currentPrice = 64234;
  
  const srLevels: SRLevel[] = [
    {
      price: 66200,
      type: 'resistance',
      strength: 5,
      origin: 'volume',
      probability: 75,
      target: 68500
    },
    {
      price: 65100,
      type: 'resistance',
      strength: 3,
      origin: 'swing',
      probability: 62,
      target: 66800
    },
    {
      price: 63800,
      type: 'support',
      strength: 4,
      origin: 'volume',
      probability: 68,
      target: 61500
    },
    {
      price: 62200,
      type: 'support',
      strength: 5,
      origin: 'fibonacci',
      probability: 80,
      target: 59800
    },
    {
      price: 60500,
      type: 'support',
      strength: 2,
      origin: 'swing',
      probability: 45,
      target: 58200
    }
  ];

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
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="font-medium">Support/Resistance + Targets</h3>
          <Badge variant="outline" className="text-xs">
            Current: ${currentPrice.toLocaleString()}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Select defaultValue="volume">
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="volume">Volume Profile</SelectItem>
              <SelectItem value="swing">Swing Levels</SelectItem>
              <SelectItem value="fibonacci">Fibonacci</SelectItem>
            </SelectContent>
          </Select>
          
          <Select defaultValue="10">
            <SelectTrigger className="w-20 h-8">
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
        {srLevels.map((level, index) => {
          const isAboveCurrent = level.price > currentPrice;
          const distance = getDistanceFromCurrent(level.price);
          
          return (
            <div
              key={index}
              className="group p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer"
              onMouseEnter={() => onLevelHover(level.price)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-mono">
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

                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground">
                    {distance.toFixed(1)}% {isAboveCurrent ? 'above' : 'below'}
                  </div>
                  
                  {level.target && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
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
                      left: `${((currentPrice - Math.min(...srLevels.map(l => l.price))) / 
                        (Math.max(...srLevels.map(l => l.price)) - Math.min(...srLevels.map(l => l.price)))) * 100}%` 
                    }}
                  />
                  
                  {/* Level indicator */}
                  <div 
                    className={`absolute top-0 w-1 h-full z-20 ${
                      level.type === 'support' ? 'bg-green-400' : 'bg-red-400'
                    }`}
                    style={{ 
                      left: `${((level.price - Math.min(...srLevels.map(l => l.price))) / 
                        (Math.max(...srLevels.map(l => l.price)) - Math.min(...srLevels.map(l => l.price)))) * 100}%` 
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