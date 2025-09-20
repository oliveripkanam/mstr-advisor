import { Badge } from "./ui/badge";
import { Clock, Database, Wifi } from "lucide-react";

export function Footer() {
  const currentTime = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <footer className="border-t bg-background/95 backdrop-blur">
      <div className="w-full px-3 sm:px-4 py-3">
        {/* Mobile: stack; allow Live/Last updated to drop when space is tight */}
        <div className="only-mobile gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Database className="h-3 w-3" />
            <span>Data Sources:</span>
            <Badge variant="outline" className="text-xs">Binance</Badge>
            <Badge variant="outline" className="text-xs">CoinGecko</Badge>
            <Badge variant="outline" className="text-xs">TradingView</Badge>
          </div>
          <div className="flex items-center gap-4 flex-wrap mt-2">
            <div className="flex items-center gap-1">
              <Wifi className="h-3 w-3 text-green-400" />
              <span>Live</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Last updated: {currentTime}</span>
            </div>
          </div>
        </div>

        {/* Desktop/Tablet: single row with Live + Last updated on one line; nowrap to avoid breaking */}
        <div className="only-desktop items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <Database className="h-3 w-3" />
            <span>Data Sources:</span>
            <Badge variant="outline" className="text-xs">Binance</Badge>
            <Badge variant="outline" className="text-xs">CoinGecko</Badge>
            <Badge variant="outline" className="text-xs">TradingView</Badge>
          </div>
          <div className="flex items-center gap-4 whitespace-nowrap pc-ml-auto">
            <div className="flex items-center gap-1">
              <Wifi className="h-3 w-3 text-green-400" />
              <span>Live</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Last updated: {currentTime}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}