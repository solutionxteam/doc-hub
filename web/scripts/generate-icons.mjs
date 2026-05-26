/**
 * generate-icons.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates all platform-required PNG icons from source SVGs using Sharp.
 *
 * Usage:
 *   node scripts/generate-icons.mjs
 *
 * Requires: sharp (npm install sharp --save-dev)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import sharp    from "sharp"
import fs       from "fs"
import path     from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC    = path.resolve(__dirname, "../public")
const ICONS_DIR = path.join(PUBLIC, "icons")

// ── Ensure output directories exist ────────────────────────────────────────
const dirs = [
  ICONS_DIR,
  path.join(ICONS_DIR, "ios"),
  path.join(ICONS_DIR, "android"),
  path.join(ICONS_DIR, "line"),
  path.join(ICONS_DIR, "pwa"),
  path.join(ICONS_DIR, "favicon"),
  path.join(ICONS_DIR, "social"),
]
for (const d of dirs) fs.mkdirSync(d, { recursive: true })

// ── Source SVGs ─────────────────────────────────────────────────────────────
const MASTER  = path.join(PUBLIC, "app-icon-1024.svg")   // main app icon (no corner radius)
const LINE_SV = path.join(PUBLIC, "line-oa-icon.svg")    // LINE variant with wordmark
const OG_SV   = path.join(PUBLIC, "og-image.svg")        // social OG 1200×630

// Social network assets
const SOC     = path.join(PUBLIC, "social")
const SOC_OUT = path.join(ICONS_DIR, "social")

// Helper: SVG → PNG
async function gen(src, dest, width, height = width) {
  await sharp(Buffer.from(fs.readFileSync(src)))
    .resize(width, height, { fit: "contain", background: { r:0,g:0,b:0,alpha:0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(dest)
  console.log(`  ✓  ${path.relative(PUBLIC, dest)}  (${width}×${height})`)
}

// ── iOS / App Store ─────────────────────────────────────────────────────────
console.log("\n📱 iOS / App Store")
const IOS = [
  // App Store submission
  { name: "app-store-1024.png",  size: 1024 },
  // iPhone home screen
  { name: "icon-60@3x.png",      size: 180 },
  { name: "icon-60@2x.png",      size: 120 },
  // iPad home screen
  { name: "icon-76@2x.png",      size: 152 },
  { name: "icon-83.5@2x.png",    size: 167 },
  { name: "icon-76@1x.png",      size: 76  },
  // Spotlight
  { name: "icon-40@3x.png",      size: 120 },
  { name: "icon-40@2x.png",      size: 80  },
  { name: "icon-40@1x.png",      size: 40  },
  // Settings
  { name: "icon-29@3x.png",      size: 87  },
  { name: "icon-29@2x.png",      size: 58  },
  { name: "icon-29@1x.png",      size: 29  },
  // Notification
  { name: "icon-20@3x.png",      size: 60  },
  { name: "icon-20@2x.png",      size: 40  },
  { name: "icon-20@1x.png",      size: 20  },
]
for (const { name, size } of IOS) {
  await gen(MASTER, path.join(ICONS_DIR, "ios", name), size)
}

// ── Android / Play Store ────────────────────────────────────────────────────
console.log("\n🤖 Android / Play Store")
const ANDROID = [
  // Play Store listing
  { name: "play-store-512.png",  size: 512 },
  // Adaptive icon foreground (full bleed, no padding)
  { name: "ic_launcher_xxxhdpi_192.png", size: 192 },
  { name: "ic_launcher_xxhdpi_144.png",  size: 144 },
  { name: "ic_launcher_xhdpi_96.png",    size: 96  },
  { name: "ic_launcher_hdpi_72.png",     size: 72  },
  { name: "ic_launcher_mdpi_48.png",     size: 48  },
]
for (const { name, size } of ANDROID) {
  await gen(MASTER, path.join(ICONS_DIR, "android", name), size)
}

// ── LINE OA / LINE Messaging API ────────────────────────────────────────────
console.log("\n💬 LINE OA / Messaging API")
const LINE_SIZES = [
  // LINE OA profile picture (displayed as circle — LINE handles clip)
  { name: "line-oa-1024.png",  size: 1024 },
  { name: "line-oa-640.png",   size: 640  },  // minimum recommended
  { name: "line-oa-200.png",   size: 200  },  // thumbnail / chat list
  // LINE Messaging API channel icon
  { name: "line-msg-channel-1024.png", size: 1024 },
  // LINE Login channel icon
  { name: "line-login-512.png", size: 512 },
]
for (const { name, size } of LINE_SIZES) {
  await gen(LINE_SV, path.join(ICONS_DIR, "line", name), size)
}

// ── PWA / Web App Manifest ───────────────────────────────────────────────────
console.log("\n🌐 PWA / Web Manifest")
const PWA_SIZES = [512, 384, 256, 192, 144, 128, 96, 72, 48]
for (const size of PWA_SIZES) {
  await gen(MASTER, path.join(ICONS_DIR, "pwa", `icon-${size}.png`), size)
}

// ── Favicon ──────────────────────────────────────────────────────────────────
console.log("\n🔖 Favicon")
for (const size of [16, 32, 48, 96]) {
  await gen(MASTER, path.join(ICONS_DIR, "favicon", `favicon-${size}.png`), size)
}
// Also write to public root (used by browsers directly)
await gen(MASTER, path.join(PUBLIC, "favicon-32x32.png"), 32)
await gen(MASTER, path.join(PUBLIC, "favicon-16x16.png"), 16)
await gen(MASTER, path.join(PUBLIC, "icon-192.png"), 192)
await gen(MASTER, path.join(PUBLIC, "icon-512.png"), 512)

// ── OG / Social image ────────────────────────────────────────────────────────
console.log("\n🖼️  OG / Social")
await sharp(Buffer.from(fs.readFileSync(OG_SV)))
  .resize(1200, 630, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(PUBLIC, "og-image.png"))
console.log("  ✓  og-image.png  (1200×630)")

// Also a smaller thumbnail for Twitter card summary
await sharp(Buffer.from(fs.readFileSync(OG_SV)))
  .resize(600, 314, { fit: "cover" })
  .png({ compressionLevel: 9 })
  .toFile(path.join(PUBLIC, "twitter-card.png"))
console.log("  ✓  twitter-card.png  (600×314)")

// ── Social network assets ────────────────────────────────────────────────────
console.log("\n📲 Social network profile photos & banners")

// Profile photos (square — platforms crop to circle)
const socProfiles = [
  // Universal square profile (Facebook Page, Instagram, YouTube channel, LinkedIn)
  { svg: "profile-square.svg", out: "profile-1080.png",          w: 1080, h: 1080 },
  { svg: "profile-square.svg", out: "facebook-profile-1080.png", w: 1080, h: 1080 },
  { svg: "profile-square.svg", out: "youtube-profile-800.png",   w: 800,  h: 800  },
  // TikTok (200×200 minimum)
  { svg: "tiktok-profile.svg", out: "tiktok-profile-200.png",    w: 200,  h: 200  },
  { svg: "tiktok-profile.svg", out: "tiktok-profile-400.png",    w: 400,  h: 400  },
  // WhatsApp Business (640×640)
  { svg: "whatsapp-profile.svg", out: "whatsapp-profile-640.png", w: 640, h: 640  },
  // LinkedIn Company Logo (300×300)
  { svg: "linkedin-logo.svg",  out: "linkedin-logo-300.png",     w: 300,  h: 300  },
  { svg: "linkedin-logo.svg",  out: "linkedin-logo-600.png",     w: 600,  h: 600  },
]
for (const { svg, out, w, h } of socProfiles) {
  await gen(path.join(SOC, svg), path.join(SOC_OUT, out), w, h)
}

// Instagram content
const socInstagram = [
  // Post (1:1)
  { svg: "instagram-post.svg",  out: "instagram-post-1080.png",  w: 1080, h: 1080 },
  // Story / Reels (9:16)
  { svg: "instagram-story.svg", out: "instagram-story-1080.png", w: 1080, h: 1920 },
]
for (const { svg, out, w, h } of socInstagram) {
  await gen(path.join(SOC, svg), path.join(SOC_OUT, out), w, h)
}

// Banners / cover photos
const socBanners = [
  // Facebook Page cover (820×312)
  { svg: "facebook-cover.svg",  out: "facebook-cover-820.png",   w: 820,  h: 312  },
  // Twitter/X header (1500×500)
  { svg: "twitter-header.svg",  out: "twitter-header-1500.png",  w: 1500, h: 500  },
  // YouTube channel art (2560×1440)
  { svg: "youtube-banner.svg",  out: "youtube-banner-2560.png",  w: 2560, h: 1440 },
  // LinkedIn company banner (1128×191)
  { svg: "linkedin-banner.svg", out: "linkedin-banner-1128.png", w: 1128, h: 191  },
]
for (const { svg, out, w, h } of socBanners) {
  await gen(path.join(SOC, svg), path.join(SOC_OUT, out), w, h)
}

// Copy key social assets to public root for easy access
await gen(path.join(SOC, "profile-square.svg"), path.join(PUBLIC, "social-profile.png"), 1080, 1080)

// ── Summary ───────────────────────────────────────────────────────────────────
const allFiles = fs.readdirSync(ICONS_DIR, { recursive: true })
  .filter(f => f.endsWith(".png")).length
console.log(`\n✅  Done — ${allFiles + 7} PNG files generated in public/icons/ and public/\n`)
