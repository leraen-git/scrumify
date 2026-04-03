import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL ?? "http://localhost:3001";
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
  // Empty turbopack config: tells Next.js 16 we are Turbopack-aware.
  // pptxgenjs / html2canvas are dynamically imported inside browser event
  // handlers only, so no Node built-in polyfills are needed.
  turbopack: {},
};

export default nextConfig;
