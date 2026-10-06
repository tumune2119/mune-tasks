import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / heavy server-only modules stay out of the bundle.
  serverExternalPackages: ["better-sqlite3", "unpdf", "mammoth"],
  // Local-only app: skip gzip so streamed AI output is flushed immediately.
  compress: false,
  poweredByHeader: false,
};

export default nextConfig;
