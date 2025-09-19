
  # MSTR/BTC Monitor Dashboard

  This is a code bundle for MSTR/BTC Monitor Dashboard. The original project is available at https://www.figma.com/design/LNZbekZWrANga4WFmjyB4a/MSTR-BTC-Monitor-Dashboard.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  
  ## TradingView chart
  
  The top chart now embeds the official TradingView widget (tv.js). It auto-maps:
  
  - BTC → BINANCE:BTCUSDT (no API key needed)
  - MSTR → NASDAQ:MSTR
  - Timeframes like 1m/5m/15m/1h/4h/1D → the corresponding TradingView intervals
  - Theme follows the app theme toggle (dark/light)
  
  Compare mode can be enabled from the chart toolbar. The app also exposes a "Compare" toggle which turns on the ability to add overlays from the TV UI.
  
  No credentials are required and this widget works on localhost and GitHub Pages by default.

  ## Live MSTR data (Yahoo) and CORS

  Yahoo Finance blocks browser requests with CORS in production. For a reliable setup:

  - Local dev: already proxied via Vite. Nothing to configure; just run `npm run dev`.
  - Production: deploy the included Cloudflare Worker to proxy Yahoo and set the frontend env.

  Steps:
  1. Deploy proxy-worker
    - cd `proxy-worker`
    - Install Wrangler once globally if needed
    - Run `npm run deploy` (or `npm run dev` to test locally)
  2. Copy the Worker URL (e.g., https://mstr-yahoo-proxy.<account>.workers.dev)
  3. Create `.env` at repo root and set:
    - `VITE_YAHOO_PROXY_URL=<your worker url>`
  4. Build and deploy the site. The app will use the proxy in production automatically.

  Optional: In `proxy-worker/wrangler.toml`, set `ALLOWED_ORIGINS` to restrict which sites can call your proxy.
  