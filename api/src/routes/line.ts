import type { FastifyInstance } from "fastify"
import crypto from "node:crypto"
import { supabase } from "../lib/supabase"
import { queueExtraction } from "../queue/setup"

const LINE_API = "https://api.line.me/v2/bot"
const token = () => process.env.LINE_CHANNEL_ACCESS_TOKEN!

function verifySignature(rawBody: Buffer | string, sig: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET!
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig)) }
  catch { return false }
}

async function replyMsg(replyToken: string, messages: object[]) {
  await fetch(`${LINE_API}/message/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body:    JSON.stringify({ replyToken, messages }),
  })
}

async function pushMsg(to: string, messages: object[]) {
  await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
    body:    JSON.stringify({ to, messages }),
  })
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
    await Promise.allSettled(events.map(handleEvent))
    return { ok: true }
  })
}

async function handleEvent(event: any) {
  const lineUserId = event.source?.userId as string
  const replyToken = event.replyToken as string

  if (event.type === "follow") {
    await replyMsg(replyToken, [txt(
      "สวัสดีครับ! 👋\n" +
      "ส่งรูปสลิปหรือใบเสร็จมาได้เลย ระบบจะ OCR อัตโนมัติ\n\n" +
      "คำสั่งที่ใช้ได้:\n" +
      "🔗 /connect CODE — เชื่อมบัญชี\n" +
      "📊 /summary — ยอดสรุปเดือนนี้\n" +
      "📋 /status — สถานะเอกสารล่าสุด"
    )])
    return
  }

  if (event.type !== "message") return

  const { data: conn } = await supabase
    .from("line_connections")
    .select("user_id, organization_id")
    .eq("line_user_id", lineUserId)
    .single()

  // ── Image: receive slip/receipt ──────────────────────────────
  if (event.message.type === "image") {
    if (!conn) {
      await replyMsg(replyToken, [txt(
        "กรุณาเชื่อมบัญชีก่อนครับ\nใช้คำสั่ง /connect CODE จากหน้า Settings ในแอป"
      )])
      return
    }

    await replyMsg(replyToken, [txt("รับสลิปแล้วครับ 📄 กำลังประมวลผล...")])

    try {
      // Download from LINE CDN
      const imgRes = await fetch(`${LINE_API}/message/${event.message.id}/content`, {
        headers: { Authorization: `Bearer ${token()}` },
      })
      const buffer   = Buffer.from(await imgRes.arrayBuffer())
      const fileName = `line_${event.message.id}.jpg`
      const filePath = `${conn.organization_id}/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(filePath, buffer, { contentType: "image/jpeg", upsert: false })

      if (uploadErr) throw new Error(uploadErr.message)

      // Check & increment quota
      const { data: allowed } = await supabase.rpc("increment_doc_used", {
        p_org_id: conn.organization_id,
      })
      if (!allowed) {
        // Rollback storage upload
        await supabase.storage.from("documents").remove([filePath])
        await pushMsg(lineUserId, [txt(
          "⚠️ โควต้าเอกสารเต็มแล้วครับ\nกรุณาอัปเกรดแผนหรือซื้อ Add-on ในแอป"
        )])
        return
      }

      // Insert document record
      const { data: doc } = await supabase
        .from("documents")
        .insert({
          organization_id: conn.organization_id,
          uploaded_by:     conn.user_id,
          file_path:       filePath,
          file_name:       fileName,
          file_type:       "image/jpeg",
          source:          "line",
          source_meta:     { line_user_id: lineUserId, message_id: event.message.id },
          status:          "pending",
        })
        .select("id")
        .single()

      if (!doc) throw new Error("Document insert failed")

      await queueExtraction({
        documentId: doc.id,
        filePath,
        fileType:   "image/jpeg",
        orgId:      conn.organization_id,
      })

      await pushMsg(lineUserId, [txt(
        `✅ บันทึกสลิปแล้วครับ\nID: ${doc.id.slice(0, 8)}…\nระบบกำลัง OCR จะแจ้งผลเมื่อเสร็จ`
      )])
    } catch (err: any) {
      console.error("[line] image error:", err.message)
      await pushMsg(lineUserId, [txt("❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ")])
    }
    return
  }

  // ── Text commands ────────────────────────────────────────────
  if (event.message.type !== "text") return
  const text = (event.message.text as string).trim()

  // /connect CODE
  if (text.toLowerCase().startsWith("/connect")) {
    const code = text.split(/\s+/)[1]?.toUpperCase()
    if (!code) {
      await replyMsg(replyToken, [txt("กรุณาระบุ Code ครับ เช่น /connect ABC123")])
      return
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("id, line_connect_code, line_connect_expires_at")
      .eq("line_connect_code", code)
      .single()

    if (!org || new Date(org.line_connect_expires_at) < new Date()) {
      await replyMsg(replyToken, [txt("❌ Code ไม่ถูกต้องหรือหมดอายุแล้วครับ\nกรุณาสร้าง Code ใหม่จากหน้า Settings")])
      return
    }

    const { data: member } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", org.id)
      .eq("role", "owner")
      .single()

    // Get LINE display name
    const profileRes = await fetch(`${LINE_API}/profile/${lineUserId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
    const profile = profileRes.ok ? (await profileRes.json() as any) : {}

    await supabase.from("line_connections").upsert(
      {
        line_user_id:    lineUserId,
        user_id:         member?.user_id ?? null,
        organization_id: org.id,
        display_name:    profile.displayName ?? lineUserId,
      },
      { onConflict: "line_user_id" }
    )

    // Invalidate code
    await supabase
      .from("organizations")
      .update({ line_connect_code: null, line_connect_expires_at: null })
      .eq("id", org.id)

    await replyMsg(replyToken, [txt(
      "✅ เชื่อมบัญชีสำเร็จแล้วครับ!\n" +
      "ตอนนี้ส่งรูปสลิปหรือใบเสร็จมาได้เลย 📸\n\n" +
      "คำสั่ง:\n📊 /summary — ยอดสรุปเดือนนี้\n📋 /status — สถานะเอกสารล่าสุด"
    )])
    return
  }

  if (!conn) {
    await replyMsg(replyToken, [txt(
      "กรุณาเชื่อมบัญชีก่อนครับ\nใช้คำสั่ง /connect CODE จากหน้า Settings ในแอป"
    )])
    return
  }

  // /summary
  if (/^\/summary$/i.test(text) || /^summary$/i.test(text)) {
    const month = new Date().toISOString().slice(0, 7) // "YYYY-MM"
    const { data: s } = await supabase
      .from("monthly_expense_summary")
      .select("*")
      .eq("organization_id", conn.organization_id)
      .eq("month", month)
      .single()

    if (!s) {
      await replyMsg(replyToken, [txt("ยังไม่มีข้อมูลสรุปเดือนนี้ครับ")])
      return
    }

    await replyMsg(replyToken, [txt(
      `📊 สรุปเดือน ${month}\n` +
      `รายจ่ายรวม: ฿${Number(s.total_amount ?? 0).toLocaleString()}\n` +
      `จำนวนเอกสาร: ${s.doc_count ?? 0} ใบ\n` +
      `ภาษีซื้อ: ฿${Number(s.total_vat ?? 0).toLocaleString()}`
    )])
    return
  }

  // /status
  if (/^\/status$/i.test(text) || /^status$/i.test(text)) {
    const { data: docs } = await supabase
      .from("documents")
      .select("file_name, status, created_at")
      .eq("organization_id", conn.organization_id)
      .order("created_at", { ascending: false })
      .limit(5)

    if (!docs?.length) {
      await replyMsg(replyToken, [txt("ยังไม่มีเอกสารครับ")])
      return
    }

    const emo: Record<string, string> = {
      pending: "⏳", processing: "🔄", reviewing: "👀",
      approved: "✅", pushed: "📤", failed: "❌", rejected: "🚫",
    }
    const msg =
      "📋 เอกสารล่าสุด 5 รายการ\n\n" +
      docs.map(d => `${emo[d.status] ?? "❓"} ${d.file_name}\n   (${d.status})`).join("\n\n")

    await replyMsg(replyToken, [txt(msg)])
    return
  }

  // Default
  await replyMsg(replyToken, [txt(
    "ส่งรูปสลิปหรือใบเสร็จมาได้เลยครับ 📸\n\n" +
    "คำสั่ง:\n" +
    "📊 /summary — ยอดสรุปเดือนนี้\n" +
    "📋 /status — สถานะเอกสารล่าสุด"
  )])
}

// ── Called from extraction worker after processing ───────────────
export async function notifyLineAfterExtraction(
  documentId: string,
  organizationId: string,
  result: { success: boolean; auto_approved?: boolean; confidence_score?: number; error?: string }
) {
  // Only notify if document was sent via LINE
  const { data: doc } = await supabase
    .from("documents")
    .select("source, source_meta, file_name")
    .eq("id", documentId)
    .single()

  if (!doc || doc.source !== "line") return

  const lineUserId = (doc.source_meta as any)?.line_user_id as string | undefined
  if (!lineUserId) return

  if (!result.success) {
    await pushMsg(lineUserId, [txt(
      `❌ ประมวลผลเอกสารไม่สำเร็จ\nไฟล์: ${doc.file_name}\nกรุณาตรวจสอบในแอปครับ`
    )])
    return
  }

  const status = result.auto_approved ? "✅ อนุมัติอัตโนมัติ" : "👀 รอตรวจสอบ"
  const score  = result.confidence_score != null
    ? `\nความถูกต้อง: ${(result.confidence_score * 100).toFixed(0)}%`
    : ""

  await pushMsg(lineUserId, [txt(
    `📄 ประมวลผลเสร็จแล้วครับ\n` +
    `ไฟล์: ${doc.file_name}\n` +
    `สถานะ: ${status}${score}`
  )])
}
