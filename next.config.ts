import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Standalone output is used by the Docker image (see Dockerfile); `next start` is used otherwise.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  // Native/WASM packages must be loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-pgvector", "unpdf", "postgres"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    const noFraming = [...securityHeaders, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }, { key: "X-Frame-Options", value: "DENY" }];
    return [
      // Everything except the embeddable chat iframe, public API and widget assets must never be framed (clickjacking).
      { source: "/", headers: noFraming },
      { source: "/:path((?!embed/|api/v1/|widget).*)", headers: noFraming },
      {
        source: "/widget.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
