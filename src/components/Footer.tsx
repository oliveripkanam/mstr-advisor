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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3" />
              <span>Data Sources:</span>
              <Badge variant="outline" className="text-xs">Binance</Badge>
              <Badge variant="outline" className="text-xs">CoinGecko</Badge>
              <Badge variant="outline" className="text-xs">TradingView</Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
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