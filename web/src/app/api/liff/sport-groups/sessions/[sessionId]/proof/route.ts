import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { loadDetail } from "../route"

const BUCKET = "payment-proofs"

function extFromMime(mime: string) {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "jpg"
}

// POST /api/liff/sport-groups/sessions/[sessionId]/proof — multipart/form-data
// fields: lineUserId, file (image). Uploads the slip/screenshot to the
// payment-proofs bucket and marks the participant as paid.
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const form = await req.formData()
  const lineUserId = form.get("lineUserId") as string | null
  const file       = form.get("file") as File | null
  if (!lineUserId || !file) return NextResponse.json({ error: "lineUserId and file required" }, { status: 400 })

  const admin = createAdminClient()
  const { data: me } = await admin.from("split_participants")
    .select("id").eq("split_bill_id", sessionId).eq("line_user_id", lineUserId).maybeSingle()
  if (!me) return NextResponse.json({ error: "คุณยังไม่ได้เข้าร่วมกลุ่มนี้" }, { status: 400 })

  const ext  = extFromMime(file.type)
  const path = `${sessionId}/${me.id}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage.from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path)

  await admin.from("split_participants")
    .update({ payment_proof_url: pub.publicUrl, paid_at: new Date().toISOString() })
    .eq("id", me.id)

  const detail = await loadDetail(admin, sessionId, lineUserId)
  return NextResponse.json({ ok: true, group: detail })
}

// DELETE /api/liff/sport-groups/sessions/[sessionId]/proof?lineUserId=Uxxx
// — removes the uploaded slip and clears paid status
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")
  if (!lineUserId) return NextResponse.json({ error: "lineUserId required" }, { status: 400 })

  const admin = createAdminClient()
  const { data: me } = await admin.from("split_participants")
    .select("id, payment_proof_url").eq("split_bill_id", sessionId).eq("line_user_id", lineUserId).maybeSingle()
  if (!me) return NextResponse.json({ error: "คุณยังไม่ได้เข้าร่วมกลุ่มนี้" }, { status: 400 })

  if (me.payment_proof_url) {
    for (const ext of ["jpg", "png", "webp"]) {
      await admin.storage.from(BUCKET).remove([`${sessionId}/${me.id}.${ext}`])
    }
  }

  await admin.from("split_participants")
    .update({ payment_proof_url: null, paid_at: null })
    .eq("id", me.id)

  const detail = await loadDetail(admin, sessionId, lineUserId)
  return NextResponse.json({ ok: true, group: detail })
}
