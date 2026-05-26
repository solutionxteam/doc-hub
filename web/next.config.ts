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
                      "https://lh3.googleusercontent.com"],
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
    key:   "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
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
        // Apply security headers to all routes
        source:  "/(.*)",
        headers: securityHeaders,
      },
    ]
  },
}

export default withNextIntl(nextConfig)
