import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Serve static images directly without going through the optimization
    // pipeline — avoids intermittent failures on mobile / cold starts.
    unoptimized: true,
  },
};

export default nextConfig;
