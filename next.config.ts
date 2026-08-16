import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Stub optional peer deps not used by our code
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
};

export default nextConfig;
