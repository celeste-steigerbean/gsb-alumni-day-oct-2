import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-postgres must stay a real Node module, never bundled for the edge.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
