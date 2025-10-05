import { useMemo } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import mstrMetricsConfig from "../config/mstrMetrics.json";

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
        premiumBasic: 0,
        premiumDiluted: 0,
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

    // Premium = (MSTR price / implied NAV) - 1
    const premiumBasic = ((mstrPrice / impliedNavBasic) - 1) * 100;
    const premiumDiluted = ((mstrPrice / impliedNavDiluted) - 1) * 100;

    // Total BTC value
    const totalBtcValue = metrics.bitcoinHoldings * btcPrice;

    // Net Asset Value (accounting for debt)
    const netAssetValue = totalBtcValue + metrics.cashAndEquivalents - metrics.totalDebt;

    return {
      btcPerShareBasic,
      btcPerShareDiluted,
      impliedNavBasic,
      impliedNavDiluted,
      premiumBasic,
      premiumDiluted,
      totalBtcValue,
      netAssetValue,
    };
  }, [btcPrice, mstrPrice, metrics]);

  const getPremiumColor = (premium: number) => {
    if (premium > 20) return "text-green-400";
    if (premium > 0) return "text-green-500";
    if (premium < -20) return "text-red-400";
    if (premium < 0) return "text-red-500";
    return "text-muted-foreground";
  };

  const getPremiumIcon = (premium: number) => {
    if (premium > 5) return <TrendingUp className="h-4 w-4 text-green-400" />;
    if (premium < -5) return <TrendingDown className="h-4 w-4 text-red-400" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatLargeNumber = (num: number) => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
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
          {/* Basic mNAV Premium */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Basic Premium</span>
              {!isLoading && getPremiumIcon(navData.premiumBasic)}
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Waiting for price data...</div>
            ) : (
              <>
                <div className={`text-2xl font-mono ${getPremiumColor(navData.premiumBasic)}`}>
                  {navData.premiumBasic > 0 ? '+' : ''}{formatNumber(navData.premiumBasic, 1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Implied NAV: ${formatNumber(navData.impliedNavBasic)}
                </div>
              </>
            )}
          </div>

          {/* Diluted mNAV Premium */}
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Diluted Premium</span>
              {!isLoading && getPremiumIcon(navData.premiumDiluted)}
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Waiting for price data...</div>
            ) : (
              <>
                <div className={`text-2xl font-mono ${getPremiumColor(navData.premiumDiluted)}`}>
                  {navData.premiumDiluted > 0 ? '+' : ''}{formatNumber(navData.premiumDiluted, 1)}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Implied NAV: ${formatNumber(navData.impliedNavDiluted)}
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
              <div className="font-mono">{formatLargeNumber(navData.totalBtcValue)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">BTC/Share (Basic)</div>
              <div className="font-mono">{formatNumber(navData.btcPerShareBasic, 4)}</div>
            </div>
            <div>
              <div className="text-muted-foreground mb-1">BTC/Share (Diluted)</div>
              <div className="font-mono">{formatNumber(navData.btcPerShareDiluted, 4)}</div>
            </div>
          </div>
        </div>

        {/* Explanation */}
        <div className="text-xs text-muted-foreground">
          <div className="mb-1">
            <strong>mNAV Premium</strong> shows whether MSTR trades at a premium or discount to its Bitcoin holdings.
          </div>
          <div>
            Positive premium means the market values MSTR above its BTC holdings (bullish sentiment). 
            Negative means trading below BTC value (discount opportunity or market concerns).
          </div>
        </div>
      </div>
    </Card>
  );
}
