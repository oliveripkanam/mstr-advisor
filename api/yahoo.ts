// @ts-nocheck

const UPSTREAM = 'https://query1.finance.yahoo.com';

function cors(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: any, res: any) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');

  try {
    // Path e.g. /api/yahoo/v7/finance/quote or /api/yahoo/v8/finance/chart/MSTR
    const path = Array.isArray(req.query.path)
      ? '/' + req.query.path.join('/')
      : typeof req.query.path === 'string'
      ? '/' + req.query.path
      : req.url?.replace(/^\/api\/yahoo/, '') || '/';

    const url = new URL(path + (req.url?.includes('?') ? '?' + req.url.split('?')[1] : ''), UPSTREAM);

    const upstream = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
      },
    });

    const body = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(upstream.status).send(body);
  } catch (e: any) {
    return res.status(502).json({ error: 'proxy_failed', message: e?.message || 'unknown' });
  }
}
