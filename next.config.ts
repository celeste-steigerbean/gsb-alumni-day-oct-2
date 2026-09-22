import type { NextConfig } from "next";

/**
 * Where the board lives on the firm's site: steigerbean.com/gsb-alumni-day.
 *
 * steigerbean.com is its own Vercel project. It forwards this path to this
 * one with a rewrite, so the visitor never leaves steigerbean.com. For that
 * to work every page, asset, API call and cookie of this app has to live
 * under the same prefix, which is what basePath does. Set here once; the
 * rest of the code reads it back through NEXT_PUBLIC_BASE_PATH.
 */
const BASE_PATH = "/gsb-alumni-day";

/**
 * Server Actions refuse a form post whose Origin does not match the host the
 * app sees. Behind the rewrite the browser says steigerbean.com while the app
 * may see its own vercel.app host, and every submission would be rejected.
 * EXTRA_ALLOWED_ORIGINS adds more, comma separated, without a code change.
 */
const ALLOWED_ORIGINS = [
  "steigerbean.com",
  "www.steigerbean.com",
  ...(process.env.EXTRA_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },

  // node-postgres must stay a real Node module, never bundled for the edge.
  serverExternalPackages: ["pg"],

  experimental: {
    serverActions: { allowedOrigins: ALLOWED_ORIGINS },
  },

  // Anything bookmarked or shared before the move, on the vercel.app address,
  // lands in the right place instead of on a 404. Query strings carry over,
  // so an old ?code= link still unlocks.
  async redirects() {
    const legacy = ["/board", "/board/:path*", "/unlock", "/api/health"];
    return [
      { source: "/", destination: BASE_PATH, basePath: false, permanent: false },
      ...legacy.map((source) => ({
        source,
        destination: `${BASE_PATH}${source}`,
        basePath: false as const,
        permanent: false,
      })),
    ];
  },
};

export default nextConfig;
