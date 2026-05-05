import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  serverExternalPackages: ['canvas'],
  // Alcune versioni di pdfjs-dist hanno bisogno di questo per non crashare su Vercel
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
