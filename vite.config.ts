
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        'recharts@2.15.2': 'recharts',
        'next-themes@0.4.6': 'next-themes',
        'lucide-react@0.487.0': 'lucide-react',
        'class-variance-authority@0.7.1': 'class-variance-authority',
        '@radix-ui/react-tooltip@1.1.8': '@radix-ui/react-tooltip',
        '@radix-ui/react-slot@1.1.2': '@radix-ui/react-slot',
        '@radix-ui/react-select@2.1.6': '@radix-ui/react-select',
        '@radix-ui/react-progress@1.1.2': '@radix-ui/react-progress',
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'dist',
    },
    server: {
      port: 3000,
      open: true,
      proxy: {
        // Dev-only proxy to bypass CORS for Yahoo Finance endpoints
        '/api/yahoo': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/yahoo/, ''),
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json,text/plain,*/*',
          },
        },
        // Binance Futures API (REST preload)
        '/proxy/binance-fapi': {
          target: 'https://fapi.binance.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/proxy\/binance-fapi/, ''),
        },
        // OKX Public API (REST preload)
        '/proxy/okx': {
          target: 'https://www.okx.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/proxy\/okx/, ''),
        },
        // Bybit Public API
        '/proxy/bybit': {
          target: 'https://api.bybit.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/proxy\/bybit/, ''),
        },
      },
    },
  });