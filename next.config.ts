import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }] },
  webpack(config, { isServer }) {
    if (isServer) {
      // Firestore's Node build loads gRPC/protobufjs, which uses `new Function` — not allowed on
      // Cloudflare Workers. The browser build (WebChannel) is safe to evaluate during SSR.
      config.resolve.alias = {
        ...config.resolve.alias,
        "@firebase/firestore$": path.resolve("node_modules/@firebase/firestore/dist/index.esm.js"),
      };
    }
    return config;
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
