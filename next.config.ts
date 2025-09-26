// next.config.ts (or .js with the same shape)
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typedRoutes: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: {
    // ✅ Let production builds succeed even with TS errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;