import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Keep file tracing inside this app. A lockfile in the user home directory
  // otherwise makes Next treat that folder as the monorepo root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
