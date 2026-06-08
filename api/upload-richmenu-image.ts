import { config } from "dotenv"
config({ override: true, path: ".env" })
import sharp from "sharp"
import fs from "node:fs"

const LINE_API      = "https://api.line.me/v2/bot"
const LINE_DATA_API = "https://api-data.line.me/v2/bot"
const TOKEN         = process.env.LINE_CHANNEL_ACCESS_TOKEN!

const W = 2500, H = 1686   // LINE full rich menu size

const RICH_MENU_BODY = {
  size: { width: W, height: H },
  selected: true,
  name: "Slippy Main Menu",
  chatBarText: "📱 เมนู Slippy",
  areas: [
    // Hero (top ~33%) → open app
    { bounds: { x: 0,    y: 0,    width: W,    height: 560 }, action: { type: "uri",     uri: "https://app.slippy.app" } },
    // Row 1
    { bounds: { x: 0,    y: 560,  width: 833,  height: 563 }, action: { type: "message", text: "📸 ส่งสลิป" }  },
    { bounds: { x: 833,  y: 560,  width: 833,  height: 563 }, action: { type: "message", text: "/summary" }    },
    { bounds: { x: 1666, y: 560,  width: 834,  height: 563 }, action: { type: "message", text: "/status" }     },
    // Row 2
    { bounds: { x: 0,    y: 1123, width: 833,  height: 563 }, action: { type: "message", text: "/menu" }       },
    { bounds: { x: 833,  y: 1123, width: 833,  height: 563 }, action: { type: "uri",     uri: "https://app.slippy.app/settings/line" } },
    { bounds: { x: 1666, y: 1123, width: 834,  height: 563 }, action: { type: "uri",     uri: "https://app.slippy.app" } },
  ],
}

async function main() {
  console.log("🔧 Slippy Rich Menu — upload actual image\n")

  // 1. Delete existing
  console.log("1️⃣  ลบ Rich Menu เดิม...")
  const existRes = await fetch(`${LINE_API}/user/all/richmenu`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  if (existRes.ok) {
    const d = await existRes.json() as { richMenuId?: string }
    if (d.richMenuId) {
      await fetch(`${LINE_API}/richmenu/${d.richMenuId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${TOKEN}` }
      })
      console.log(`   ลบ ${d.richMenuId}`)
    }
  }

  // 2. Create structure
  console.log("2️⃣  สร้าง structure...")
  const cr = await fetch(`${LINE_API}/richmenu`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(RICH_MENU_BODY)
  })
  if (!cr.ok) { console.error("❌", await cr.text()); process.exit(1) }
  const { richMenuId } = await cr.json() as { richMenuId: string }
  console.log(`   richMenuId: ${richMenuId}`)

  // 3. Resize image to 2500×1686
  console.log("3️⃣  Resize รูป → 2500×1686 px...")
  const src    = "/tmp/slippy-richmenu-source.webp"
  const out    = "/tmp/slippy-richmenu-final.png"

  await sharp(src)
    .resize(W, H, { fit: "fill" })   // fill = stretch to exact size (no crop/pad)
    .png({ compressionLevel: 8 })
    .toFile(out)

  const meta = await sharp(out).metadata()
  const kb   = (fs.statSync(out).size / 1024).toFixed(0)
  console.log(`   ${meta.width}×${meta.height} px — ${kb} KB`)

  // Check 1 MB limit
  if (fs.statSync(out).size > 1_000_000) {
    console.log("   ⚠️ เกิน 1 MB — compress เพิ่ม...")
    await sharp(src)
      .resize(W, H, { fit: "fill" })
      .jpeg({ quality: 85, progressive: true })
      .toFile(out.replace('.png', '.jpg'))
    const jpgKb = (fs.statSync(out.replace('.png','.jpg')).size / 1024).toFixed(0)
    console.log(`   JPEG compressed: ${jpgKb} KB`)
    fs.copyFileSync(out.replace('.png','.jpg'), out)
  }

  // 4. Upload
  console.log("4️⃣  Upload image (api-data.line.me)...")
  const imgBuf = fs.readFileSync(out)
  const contentType = out.endsWith('.jpg') ? "image/jpeg" : "image/png"
  const upRes  = await fetch(`${LINE_DATA_API}/richmenu/${richMenuId}/content`, {
    method:  "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": contentType },
    body:    imgBuf,
  })
  if (!upRes.ok) {
    console.error(`❌ HTTP ${upRes.status}:`, await upRes.text()); process.exit(1)
  }
  console.log("   อัปโหลดสำเร็จ ✓")

  // 5. Set default
  console.log("5️⃣  ตั้ง Default...")
  const dr = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
    method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }
  })
  if (!dr.ok) { console.error("❌", await dr.text()); process.exit(1) }

  fs.unlinkSync(out)
  console.log(`\n✅ Rich Menu พร้อมใช้งาน!`)
  console.log(`   richMenuId: ${richMenuId}`)
  console.log(`   เปิดแชท LINE ดูเมนูใหม่ได้เลย 👇`)
}
main().catch(e => { console.error("❌", e); process.exit(1) })
