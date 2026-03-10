import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

// Parse API URL to allow Next.js Image to load photos from the backend
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const parsedApi = new URL(apiUrl);

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: process.env.NODE_ENV !== "production" ? {
    position: "bottom-left",
  } : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: parsedApi.hostname,
        ...(parsedApi.port ? { port: parsedApi.port } : {}),
      },
      {
        protocol: "https",
        hostname: parsedApi.hostname,
        ...(parsedApi.port ? { port: parsedApi.port } : {}),
      },
    ],
  },
};

export default withNextIntl(withSerwist(nextConfig));
