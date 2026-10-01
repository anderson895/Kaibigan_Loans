import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Static site for Cloudflare Pages (kaibigan-loans.pages.dev). The only server code is the
  // upload signature, which runs as a Pages Function (functions/api/upload-signature.ts).
  output: "export",
  // `*.dev.ts` files are only routed in `next dev`, so the local API route never reaches the export.
  pageExtensions: isDev ? ["tsx", "ts", "dev.ts"] : ["tsx", "ts"],
  images: { unoptimized: true },
};

export default nextConfig;
