import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['canvas'],
  
  // Configurazione per Turbopack (Next.js 15/16)
  turbo: {
    resolveAlias: {
      canvas: 'empty',
    },
  },

  // Configurazione per Webpack (Fallback)
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
