import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: path.resolve(__dirname, "../.."),
  },
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      // fallback runs only when no page or API route matched — so local
      // /api/tasks/* routes are handled by Next.js and never reach here
      fallback: [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
