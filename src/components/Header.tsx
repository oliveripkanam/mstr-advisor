import { Button } from "./ui/button";
import { Moon, Sun } from "lucide-react";

interface HeaderProps {
  selectedSymbols: string[];
  onSymbolChange: (symbols: string[]) => void;
  selectedTimeframes: string[];
  onTimeframeChange: (timeframes: string[]) => void;
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
}

export function Header({ 
  selectedSymbols, 
  onSymbolChange, 
  selectedTimeframes, 
  onTimeframeChange, 
  theme, 
  onThemeToggle 
}: HeaderProps) {
  const symbols = ['BTC', 'MSTR', 'Compare'];
  const timeframes = ['1m', '5m', '15m', '1h', '4h'];

  const toggleSymbol = (symbol: string) => {
    const hasCompare = selectedSymbols.includes('Compare');

    if (symbol === 'Compare') {
      // When Compare is pressed, neither BTC nor MSTR should be selected
      const enable = !hasCompare;
      onSymbolChange(enable ? ['Compare'] : []);
      return;
    }

    // symbol is BTC or MSTR; make it exclusive; if Compare is currently on, turn it off
    onSymbolChange([symbol]);
  };

  const toggleTimeframe = (timeframe: string) => {
    // Single-select timeframe; always set the chosen one
    onTimeframeChange([timeframe]);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full max-w-none px-3 sm:px-4 py-2">
  {/* Mobile layout (stacked): Title+Theme, then Symbols, then Timeframe */}
        <div className="only-mobile space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-base sm:text-lg font-semibold">MSTR/BTC Monitor</h1>
            <Button
              variant="outline"
              size="icon"
              onClick={onThemeToggle}
              className="h-8 w-8"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Symbols:</span>
            {symbols.map((symbol) => (
              <Button
                key={symbol}
                variant={selectedSymbols.includes(symbol) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleSymbol(symbol)}
                className="h-8 px-3 whitespace-nowrap"
              >
                {symbol}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm text-muted-foreground">Timeframe:</span>
            {timeframes.map((timeframe) => (
              <Button
                key={timeframe}
                variant={selectedTimeframes.includes(timeframe) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleTimeframe(timeframe)}
                className="h-8 px-3 whitespace-nowrap"
              >
                {timeframe}
              </Button>
            ))}
          </div>
        </div>

        {/* Tablet/Desktop layout (md+): single row, theme pinned to far right */}
        <div className="only-desktop items-center justify-between gap-3 md:flex-nowrap">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-semibold flex-shrink-0">MSTR/BTC Monitor</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground">Symbols:</span>
              {symbols.map((symbol) => (
                <Button
                  key={symbol}
                  variant={selectedSymbols.includes(symbol) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleSymbol(symbol)}
                  className="h-8 px-3 whitespace-nowrap"
                >
                  {symbol}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground">Timeframe:</span>
              {timeframes.map((timeframe) => (
                <Button
                  key={timeframe}
                  variant={selectedTimeframes.includes(timeframe) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleTimeframe(timeframe)}
                  className="h-8 px-3 whitespace-nowrap"
                >
                  {timeframe}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Button
              variant="outline"
              size="icon"
              onClick={onThemeToggle}
              className="h-8 w-8"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}