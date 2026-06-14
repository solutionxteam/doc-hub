import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

// ── Content-Security-Policy ───────────────────────────────────────────────────
// Builds the CSP header string from a structured object so each directive
// is easy to read, audit, and extend.
const supabaseHost = "https://*.supabase.co"

const cspDirectives: Record<string, string[]> = {
  "default-src":     ["'self'"],
  "script-src":      ["'self'", "'unsafe-inline'", "'unsafe-eval'",
                      // Next.js inline scripts + Vercel Analytics
                      "https://va.vercel-scripts.com"],
  "style-src":       ["'self'", "'unsafe-inline'",
                      // Google Fonts stylesheet
                      "https://fonts.googleapis.com"],
  "font-src":        ["'self'", "https://fonts.gstatic.com", "data:"],
  "img-src":         ["'self'", "data:", "blob:",
                      supabaseHost,
                      "https://lh3.googleusercontent.com",
                      // DiceBear avatar presets (profile picture picker)
                      "https://api.dicebear.com"],
  "media-src":       ["'self'", "blob:", supabaseHost],
  "connect-src":     ["'self'",
                      supabaseHost,
                      // Supabase auth (project-specific URL also matched above)
                      "https://*.supabase.io",
                      // Vercel Speed Insights
                      "https://vitals.vercel-insights.com",
                      "https://va.vercel-scripts.com"],
  "frame-src":       ["'none'"],
  "frame-ancestors": ["'none'"],
  "object-src":      ["'none'"],
  "base-uri":        ["'self'"],
  "form-action":     ["'self'"],
  "upgrade-insecure-requests": [],
}

const cspHeader = Object.entries(cspDirectives)
  .map(([key, values]) => `${key} ${values.join(" ")}`.trim())
  .join("; ")

// ── Relaxed CSP for /liff/* (LINE Front-end Framework) routes ─────────────────
// `liff.init()` loads additional "client features" (scripts + iframes) from
// LINE's CDN/auth domains. The default CSP above (frame-src: 'none', no LINE
// domains in script-src/connect-src) blocks this with the generic SDK error
// "Unable to load client features." — these routes need LINE's domains added.
const liffCspDirectives: Record<string, string[]> = {
  ...cspDirectives,
  "script-src":  [...cspDirectives["script-src"], "https://*.line-scdn.net", "https://*.line.me"],
  "connect-src": [...cspDirectives["connect-src"], "https://*.line-scdn.net", "https://*.line.me", "https://*.line.naver.jp"],
  "img-src":     [...cspDirectives["img-src"], "https://*.line-scdn.net", "https://*.line.me"],
  "frame-src":   ["https://*.line.me", "https://*.line-scdn.net"],
  "frame-ancestors": ["'self'", "https://*.line.me"],
}

const liffCspHeader = Object.entries(liffCspDirectives)
  .map(([key, values]) => `${key} ${values.join(" ")}`.trim())
  .join("; ")

// ─────────────────────────────────────────────────────────────────────────────

const securityHeaders = [
  // Prevent embedding in iframes (clickjacking)
  { key: "X-Frame-Options",            value: "DENY" },
  // Block MIME-type sniffing
  { key: "X-Content-Type-Options",     value: "nosniff" },
  // Limit referrer info sent to third-party domains
  { key: "Referrer-Policy",            value: "strict-origin-when-cross-origin" },
  // Enforce HTTPS for 1 year (incl. subdomains)
  { key: "Strict-Transport-Security",  value: "max-age=31536000; includeSubDomains; preload" },
  // Restrict browser features
  {
    // camera=(self) — allows this page to use camera, blocks third-party iframes
    // microphone=() — still blocked (not needed by the app)
    key:   "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // Block legacy XSS auditor (old browsers)
  { key: "X-XSS-Protection",           value: "1; mode=block" },
  // Content-Security-Policy
  { key: "Content-Security-Policy",    value: cspHeader },
]

const nextConfig: NextConfig = {
  eslint: {
    // ESLint is enforced separately via `npm run lint` / CI.
    // Keeping it out of the build step avoids blocking deploys from
    // pre-existing warn-level `any` violations while real errors are fixed.
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["@anthropic-ai/sdk", "sharp", "pdf2pic"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        // LIFF routes need a relaxed CSP that allows LINE's domains —
        // must be listed before the catch-all so it takes precedence.
        source:  "/liff/:path*",
        headers: securityHeaders.map(h =>
          h.key === "Content-Security-Policy" ? { ...h, value: liffCspHeader } : h
        ),
      },
      {
        // Apply security headers to all other routes. Next.js applies ALL
        // matching header rules (merging/intersecting CSPs), so /liff/* is
        // excluded here to avoid conflicting with the relaxed CSP above.
        source:  "/((?!liff/).*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
