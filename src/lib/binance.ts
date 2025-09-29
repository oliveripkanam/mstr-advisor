// Binance fetch helper with fallbacks
// Usage: binanceJson('/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=1000')

function isOk(res: Response) { return res.ok && res.status >= 200 && res.status < 300; }

function upstreamBaseFor(suffix: string): string {
  return suffix.startsWith('/api/') ? 'https://api.binance.com' : 'https://fapi.binance.com';
}

export async function binanceJson<T = any>(suffix: string): Promise<T> {
  const primary = '/proxy/binance-fapi';
  const envBase = (import.meta as any).env?.VITE_BINANCE_PROXY_URL as string | undefined;

  // Try primary (Netlify function)
  try {
    const r = await fetch(primary + suffix);
    if (isOk(r)) return (await r.json()) as T;
  } catch {}

  // Try env-provided alternate proxy base
  if (envBase) {
    try {
      const r2 = await fetch(envBase.replace(/\/$/, '') + suffix);
      if (isOk(r2)) return (await r2.json()) as T;
    } catch {}
  }

  // Last resort: use a public CORS proxy to reach Binance directly
  try {
    const direct = upstreamBaseFor(suffix) + suffix;
    const proxied = `https://corsproxy.io/?${encodeURIComponent(direct)}`;
    const r3 = await fetch(proxied);
    if (isOk(r3)) return (await r3.json()) as T;
  } catch {}

  throw new Error('binance fetch failed');
}
