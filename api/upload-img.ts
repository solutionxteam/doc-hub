import { config } from "dotenv"
config({ override: true })
import sharp from "sharp"
import fs from "node:fs"

const LINE_API      = "https://api.line.me/v2/bot"
const LINE_DATA_API = "https://api-data.line.me/v2/bot"
const TOKEN         = process.env.LINE_CHANNEL_ACCESS_TOKEN!
const W = 2500, H = 1686

const BODY = {
  size: { width: W, height: H },
  selected: true,
  name: "Slippy Main Menu",
  chatBarText: "📱 เมนู Slippy",
  areas: [
    { bounds: { x: 0,    y: 0,    width: W,    height: 560 }, action: { type: "uri",     uri: "https://app.slippy.app" } },
    { bounds: { x: 0,    y: 560,  width: 833,  height: 563 }, action: { type: "message", text: "📸 ส่งสลิป" }  },
    { bounds: { x: 833,  y: 560,  width: 833,  height: 563 }, action: { type: "message", text: "/summary" }    },
    { bounds: { x: 1666, y: 560,  width: 834,  height: 563 }, action: { type: "message", text: "/status" }     },
    { bounds: { x: 0,    y: 1123, width: 833,  height: 563 }, action: { type: "message", text: "/menu" }       },
    { bounds: { x: 833,  y: 1123, width: 833,  height: 563 }, action: { type: "uri",     uri: "https://app.slippy.app/settings/line" } },
    { bounds: { x: 1666, y: 1123, width: 834,  height: 563 }, action: { type: "uri",     uri: "https://app.slippy.app" } },
  ],
}

async function main() {
  console.log("🔧 Uploading actual Slippy image as Rich Menu\n")

  // 1. Delete old
  const ex = await fetch(`${LINE_API}/user/all/richmenu`, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (ex.ok) {
    const d = await ex.json() as any
    if (d.richMenuId) {
      await fetch(`${LINE_API}/richmenu/${d.richMenuId}`, { method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` } })
      console.log(`1️⃣  ลบ ${d.richMenuId}`)
    }
  }

  // 2. Create
  const cr = await fetch(`${LINE_API}/richmenu`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(BODY)
  })
  if (!cr.ok) { console.error("❌ create:", await cr.text()); process.exit(1) }
  const { richMenuId } = await cr.json() as any
  console.log(`2️⃣  richMenuId: ${richMenuId}`)

  // 3. Resize image 1672×941 → 2500×1686
  const out = "/tmp/rm-final.jpg"
  await sharp("/tmp/slippy-richmenu-source.webp")
    .resize(W, H, { fit: "fill" })
    .jpeg({ quality: 90, progressive: true })
    .toFile(out)
  const kb = (fs.statSync(out).size / 1024).toFixed(0)
  console.log(`3️⃣  Resized: 2500×1686 — ${kb} KB`)

  // 4. Upload
  const up = await fetch(`${LINE_DATA_API}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "image/jpeg" },
    body: fs.readFileSync(out),
  })
  if (!up.ok) { console.error(`❌ upload HTTP ${up.status}:`, await up.text()); process.exit(1) }
  console.log("4️⃣  Upload ✓")

  // 5. Set default
  const dr = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }
  })
  if (!dr.ok) { console.error("❌ default:", await dr.text()); process.exit(1) }
  console.log("5️⃣  Set default ✓")
  fs.unlinkSync(out)
  console.log(`\n✅ เสร็จ! richMenuId: ${richMenuId}`)
  console.log("   เปิดแชท LINE ดูเมนูใหม่ได้เลย 👇")
}
main()
