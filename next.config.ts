import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mpasoifodxwpuoahzxjo.supabase.co",
      },
    ],
  },
};

export default nextConfig;
