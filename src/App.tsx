import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import TradingViewWidget, { mapTimeframeToTVInterval } from "./components/TradingViewWidget";
import { MonitorTiles } from "./components/MonitorTiles";
import { MomentumIndicator } from "./components/MomentumIndicator";
import ShortTermMomentumMSTR from "./components/ShortTermMomentumMSTR";
import PerpFundingOI from "./components/PerpFundingOI";
import { MstrNav } from "./components/MstrNav";
import { SupportResistance } from "./components/SupportResistance";
import DailyCloseTracker from "./components/daily-close/DailyCloseTracker";
import { Footer } from "./components/Footer";

export default function App() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['Compare']);
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['15m']);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [btcPrice, setBtcPrice] = useState<number>(0);
  const [mstrPrice, setMstrPrice] = useState<number>(0);

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

  const handlePriceUpdate = (btc: number, mstr: number) => {
    setBtcPrice(btc);
    setMstrPrice(mstr);
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

  <MonitorTiles onTileClick={handleTileClick} timeframe={(selectedTimeframes[0] as any) ?? '15m'} onPriceUpdate={handlePriceUpdate} />

  <div className="grid grid-cols-1 gap-4 sm:gap-6 mt-6 px-3 sm:px-4">
          {/* Row: Perp Funding + OI full width */}
          <div>
            <PerpFundingOI />
          </div>

          {/* Row: Two-column momentum cards (BTC left, MSTR right) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MomentumIndicator />
            <ShortTermMomentumMSTR />
          </div>

          {/* Row: MSTR mNAV full width */}
          <div>
            <MstrNav btcPrice={btcPrice} mstrPrice={mstrPrice} />
          </div>

          {/* Row: Support/Resistance full width */}
          <div>
            <SupportResistance
              onLevelHover={handlePriceHover}
              onTargetClick={handleTargetClick}
            />
          </div>

          {/* Row: Week-to-Date Daily Close Tracker */}
          <div>
            <DailyCloseTracker />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}