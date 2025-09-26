/** @type {import('next').NextConfig} */
const nextConfig = {
    // Next 15: typedRoutes is top-level, not experimental
    typedRoutes: true,
  
    // Let the build succeed even if ESLint finds issues (MVP mode)
    eslint: {
      ignoreDuringBuilds: true,
    },
  };
  
  export default nextConfig;
  