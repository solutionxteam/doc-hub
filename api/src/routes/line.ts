import type { FastifyInstance } from "fastify"
import crypto from "node:crypto"
import { supabase } from "../lib/supabase"
import { queueExtraction } from "../queue/setup"
import { handleSplitCommand, handleClaimCommand, handleSplitStatus } from "../services/line-split"
import { handleCreateSportGroup, handleSportStatus, handleSportPay } from "../services/line-sport"
import { handleCreateTripGroup, handleTripStatus, handleTripPay } from "../services/line-trip"
import {
  docResultCard, summaryCard, statusListCard,
  welcomeCard, uploadAckCard, commandMenuCard,
  withQuickReply, mainQuickReply,
} from "../services/line-flex"

const LINE_API      = "https://api.line.me/v2/bot"
const LINE_DATA_API = "https://api-data.line.me/v2/bot"   // for binary content (images, files)
const token = () => process.env.LINE_CHANNEL_ACCESS_TOKEN!

function verifySignature(rawBody: Buffer | string, sig: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig)) }
  catch { return false }
}

async function replyMsg(replyToken: string, messages: object[]) {
  const res = await fetch(`${LINE_API}/message/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body:    JSON.stringify({ replyToken, messages }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error("[LINE:reply] failed", res.status, err.slice(0, 200))
  }
}

async function pushMsg(to: string, messages: object[]) {
  const t = token()
  if (!t) throw new Error("[LINE:push] LINE_CHANNEL_ACCESS_TOKEN is empty")

  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body:    JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[LINE:push] HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
}

const txt = (text: string) => ({ type: "text", text })

export async function lineRoutes(app: FastifyInstance) {
  app.post("/line", { config: { rawBody: true } }, async (req, rep) => {
    const sig     = (req.headers["x-line-signature"] as string) ?? ""
    const rawBody = (req as any).rawBody as Buffer

    if (!sig || !verifySignature(rawBody, sig)) {
      return rep.status(400).send({ error: "Invalid signature" })
    }

    const { events = [] } = req.body as { events: any[] }

    // Return 200 IMMEDIATELY — LINE retries if it doesn't get a response within 10s
    // which causes duplicate records. Process events in background.
    rep.send({ ok: true })
    Promise.allSettled(events.map(handleEvent)).catch(err =>
      console.error("[line] handleEvent error:", err)
    )
    return
  })
}

async function handleEvent(event: any) {
  const lineUserId = event.source?.userId as string
  const replyToken = event.replyToken as string

  if (event.type === "follow") {
    await replyMsg(replyToken, [
      welcomeCard(),
      withQuickReply(
        txt("กดปุ่มด้านล่างเพื่อเริ่มต้นใช้งาน หรือพิมพ์ /menu เพื่อดูคำสั่งทั้งหมด 👇"),
        [
          { label: "📱 ดูเมนู",       text: "/menu" },
          { label: "🔗 เชื่อมบัญชี", text: "/connect" },
          { label: "📖 วิธีใช้",      text: "/help" },
        ]
      )
    ])
    return
  }

  // ── Location message — Nearby Places ──────────────────────────────────────
  if (event.type === "message" && event.message.type === "location") {
    const lat = event.message.latitude  as number
    const lng = event.message.longitude as number

    const { data: conn2 } = await supabase
      .from("line_connections")
      .select("user_id, organization_id, display_name")
      .eq("line_user_id", lineUserId).single()

    if (!conn2) {
      await replyMsg(replyToken, [txt("กรุณาเชื่อมบัญชีก่อนครับ\nพิมพ์ /connect CODE")])
      return
    }

    // Build LIFF map URL
    const liffId  = process.env.LIFF_ID ?? process.env.NEXT_PUBLIC_LIFF_ID ?? ""
    const mapUrl  = liffId
      ? `https://liff.line.me/${liffId}/liff/places?lat=${lat}&lng=${lng}`
      : `https://slippy.ai/places?lat=${lat}&lng=${lng}`

    // Search nearby places (internal first)
    try {
      const { searchNearbyPlaces, PLACE_TYPES } = await import("../services/location-search")
      const results = await searchNearbyPlaces({
        lat, lng, type: "all", radiusKm: 1.0,
        orgId: conn2.organization_id, userId: conn2.user_id ?? undefined,
        minResults: 3,
      })

      if (!results.length) {
        await replyMsg(replyToken, [txt(
          `📍 รับตำแหน่งแล้วครับ\n\n` +
          `ยังไม่พบร้านค้าในระบบใกล้คุณ\n` +
          `ดูแผนที่เต็มๆ ได้ที่:\n${mapUrl}`
        )])
        return
      }

      // Build flex message
      const items = results.slice(0, 5)
      const bubbles = items.map(p => ({
        type: "bubble", size: "micro",
        body: {
          type: "box", layout: "vertical", spacing: "xs", paddingAll: "14px",
          contents: [
            { type: "text", text: p.name, weight: "bold", size: "sm", wrap: true, maxLines: 2 },
            { type: "text", text: `${p.is_internal ? "⭐ เคยไป · " : ""}${(p.distance_m / 1000).toFixed(1)} กม.`,
              size: "xxs", color: p.is_internal ? "#6366f1" : "#9ca3af" },
            ...(p.rating ? [{ type: "text", text: `⭐ ${p.rating}${p.user_ratings ? ` (${p.user_ratings.toLocaleString()})` : ""}`, size: "xxs", color: "#f59e0b" }] : []),
            ...(p.low_med_alert ? [{ type: "text", text: `💊 ยา "${p.low_med_alert}" เหลือน้อย`, size: "xxs", color: "#ef4444", wrap: true }] : []),
          ]
        },
        footer: {
          type: "box", layout: "vertical", spacing: "sm", paddingAll: "10px",
          contents: [{
            type: "button", style: "primary", height: "sm",
            color: p.is_internal ? "#6366f1" : "#10b981",
            action: { type: "uri", label: "นำทาง 🗺️", uri: p.maps_url }
          }]
        }
      }))

      const lowMedNote = results.some(r => r.low_med_alert)
        ? `\n💊 มียาที่เหลือน้อย — ร้านยาใกล้คุณอยู่ในรายการ!` : ""
      const src = results.some(r => !r.is_internal) ? "(บางส่วนจาก Google)" : "(จากระบบ)"

      await replyMsg(replyToken, [
        txt(`📍 พบ ${results.length} สถานที่ใกล้คุณ ${src}${lowMedNote}`),
        {
          type: "flex", altText: `📍 ${results.length} สถานที่ใกล้คุณ`,
          contents: { type: "carousel", contents: bubbles }
        }
      ])
    } catch (err: any) {
      console.error("[places] search error:", err.message)
      await replyMsg(replyToken, [txt(
        `📍 รับตำแหน่งแล้วครับ\nดูแผนที่ได้ที่:\n${mapUrl}`
      )])
    }
    return
  }

  if (event.type !== "message") return

  const { data: conn } = await supabase
    .from("line_connections")
    .select("user_id, organization_id, display_name")
    .eq("line_user_id", lineUserId)
    .single()

  const displayName = (conn as any)?.display_name ?? "ผู้ใช้"

  // ── File message (HEIC/PDF/etc from iOS share) ───────────────
  if (event.message.type === "file") {
    const mimeType = (event.message as any).fileName?.toLowerCase() ?? ""
    const isHeic   = mimeType.endsWith(".heic") || mimeType.endsWith(".heif")
    const isPdf    = mimeType.endsWith(".pdf")
    if (!isHeic && !isPdf) {
      await replyMsg(replyToken, [txt(
        "❌ ไฟล์ประเภทนี้ยังไม่รองรับครับ\n" +
        "กรุณาส่งเป็น รูปภาพ (JPG/PNG), HEIC, หรือ PDF"
      )])
      return
    }
    // Treat HEIC/PDF file messages the same as image events below
    // by falling through after overriding type — handled in shared logic
  }

  // ── Image: receive slip/receipt (also handles HEIC from file message) ─
  if (event.message.type === "image" || event.message.type === "file") {
    if (!conn) {
      await replyMsg(replyToken, [txt(
        "กรุณาเชื่อมบัญชีก่อนครับ\nใช้คำสั่ง /connect CODE จากหน้า Settings ในแอป"
      )])
      return
    }

    // Plan feature check: LINE Bot image receiving requires Starter+
    const { data: orgPlan } = await supabase
      .from("organizations").select("plan").eq("id", conn.organization_id).single()
    const { data: planRow } = await supabase
      .from("pricing_plans").select("feature_line_bot").eq("id", orgPlan?.plan ?? "free").single()
    if (!planRow?.feature_line_bot) {
      await replyMsg(replyToken, [txt(
        "⚠️ แผนปัจจุบันไม่รองรับการรับเอกสารผ่าน LINE Bot\n" +
        "กรุณาอัปเกรดเป็นแผน Starter ขึ้นไปที่ slippy.ai/billing"
      )])
      return
    }

    try {
      // ── Idempotency: skip if this message was already processed ────────────
      const messageId = event.message.id as string
      const { data: existing } = await supabase
        .from("documents")
        .select("id, status")
        .eq("organization_id", conn.organization_id)
        .contains("source_meta", { message_id: messageId })
        .limit(1)
        .maybeSingle()

      if (existing) {
        console.log(`[line] Duplicate webhook message ${messageId} — already have doc ${existing.id} (${existing.status}), skipping`)
        return
      }

      // Download from LINE CDN
      const imgRes = await fetch(`${LINE_DATA_API}/message/${event.message.id}/content`, {
        headers: { Authorization: `Bearer ${token()}` },
      })

      if (!imgRes.ok) {
        throw new Error(`LINE CDN download failed: ${imgRes.status} ${imgRes.statusText}`)
      }

      let rawBuffer = Buffer.from(await imgRes.arrayBuffer())

      if (rawBuffer.length === 0) {
        throw new Error("Downloaded image is empty — LINE CDN returned 0 bytes")
      }

      console.log(`[line] Downloaded ${event.message.id}: ${rawBuffer.length} bytes`)

      // ── Convert HEIC → JPEG if needed ──────────────────────────
      const contentType = imgRes.headers.get("content-type") ?? ""
      const isHeic = contentType.includes("heic") || contentType.includes("heif") ||
                     (event.message as any).fileName?.toLowerCase().match(/\.(heic|heif)$/)

      if (isHeic) {
        try {
          const heicConvert = (await import("heic-convert")).default
          const converted = await heicConvert({ buffer: rawBuffer, format: "JPEG", quality: 0.85 })
          rawBuffer = Buffer.from(converted as ArrayBuffer)
          console.log(`[line] HEIC→JPEG: ${rawBuffer.length} bytes`)
        } catch (e: any) {
          console.warn("[line] HEIC convert failed:", e.message)
        }
      }

      // ── Compress image to save storage (max 1200px, 80% quality) ─
      let finalBuffer = rawBuffer
      try {
        const sharp = (await import("sharp")).default
        finalBuffer = await sharp(rawBuffer)
          .resize({ width: 1200, height: 1600, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 80, progressive: true })
          .toBuffer()
        console.log(`[line] Compressed: ${rawBuffer.length} → ${finalBuffer.length} bytes (${Math.round(finalBuffer.length/rawBuffer.length*100)}%)`)
      } catch (e: any) {
        console.warn("[line] Compression failed, using original:", e.message)
        finalBuffer = rawBuffer
      }

      const fileName = `line_${event.message.id}.jpg`
      const filePath = `${conn.organization_id}/${fileName}`

      // Upload to Supabase Storage
      console.log(`[line] Uploading to storage: ${filePath}`)
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(filePath, finalBuffer, { contentType: "image/jpeg", upsert: true })

      if (uploadErr) {
        console.error("[line] Storage upload error:", uploadErr.message)
        throw new Error(`Storage upload failed: ${uploadErr.message}`)
      }
      console.log(`[line] Storage upload OK: ${filePath}`)

      // Check & increment quota
      console.log(`[line] Checking quota for org: ${conn.organization_id}`)
      const { data: allowed } = await supabase.rpc("increment_doc_used", {
        p_org_id: conn.organization_id,
      })
      if (!allowed) {
        // Rollback storage upload
        await supabase.storage.from("documents").remove([filePath])

        // ── Quota warning: send at most once per week per LINE user ────────
        const { data: connRow } = await supabase
          .from("line_connections")
          .select("quota_warned_at")
          .eq("line_user_id", lineUserId)
          .single()

        const lastWarned   = connRow?.quota_warned_at ? new Date(connRow.quota_warned_at) : null
        const oneWeekAgo   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const shouldNotify = !lastWarned || lastWarned < oneWeekAgo

        if (shouldNotify) {
          await supabase
            .from("line_connections")
            .update({ quota_warned_at: new Date().toISOString() })
            .eq("line_user_id", lineUserId)

          await pushMsg(lineUserId, [txt(
            "⚠️ โควต้าเอกสารเดือนนี้เต็มแล้วครับ\n" +
            "กรุณาอัปเกรดแผนหรือซื้อ Add-on เพิ่มที่ slippy.ai/billing\n\n" +
            "(ระบบจะแจ้งเตือนสัปดาห์ละครั้งเท่านั้น)"
          )])
        }
        return
      }

      console.log(`[line] Quota allowed=${allowed} — inserting document`)
      // Insert document record (use only columns that exist in schema)
      const { data: doc, error: insertErr } = await supabase
        .from("documents")
        .insert({
          organization_id: conn.organization_id,
          uploaded_by:     conn.user_id,
          file_path:       filePath,
          file_type:       "jpg",    // constraint: pdf | jpg | png
          source:          "line",
          source_meta:     { line_user_id: lineUserId, message_id: event.message.id, file_name: fileName },
          status:          "pending",
        })
        .select("id")
        .single()

      if (insertErr || !doc) {
        console.error("[line] insert failed:", insertErr?.message, insertErr?.details)
        throw new Error(`Document insert failed: ${insertErr?.message}`)
      }
      console.log(`[line] Document inserted: ${doc.id}`)

      // Reply ack immediately, then queue OCR (worker will notify LINE when done)
      await replyMsg(replyToken, [uploadAckCard(fileName, doc.id)])
      await queueExtraction({
        documentId:  doc.id,
        filePath,
        fileType:    "image/jpeg",
        orgId:       conn.organization_id,
        lineUserId,  // pass through so worker can notify without re-querying DB
      })
    } catch (err: any) {
      console.error("[line] image error:", err.message)
      await pushMsg(lineUserId, [txt("❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ")])
    }
    return
  }

  // ── Unsupported message types ─────────────────────────────────
  if (!["text", "image", "file"].includes(event.message.type)) {
    if (conn) {
      await replyMsg(replyToken, [txt(
        "❌ ขอโทษครับ ตอนนี้รองรับเฉพาะ\n" +
        "📷 รูปภาพ (JPG/PNG/HEIC)\n" +
        "📄 ไฟล์ PDF\n\n" +
        "กรุณาส่งเป็นรูปถ่ายหรือไฟล์ PDF ครับ"
      )])
    }
    return
  }

  // ── Text commands ────────────────────────────────────────────
  if (event.message.type !== "text") return
  const text = (event.message.text as string).trim()
  const parts = text.split(/\s+/)
  const cmd   = parts[0]?.toLowerCase()

  // /connect CODE — link LINE to organization
  if (cmd === "/connect") {
    const code = parts[1]?.toUpperCase()
    if (!code) {
      await replyMsg(replyToken, [txt("กรุณาระบุ Code ครับ เช่น /connect ABC123")])
      return
    }

    const { data: tokenRow } = await supabase
      .from("line_connection_tokens")
      .select("organization_id, user_id, expires_at, used_at")
      .eq("token", code)
      .single()

    if (!tokenRow || tokenRow.used_at || new Date(tokenRow.expires_at) < new Date()) {
      await replyMsg(replyToken, [txt(
        "❌ Code ไม่ถูกต้องหรือหมดอายุแล้วครับ\nกรุณาสร้าง Code ใหม่จากหน้า Settings → LINE Bot"
      )])
      return
    }

    // Get LINE display name
    const profileRes = await fetch(`${LINE_API}/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
    const profile = profileRes.ok ? (await profileRes.json() as any) : {}

    const { error: upsertErr } = await supabase.from("line_connections").upsert(
      {
        line_user_id:    lineUserId,
        user_id:         tokenRow.user_id,
        organization_id: tokenRow.organization_id,
        display_name:    profile.displayName ?? lineUserId,
      },
      { onConflict: "line_user_id" }
    )

    if (upsertErr) {
      console.error("[LINE:connect] upsert failed:", upsertErr.message, upsertErr.details)
      await replyMsg(replyToken, [txt(
        "❌ บันทึกการเชื่อมต่อไม่สำเร็จ\nกรุณาลองใหม่อีกครั้งครับ"
      )])
      return
    }

    // Mark token as used
    await supabase
      .from("line_connection_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", code)

    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", tokenRow.organization_id)
      .single()

    await replyMsg(replyToken, [
      txt(
        `✅ เชื่อมบัญชีสำเร็จแล้วครับ!\n` +
        `องค์กร: ${org?.name ?? "—"}\n\n` +
        `ตอนนี้ส่งรูปสลิปหรือใบเสร็จมาได้เลย 📸`
      ),
      withQuickReply(
        txt("เลือกสิ่งที่ต้องการทำต่อไป 👇"),
        [
          { label: "📱 ดูเมนู",        text: "/menu" },
          { label: "📸 วิธีส่งสลิป",  text: "/help" },
          { label: "📊 สรุปค่าใช้จ่าย", text: "/summary" },
        ]
      )
    ])
    return
  }

  // ── Commands below require a linked account ──────────────────
  if (!conn) {
    await replyMsg(replyToken, [txt(
      "กรุณาเชื่อมบัญชีก่อนครับ 🔗\n\n" +
      "1. เปิดแอป Slippy → Settings → LINE Bot\n" +
      "2. คัดลอก Code ที่สร้างขึ้น\n" +
      "3. พิมพ์: /connect CODE"
    )])
    return
  }

  // /summary — monthly spending overview
  if (cmd === "/summary") {
    const month = new Date().toISOString().slice(0, 7)
    const { data: s } = await supabase
      .from("monthly_expense_summary")
      .select("*")
      .eq("organization_id", conn.organization_id)
      .eq("month", month)
      .single()

    const { data: reviewDocs } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", conn.organization_id)
      .eq("status", "reviewing")

    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", conn.organization_id)
      .single()

    if (!s) {
      await replyMsg(replyToken, [txt("ยังไม่มีข้อมูลสรุปเดือนนี้ครับ")])
      return
    }

    await replyMsg(replyToken, [summaryCard({
      orgName:    orgRow?.name ?? "—",
      month,
      docCount:   s.doc_count ?? 0,
      grandTotal: s.grand_total ?? 0,
      vatTotal:   s.vat_total ?? 0,
      reviewCount: (reviewDocs as any)?.length ?? 0,
    })])
    return
  }

  // /status — last 5 documents
  if (cmd === "/status") {
    const { data: docs } = await supabase
      .from("documents")
      .select("id, vendor_name, status, total_amount, doc_date")
      .eq("organization_id", conn.organization_id)
      .order("created_at", { ascending: false })
      .limit(5)

    if (!docs?.length) {
      await replyMsg(replyToken, [txt("ยังไม่มีเอกสารครับ\nส่งรูปสลิปมาได้เลย 📸")])
      return
    }

    const mappedDocs = (docs ?? []).map(d => ({
      id:          d.id as string,
      vendorName:  d.vendor_name as string | null,
      status:      d.status as string,
      totalAmount: d.total_amount as number | null,
      docDate:     d.doc_date as string | null,
    }))
    await replyMsg(replyToken, [statusListCard(mappedDocs)])
    return
  }

  // Helper: find document by full UUID or prefix (supports both full UUID and 8-char prefix)
  const orgId = conn?.organization_id ?? ""
  async function findDoc(docId: string, fields = "id, vendor_name, status"): Promise<any> {
    const cleanId = docId.replace(/…$/, "").replace(/\.$/, "").trim()
    // Full UUID (36 chars with dashes) — use exact match
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)) {
      const { data } = await supabase.from("documents").select(fields)
        .eq("organization_id", orgId).eq("id", cleanId).maybeSingle()
      return data
    }
    // Short prefix — fetch recent docs and match client-side (avoids uuid LIKE issue)
    const { data: docs } = await supabase.from("documents").select(fields)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }).limit(100)
    return (docs ?? []).find((d: any) => d.id.startsWith(cleanId)) ?? null
  }

  // /approve DOCID — approve a reviewing document
  if (cmd === "/approve" && parts[1]) {
    const doc = await findDoc(parts[1])

    if (!doc) {
      await replyMsg(replyToken, [txt("❌ ไม่พบเอกสารครับ\nตรวจสอบ ID จาก /status")])
      return
    }
    if (doc.status !== "reviewing") {
      await replyMsg(replyToken, [txt(`⚠️ เอกสารนี้ไม่ได้อยู่ในสถานะรอตรวจสอบ (${doc.status})`)])
      return
    }

    await supabase.from("documents").update({ status: "approved" }).eq("id", doc.id)
    await replyMsg(replyToken, [txt(`✅ อนุมัติ "${doc.vendor_name ?? doc.id.slice(0,8)}" สำเร็จแล้วครับ`)])
    return
  }

  // /reject DOCID — reject a reviewing document
  if (cmd === "/reject" && parts[1]) {
    const doc = await findDoc(parts[1])

    if (!doc) {
      await replyMsg(replyToken, [txt("❌ ไม่พบเอกสารครับ")])
      return
    }

    await supabase.from("documents").update({ status: "rejected" }).eq("id", doc.id)
    await replyMsg(replyToken, [txt(`🚫 ปฏิเสธ "${doc.vendor_name ?? doc.id.slice(0,8)}" แล้วครับ`)])
    return
  }

  // /retry DOCID — re-queue extraction and notify result via LINE
  if (cmd === "/retry" && parts[1]) {
    const doc = await findDoc(parts[1], "id, vendor_name, status, file_path, file_type, source_meta")

    if (!doc) {
      await replyMsg(replyToken, [txt("❌ ไม่พบเอกสารครับ\nลองใช้ /status เพื่อดูรายการ")])
      return
    }
    if (doc.status === "processing") {
      await replyMsg(replyToken, [txt("⏳ เอกสารนี้กำลังประมวลผลอยู่แล้วครับ")])
      return
    }

    // Reset status → pending and re-queue
    await supabase.from("documents")
      .update({ status: "pending", notes: null, updated_at: new Date().toISOString() })
      .eq("id", doc.id)

    await queueExtraction({
      documentId: doc.id,
      filePath:   doc.file_path,
      fileType:   doc.file_type ?? "image/jpeg",
      orgId:      conn.organization_id,
      lineUserId,   // ← pass through so worker can notify LINE when done
    })

    const name = doc.vendor_name ?? `ID: ${doc.id.slice(0, 8)}`
    await replyMsg(replyToken, [txt(
      `🔄 ส่ง "${name}" ให้ AI อ่านใหม่แล้วครับ\n` +
      `จะแจ้งผลกลับมาในไม่ช้า ⏳`
    )])
    return
  }

  // /delete DOCID — delete a failed/rejected document
  if (cmd === "/delete" && parts[1]) {
    const doc = await findDoc(parts[1], "id, vendor_name, status, file_path")

    if (!doc) {
      await replyMsg(replyToken, [txt("❌ ไม่พบเอกสารครับ")])
      return
    }
    if (doc.status === "approved" || doc.status === "pushed") {
      await replyMsg(replyToken, [txt(
        `⚠️ เอกสาร "${doc.vendor_name ?? doc.id.slice(0, 8)}" ถูกอนุมัติแล้ว\n` +
        `ไม่สามารถลบได้ กรุณาไปที่แอปเพื่อจัดการ`
      )])
      return
    }

    // Delete storage + record
    if (doc.file_path) {
      await supabase.storage.from("documents").remove([doc.file_path]).catch(() => {})
    }
    await supabase.from("documents").delete().eq("id", doc.id)

    await replyMsg(replyToken, [txt(
      `🗑️ ลบเอกสาร "${doc.vendor_name ?? doc.id.slice(0, 8)}" แล้วครับ\n` +
      `ส่งรูปใหม่มาได้เลยหากต้องการ 📸`
    )])
    return
  }

  // /split DOCID — start split bill for a processed document
  if (cmd === "/split") {
    if (!parts[1]) {
      await replyMsg(replyToken, [txt(
        "🤝 หารบิลจากใบเสร็จ:\n" +
        "/split [รหัสเอกสาร] — เริ่มหารรายการในใบเสร็จที่ AI อ่านแล้ว\n\n" +
        "ดูรหัสเอกสารได้จาก /status (8 ตัวอักษรแรกพอครับ)\n\n" +
        "💡 ถ้าจะหารค่ากิจกรรม/ค่าสนามแบบไม่มีใบเสร็จ (เช่น แบด/บาส/ฟุตบอล)\n" +
        "ลองพิมพ์ /sportgroup แทนได้ครับ — หารเท่าๆ กันอัตโนมัติ"
      )])
      return
    }
    const result = await handleSplitCommand(parts[1], conn.organization_id, lineUserId, displayName)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /claim BILLID ITEMINDEX — claim an item in a split bill
  if (cmd === "/claim" && parts[1] && parts[2] !== undefined) {
    const result = await handleClaimCommand(parts[1], Number(parts[2]), lineUserId, displayName)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /splitstatus BILLID — view current split status
  if (cmd === "/splitstatus" && parts[1]) {
    const result = await handleSplitStatus(parts[1], false)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /splitdone BILLID — finalize split and show summary
  if (cmd === "/splitdone" && parts[1]) {
    const result = await handleSplitStatus(parts[1], true)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // ── Medication commands ─────────────────────────────────────────────────────

  // /medtaken LOGID — ยืนยันการทานยา
  if (cmd === "/medtaken" && parts[1]) {
    try {
      const { markMedicationLog } = await import("../services/medication-reminder")
      const { medName } = await markMedicationLog(parts[1], "taken", "line")
      await replyMsg(replyToken, [txt(`✅ บันทึกแล้วครับ!\n💊 ${medName} — ทานแล้ว\n\nดูประวัติยาทั้งหมดได้ที่แอป Slippy`)])
    } catch (e: any) {
      await replyMsg(replyToken, [txt("❌ ไม่สามารถบันทึกได้ กรุณาลองใหม่")])
    }
    return
  }

  // /medskip LOGID — ข้ามการทานยา
  if (cmd === "/medskip" && parts[1]) {
    try {
      const { markMedicationLog } = await import("../services/medication-reminder")
      const { medName } = await markMedicationLog(parts[1], "skipped", "line")
      await replyMsg(replyToken, [txt(`⏭️ ข้ามครั้งนี้แล้วครับ\n💊 ${medName} — บันทึกว่าข้าม`)])
    } catch (e: any) {
      await replyMsg(replyToken, [txt("❌ ไม่สามารถบันทึกได้")])
    }
    return
  }

  // /meds — ดูรายการยาวันนี้
  if (cmd === "/meds" || cmd === "ยาวันนี้") {
    const APP_URL = process.env.APP_URL ?? "https://slippy.ai"
    await replyMsg(replyToken, [txt(
      `💊 รายการยาของคุณ\n\n` +
      `ดูและจัดการยาทั้งหมดได้ที่:\n${APP_URL}/health/medications\n\n` +
      `คำสั่งที่ใช้ได้:\n` +
      `/medtaken [ID] — ยืนยันทานยาแล้ว\n` +
      `/medskip [ID]  — ข้ามครั้งนี้`
    )])
    return
  }

  // ── Trip commands (/trip, /sport, /food, /addexpense, /paid, /settle) ─────────

  // ── Trip-group bill splitting (à la KhunThong, themed for travel) ─────────
  // /tripgroup [ธีมทริป] [ค่าใช้จ่ายรวม] [จุดหมาย] — ตั้งกลุ่ม + แชร์ลิงก์ชวนเพื่อน
  if (cmd === "/tripgroup" || cmd === "/trip" || cmd === "ทริป") {
    const result = await handleCreateTripGroup(parts.slice(1), conn.organization_id, lineUserId, displayName)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /tripstatus รหัสกลุ่ม — ดูยอดต่อหัว + ใครจ่ายแล้ว
  if (cmd === "/tripstatus" && parts[1]) {
    const result = await handleTripStatus(parts[1], conn.organization_id, false)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /trippay รหัสกลุ่ม — แจ้งว่าจ่ายส่วนของตัวเองแล้ว
  if (cmd === "/trippay" && parts[1]) {
    const result = await handleTripPay(parts[1], conn.organization_id, lineUserId, displayName)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /tripdone รหัสกลุ่ม — ปิดกลุ่มและสรุปยอดสุดท้าย
  if (cmd === "/tripdone" && parts[1]) {
    const result = await handleTripStatus(parts[1], conn.organization_id, true)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // ── Sport-group bill splitting (à la KhunThong) ──────────────────────────
  // /sportgroup [กีฬา] [ค่าใช้จ่ายรวม] [สถานที่] — ตั้งกลุ่ม + แชร์ลิงก์ชวนเพื่อน
  if (cmd === "/sportgroup" || cmd === "/sport") {
    const result = await handleCreateSportGroup(parts.slice(1), conn.organization_id, lineUserId, displayName)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /sportstatus รหัสกลุ่ม — ดูยอดต่อหัว + ใครจ่ายแล้ว
  if (cmd === "/sportstatus" && parts[1]) {
    const result = await handleSportStatus(parts[1], conn.organization_id, false)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /sportpay รหัสกลุ่ม — แจ้งว่าจ่ายส่วนของตัวเองแล้ว
  if (cmd === "/sportpay" && parts[1]) {
    const result = await handleSportPay(parts[1], conn.organization_id, lineUserId, displayName)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /sportdone รหัสกลุ่ม — ปิดกลุ่มและสรุปยอดสุดท้าย
  if (cmd === "/sportdone" && parts[1]) {
    const result = await handleSportStatus(parts[1], conn.organization_id, true)
    if (result.card) await replyMsg(replyToken, [result.card])
    else if (result.text) await replyMsg(replyToken, [txt(result.text)])
    return
  }

  // /food [ร้าน] — สร้างบิลอาหาร
  if (cmd === "/food" && parts[1]) {
    const restaurant = parts.slice(1).join(" ").trim()
    const APP_URL    = process.env.APP_URL ?? "https://slippy.ai"
    await replyMsg(replyToken, [txt(
      `🍽️ บิลอาหาร "${restaurant}"\n\n` +
      `สร้างรายการและระบุว่าใครสั่งอะไร:\n${APP_URL}/trips/new?type=food_order&venue=${encodeURIComponent(restaurant)}\n\n` +
      `หรือส่งรูปบิลอาหารมา → AI อ่านรายการให้อัตโนมัติ 📸`
    )])
    return
  }

  // /menu or /help — interactive command menu
  if (cmd === "/menu" || cmd === "/help" || cmd === "help" || cmd === "เมนู" || cmd === "menu") {
    await replyMsg(replyToken, [commandMenuCard()])
    return
  }

  // 🤖 AI Coach (Nova) — Rich Menu "AI Coach" card entry point.
  // Lightweight intro + quick replies into the product pillars for now;
  // a full conversational AI-coaching engine is planned (see "Slippy Universe"
  // roadmap — AI Coach / Nova in docs).
  if (text === "คุยกับ Nova 🤖" || cmd === "/ai" || cmd === "nova" || /^(สวัสดี\s*)?nova$/i.test(text)) {
    await replyMsg(replyToken, [
      txt(
        "👋 สวัสดีครับ! ผม Nova — AI Coach ของ Slippy\n\n" +
        "ผมช่วยวิเคราะห์ข้อมูลจากสลิป/ใบเสร็จของคุณ แล้วสรุปเป็น Insight " +
        "เพื่อพัฒนาชีวิตทั้ง 4 ด้าน: 🩺 Health · 🪙 Wealth · 🛍️ Lifestyle · 👥 Community\n\n" +
        "ลองเริ่มจากส่งสลิปมาให้ผมอ่านก่อนได้เลยครับ 📸 หรือเลือกหัวข้อด้านล่าง"
      ),
      withQuickReply(
        txt("อยากให้ผมช่วยเรื่องไหนดีครับ 👇"),
        [
          { label: "📸 ส่งสลิปให้ Nova อ่าน", text: "📸 ส่งสลิป" },
          { label: "📊 สรุปค่าใช้จ่าย",       text: "/summary" },
          { label: "📱 ดูเมนูทั้งหมด",        text: "/menu" },
        ]
      )
    ])
    return
  }

  // Default — with quick reply
  await replyMsg(replyToken, [
    withQuickReply(
      txt("ส่งรูปสลิปหรือใบเสร็จมาได้เลยครับ 📸\nหรือกดปุ่มด้านล่างเพื่อเลือกเมนู"),
      mainQuickReply()
    )
  ])
}

// ── Called from extraction worker after processing ───────────────────────────
export async function notifyLineAfterExtraction(
  documentId:     string,
  organizationId: string,
  result: { success: boolean; auto_approved?: boolean; confidence_score?: number; error?: string },
  lineUserIdHint?: string   // pre-filled from job payload — avoids a DB round-trip
) {
  const tag = `[notify-line:${documentId.slice(0, 8)}]`

  // ── Get document details (full fields for rich card) ─────────────────────────
  const { data: doc, error: dbErr } = await supabase
    .from("documents")
    .select(`
      source, source_meta, status, overall_confidence,
      vendor_name, vendor_tax_id,
      total_amount, subtotal, vat_amount, discount_amount, delivery_fee, wht_amount,
      vat_claimable, doc_date, doc_number, doc_category, payment_method
    `)
    .eq("id", documentId)
    .single()

  // Also fetch line items for detailed receipt
  const { data: lineItems } = await supabase
    .from("document_line_items")
    .select("description, quantity, unit_price, amount")
    .eq("document_id", documentId)
    .order("sort_order", { ascending: true })
    .limit(8)

  if (dbErr) {
    console.error(tag, "DB query error:", dbErr.message)
    // Fall back to hint if available
    if (!lineUserIdHint) return
  }

  if (doc && doc.source !== "line") {
    console.log(tag, `source="${doc.source}" — not a LINE document, skip`)
    return
  }

  const lineUserId = lineUserIdHint
    ?? (doc?.source_meta as any)?.line_user_id as string | undefined
  const storedName = (doc?.source_meta as any)?.file_name as string | undefined

  if (!lineUserId) {
    console.warn(tag, "No lineUserId found — cannot push notification")
    return
  }

  // ── Check token is present ───────────────────────────────────────────────────
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error(tag, "LINE_CHANNEL_ACCESS_TOKEN is not set — cannot push")
    return
  }

  console.log(tag, `Pushing to LINE user ${lineUserId.slice(0, 8)}…  success=${result.success}`)

  // ── Send appropriate message ─────────────────────────────────────────────────
  if (!result.success) {
    await pushMsg(lineUserId, [
      txt(`❌ ประมวลผลเอกสารไม่สำเร็จ\n${storedName ? `ไฟล์: ${storedName}\n` : ""}กรุณาส่งรูปใหม่อีกครั้งครับ`),
    ])
    return
  }

  // Build full-detail result card
  const card = docResultCard({
    docId:           documentId,
    vendorName:      doc?.vendor_name       ?? null,
    vendorTaxId:     (doc as any)?.vendor_tax_id   ?? null,
    totalAmount:     doc?.total_amount      ?? null,
    subtotal:        (doc as any)?.subtotal         ?? null,
    vatAmount:       doc?.vat_amount        ?? null,
    discountAmount:  (doc as any)?.discount_amount  ?? null,
    deliveryFee:     (doc as any)?.delivery_fee     ?? null,
    whtAmount:       (doc as any)?.wht_amount       ?? null,
    vatClaimable:    (doc as any)?.vat_claimable    ?? null,
    docDate:         doc?.doc_date          ?? null,
    docNumber:       (doc as any)?.doc_number       ?? null,
    category:        doc?.doc_category      ?? null,
    confidence:      result.confidence_score ?? doc?.overall_confidence ?? null,
    status:          doc?.status            ?? "reviewing",
    fileName:        storedName             ?? documentId.slice(0, 8),
    paymentMethod:   (doc as any)?.payment_method   ?? null,
    lineItems:       (lineItems ?? []) as Array<{ description: string; quantity: number; unit_price: number; amount: number }>,
  })

  // Attach quick-reply buttons so user can immediately act
  await pushMsg(lineUserId, [
    withQuickReply(card as Record<string, unknown>, mainQuickReply()),
  ])
  console.log(tag, "✅ Notification sent OK")
}
