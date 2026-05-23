import type { NextConfig } from "next"
import createNextIntlPlugin from "next-intl/plugin"

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts")

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
}

export default withNextIntl(nextConfig)
