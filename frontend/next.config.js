/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const nextConfig = {
  output: 'export',
  distDir: 'out',
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
};

module.exports = nextConfig;


