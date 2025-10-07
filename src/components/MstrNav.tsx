import { useMemo } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import mstrMetricsConfig from "../config/mstrMetrics.json";
import { formatCurrency, formatLargeCurrency } from "../lib/formatting";

interface MstrNavProps {
  btcPrice: number;
  mstrPrice: number;
}

interface MstrMetrics {
  bitcoinHoldings: number;
  sharesOutstandingBasic: number;
  sharesOutstandingDiluted: number;
  totalDebt: number;
  cashAndEquivalents: number;
  lastUpdated: string;
  updateSource: string;
  referenceData: {
    btcPriceAtUpdate: number;
    mstrPriceAtUpdate: number;
    mnavBasicAtUpdate: number;
    mnavDilutedAtUpdate: number;
  };
}

export function MstrNav({ btcPrice, mstrPrice }: MstrNavProps) {
  const metrics = mstrMetricsConfig as MstrMetrics;

  const isLoading = btcPrice === 0 || mstrPrice === 0;

  // Calculate real-time mNAV and premium
  const navData = useMemo(() => {
    if (!btcPrice || !mstrPrice || btcPrice <= 0 || mstrPrice <= 0) {
      return {
        btcPerShareBasic: 0,
        btcPerShareDiluted: 0,
        impliedNavBasic: 0,
        impliedNavDiluted: 0,
        mnavBasic: 0,
        mnavDiluted: 0,
        totalBtcValue: 0,
        netAssetValue: 0,
      };
    }

    // Basic calculation: BTC holdings / shares
    const btcPerShareBasic = metrics.bitcoinHoldings / metrics.sharesOutstandingBasic;
    const btcPerShareDiluted = metrics.bitcoinHoldings / metrics.sharesOutstandingDiluted;

    // Implied NAV = BTC per share × current BTC price
    const impliedNavBasic = btcPerShareBasic * btcPrice;
    const impliedNavDiluted = btcPerShareDiluted * btcPrice;

    // mNAV Ratio = MSTR price / implied NAV
    const mnavBasic = mstrPrice / impliedNavBasic;
    const mnavDiluted = mstrPrice / impliedNavDiluted;

    // Total BTC value
    const totalBtcValue = metrics.bitcoinHoldings * btcPrice;

    // Net Asset Value (accounting for debt)
    const netAssetValue = totalBtcValue + metrics.cashAndEquivalents - metrics.totalDebt;

    return {
      btcPerShareBasic,
      btcPerShareDiluted,
      impliedNavBasic,
      impliedNavDiluted,
      mnavBasic,
      mnavDiluted,
      totalBtcValue,
      netAssetValue,
    };
  }, [btcPrice, mstrPrice, metrics]);

  const getMnavColor = (mnav: number) => {
    if (mnav > 1.20) return "text-green-400";
    if (mnav > 1.0) return "text-green-500";
    if (mnav < 0.80) return "text-red-400";
    if (mnav < 1.0) return "text-red-500";
    return "text-muted-foreground";
  };

  const getMnavIcon = (mnav: number) => {
    if (mnav > 1.05) return <TrendingUp className="h-4 w-4 text-green-400" aria-label="Trading at premium" />;
    if (mnav < 0.95) return <TrendingDown className="h-4 w-4 text-red-400" aria-label="Trading at discount" />;
    return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Near parity" />;
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-medium">MSTR Net Asset Value (mNAV)</h3>
          <Badge variant="outline" className="text-xs">
            Holdings as of {metrics.lastUpdated}
          </Badge>
        </div>

        {/* Premium Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Basic mNAV */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Basic mNAV</span>
              {!isLoading && getMnavIcon(navData.mnavBasic)}
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Waiting for price data...</div>
            ) : (
              <>
                <div className={`text-2xl font-mono ${getMnavColor(navData.mnavBasic)}`}>
                  {navData.mnavBasic.toFixed(2)}x
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Implied NAV: ${formatCurrency(navData.impliedNavBasic)}
                </div>
              </>
            )}
          </div>

          {/* Diluted mNAV */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Diluted mNAV</span>
              {!isLoading && getMnavIcon(navData.mnavDiluted)}
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Waiting for price data...</div>
            ) : (
              <>
                <div className={`text-2xl font-mono ${getMnavColor(navData.mnavDiluted)}`}>
                  {navData.mnavDiluted.toFixed(2)}x
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Implied NAV: ${formatCurrency(navData.impliedNavDiluted)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Holdings Info */}
        <div className="p-3 bg-muted/20 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground mb-1">BTC Holdings</div>
              <div className="font-mono">{metrics.bitcoinHoldings.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">BTC Value</div>
              <div className="font-mono">{formatLargeCurrency(navData.totalBtcValue)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">BTC/Share (Basic)</div>
              <div className="font-mono">{formatCurrency(navData.btcPerShareBasic, 4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">BTC/Share (Diluted)</div>
              <div className="font-mono">{formatCurrency(navData.btcPerShareDiluted, 4)}</div>
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div className="text-xs text-muted-foreground">
          <div className="mb-1">
            <strong>mNAV Ratio</strong> shows MSTR's price relative to its Bitcoin holdings per share.
          </div>
          <div>
            Above 1.0x = trading at premium (market values MSTR above BTC holdings). 
            Below 1.0x = trading at discount (opportunity to buy BTC through MSTR at discount).
          </div>
        </div>
      </div>
    </Card>
  );
}
