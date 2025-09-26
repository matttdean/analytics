import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // typedRoutes moved out of experimental in Next 15
  typedRoutes: true,

  eslint: {
    // ✅ allow production builds even if there are ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
