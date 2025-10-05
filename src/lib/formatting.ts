// Centralized formatting utilities for consistent number display across the app

/**
 * Format a number as currency with specified decimal places
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string or '-' if invalid
 */
export function formatCurrency(value?: number, decimals: number = 2): string {
  if (value == null || !isFinite(value)) return '-';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a number as percentage
 * @param value - The decimal value (e.g., 0.01 for 1%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string or '-' if invalid
 */
export function formatPercentage(value?: number, decimals: number = 2): string {
  if (value == null || !isFinite(value)) return '-';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a number as percentage (already in percentage form)
 * @param value - The percentage value (e.g., 1 for 1%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string or '-' if invalid
 */
export function formatPercentageRaw(value?: number, decimals: number = 2): string {
  if (value == null || !isFinite(value)) return '-';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format large numbers in compact form (K, M, B)
 * @param value - The number to format
 * @param currency - Whether to include dollar sign (default: false)
 * @returns Compact formatted string or '-' if invalid
 */
export function formatCompact(value?: number | string, currency: boolean = false): string {
  if (value == null) return '-';
  const num = typeof value === 'string' ? Number(value) : value;
  if (!isFinite(num)) return '-';
  
  if (currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(num);
  }
  
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(num);
}

/**
 * Format large currency amounts with B/M/K suffixes
 * @param value - The number to format
 * @returns Formatted string with suffix or '-' if invalid
 */
export function formatLargeCurrency(value?: number): string {
  if (value == null || !isFinite(value)) return '-';
  
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

/**
 * Format a ratio to fixed decimal places
 * @param value - The ratio value
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted ratio string or '-' if invalid
 */
export function formatRatio(value?: number, decimals: number = 3): string {
  if (value == null || !isFinite(value) || value === 0) return '-';
  return value.toFixed(decimals);
}

/**
 * Format a multiplier (e.g., beta) with 'x' suffix
 * @param value - The multiplier value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted multiplier string with 'x' or '-' if invalid
 */
export function formatMultiplier(value?: number, decimals: number = 2): string {
  if (value == null || !isFinite(value)) return '-';
  return `${value.toFixed(decimals)}x`;
}
