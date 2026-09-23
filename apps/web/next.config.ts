import type { NextConfig } from "next";

// Asset inventory (Task 021) for CSP:
// - Scripts: Next.js App Router only (self + framework inline). No third-party
//   analytics/CDN scripts in the tree.
// - Styles: next/font + Tailwind build CSS (self) + React inline styles.
// - Fonts: next/font/google Geist → self-hosted at build (no runtime fonts.googleapis).
// - Images: app assets self; Instagram media_url may be https CDN when import lands.
// - connect-src: self, Supabase project, Fastify API (NEXT_PUBLIC_API_URL).
// - OAuth / Meta Graph: top-level redirects or server-side fetch — not browser subresources.
// script-src keeps 'unsafe-inline' because Next injects RSC/hydration inline
// scripts without a per-request nonce (proxy does not rewrite HTML). External
// script blocking is still enforced ('self' only). Nonce CSP = future work.
const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const supabaseOrigin =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://etwuqthopqrzffdgvhqs.supabase.co";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${apiOrigin}`,
  "manifest-src 'self'",
  "media-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // CSP always on (prod + dev): dev has no eval/HMR script origin beyond self
  // in Next 16 production-like builds; if a future dev tool breaks, gate on
  // NODE_ENV then — do not drop the header in production.
  { key: "Content-Security-Policy", value: csp },
  // HSTS only makes sense behind HTTPS — applied in production builds.
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
