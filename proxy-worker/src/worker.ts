export interface Env {
  ALLOWED_ORIGINS?: string; // CSV of allowed origins or *
}

const UPSTREAM = 'https://query1.finance.yahoo.com';

function corsHeaders(origin: string | null, allowed: string | undefined) {
  const allow = (allowed ?? '*').split(',').map(s => s.trim());
  const isWildcard = allow.includes('*');
  const ok = isWildcard || (origin && allow.includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? (isWildcard ? '*' : (origin ?? '')) : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin, env.ALLOWED_ORIGINS) });
    }

    // Expect path like /v7/finance/quote?symbols=MSTR or /v8/finance/chart/MSTR?...
    const upstreamUrl = new URL(url.pathname + url.search, UPSTREAM);

    // Proxy only GET
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders(origin, env.ALLOWED_ORIGINS) });
    }

    try {
      const upstreamRes = await fetch(upstreamUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept': 'application/json,text/plain,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });

      const headers = new Headers(upstreamRes.headers);
      headers.set('Content-Type', 'application/json; charset=utf-8');
      const ch = corsHeaders(origin, env.ALLOWED_ORIGINS);
      Object.entries(ch).forEach(([k, v]) => headers.set(k, v));

      // Forward body as-is
      return new Response(upstreamRes.body, { status: upstreamRes.status, headers });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'proxy_failed', message: (e as Error).message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env.ALLOWED_ORIGINS) },
      });
    }
  }
};
