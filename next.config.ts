import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // صفحات پنل dynamic می‌مانند؛ فقط overhead کمتر

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-label",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-separator",
      "@radix-ui/react-navigation-menu",
      "date-fns",
      "date-fns-jalali",
      "framer-motion",
      "embla-carousel-react",
      "@ark-ui/react",
      "@number-flow/react",
    ],
  },

  // Next 16+: eslint key removed from next.config (use `npm run lint` / eslint.config.mjs)
  // T-9: typecheck is green — fail the Next build on TS errors.
  typescript: { ignoreBuildErrors: false },

  async headers() {
    return [
      {
        source: "/hero/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/fonts/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/brands/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP is set per-request in src/proxy.ts (nonce + strict-dynamic).
          // Do not duplicate a static CSP here — browsers intersect multiple CSPs.
        ],
      },
    ];
  },

  async rewrites() {
    return [
      { source: "/علاقه-مندی-ها", destination: "/dashboard?tab=wishlist" },
      { source: "/مقایسه", destination: "/dashboard?tab=compare" },
      { source: "/سبد-خرید", destination: "/cart" },
      { source: "/آخرین-مشاهده-ها", destination: "/dashboard?tab=recent" },
      { source: "/محصولات", destination: "/products" },
      { source: "/ورود", destination: "/login" },
      { source: "/%D9%88%D8%B1%D9%88%D8%AF", destination: "/login" },
      { source: "/ثبت-نام", destination: "/register" },
      { source: "/%D8%AB%D8%A8%D8%AA-%D9%86%D8%A7%D9%85", destination: "/register" },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "media.shadjil.ir",
      },
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
    ],
  },
};

export default withBundleAnalyzer(nextConfig);
