import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import TradingViewWidget, { mapTimeframeToTVInterval } from "./components/TradingViewWidget";
import { MonitorTiles } from "./components/MonitorTiles";
import { MomentumIndicator } from "./components/MomentumIndicator";
import PerpFundingOI from "./components/PerpFundingOI";
import { SupportResistance } from "./components/SupportResistance";
import { Footer } from "./components/Footer";

export default function App() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['Compare']);
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['15m']);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Apply theme to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleThemeToggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleTileClick = (symbol: string) => {
    if (symbol === 'Compare') {
      setSelectedSymbols(['BTC', 'MSTR', 'Compare']);
    } else {
      setSelectedSymbols([symbol]);
    }
  };

  const handlePriceHover = (price: number) => {
    console.log('Hover price:', price);
  };

  const handleTargetClick = (price: number) => {
    console.log('Target price:', price);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        selectedSymbols={selectedSymbols}
        onSymbolChange={setSelectedSymbols}
        selectedTimeframes={selectedTimeframes}
        onTimeframeChange={setSelectedTimeframes}
        theme={theme}
        onThemeToggle={handleThemeToggle}
      />

  <main className="w-full max-w-none px-0 pb-8">
        <div className="mt-6">
          {(() => {
            const hasCompare = selectedSymbols.includes('Compare');
            const primarySymbol = selectedSymbols.includes('BTC') ? 'BTC' : selectedSymbols.includes('MSTR') ? 'MSTR' : 'BTC';
            const secondarySymbol = primarySymbol === 'BTC' ? 'MSTR' : 'BTC';

            const tf = selectedTimeframes[0] ?? '15m';
            const interval = mapTimeframeToTVInterval(tf);

            if (hasCompare) {
              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-3 sm:px-4">
                  <TradingViewWidget
                    symbol={primarySymbol}
                    interval={interval}
                    theme={theme}
                    withToolbar={true}
                    autosize={true}
                    allowCompare={true}
                    height="60vh"
                    minHeight={380}
                  />
                  <TradingViewWidget
                    symbol={secondarySymbol}
                    interval={interval}
                    theme={theme}
                    withToolbar={true}
                    autosize={true}
                    allowCompare={true}
                    height="60vh"
                    minHeight={380}
                  />
                </div>
              );
            }

            return (
              <TradingViewWidget
                symbol={primarySymbol}
                interval={interval}
                theme={theme}
                withToolbar={true}
                autosize={true}
                allowCompare={true}
                height="65vh"
                minHeight={400}
              />
            );
          })()}
        </div>

  <MonitorTiles onTileClick={handleTileClick} timeframe={(selectedTimeframes[0] as any) ?? '15m'} />

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-6 px-3 sm:px-4">
          {/* Top Row: Perp Funding + OI */}
          <div className="lg:col-span-2">
            <PerpFundingOI />
          </div>

          {/* Bottom Row */}
          <MomentumIndicator />
          <SupportResistance
            onLevelHover={handlePriceHover}
            onTargetClick={handleTargetClick}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}