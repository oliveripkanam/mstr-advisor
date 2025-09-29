// Netlify Function: Bybit proxy
// Routes: /proxy/bybit/* -> /.netlify/functions/bybit/* (via netlify.toml)
// Forwards to https://api.bybit.com/:splat with friendly headers and CORS.

type Event = {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  path: string;
  queryStringParameters?: Record<string, string | undefined>;
  multiValueQueryStringParameters?: Record<string, string[] | undefined>;
};

type Result = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
};

function buildCorsHeaders(origin?: string): Record<string, string> {
  const allowOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin === 'null' ? '*' : allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function getSplatPath(eventPath: string): string {
  const prefix = '/.netlify/functions/bybit';
  if (eventPath.startsWith(prefix)) {
    const rest = eventPath.slice(prefix.length);
    return rest || '/';
  }
  return '/';
}

function buildQuery(event: Event): string {
  const mv = event.multiValueQueryStringParameters;
  const sp = new URLSearchParams();
  if (mv && typeof mv === 'object') {
    for (const [k, arr] of Object.entries(mv)) {
      if (Array.isArray(arr)) arr.forEach((v) => v != null && sp.append(k, String(v)));
    }
  } else if (event.queryStringParameters) {
    for (const [k, v] of Object.entries(event.queryStringParameters)) {
      if (v != null) sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const handler = async (event: Event): Promise<Result> => {
  const origin = event.headers['origin'] || event.headers['Origin'] || '*';
  const cors = buildCorsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  try {
    const suffix = getSplatPath(event.path);
    const upstreamUrl = `https://api.bybit.com${suffix}${buildQuery(event)}`;

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Referer': 'https://api.bybit.com',
      },
    });

    const contentType = upstreamRes.headers.get('content-type') || 'application/json; charset=utf-8';
    const text = await upstreamRes.text();

    return {
      statusCode: upstreamRes.status,
      headers: { 'Content-Type': contentType, ...cors },
      body: text,
    };
  } catch (err: any) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json', ...cors },
      body: JSON.stringify({ error: 'proxy_failed', message: err?.message || 'unknown' }),
    };
  }
};
