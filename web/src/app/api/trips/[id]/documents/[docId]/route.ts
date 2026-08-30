/**
 * One trip document — a signed URL to view it, or delete it entirely.
 *
 * GET returns a signed URL rather than redirecting to one: the trip-documents
 * bucket is private, and a bare redirect would leak the signed URL into
 * browser history / referrer headers on whatever page the link is opened
 * from. Mirrors the working pattern already in
 * web/src/app/(app)/documents/[id]/review/page.tsx (createSignedUrl, 1 hour).
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthedUser } from "@/lib/authed-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTripAccess } from "@/lib/trips/trip-access"

type Params = { params: Promise<{ id: string; docId: string }> }

async function guard(tripId: string, req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  const access = await getTripAccess(tripId, user.id)
  if (!access.allowed) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { admin: createAdminClient() }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id: tripId, docId } = await params
  const g = await guard(tripId, req)
  if (g.error) return g.error
  const { admin } = g

  const { data: doc } = await admin.from("trip_documents")
    .select("file_path").eq("id", docId).eq("journey_id", tripId).single()
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 })

  const { data: signed, error } = await admin.storage.from("trip-documents")
    .createSignedUrl(doc.file_path, 60 * 60)
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "เปิดไฟล์ไม่สำเร็จ" }, { status: 500 })
  return NextResponse.json({ url: signed.signedUrl })
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id: tripId, docId } = await params
  const g = await guard(tripId, req)
  if (g.error) return g.error
  const { admin } = g

  const { data: doc } = await admin.from("trip_documents")
    .select("file_path").eq("id", docId).eq("journey_id", tripId).single()
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 })

  await admin.storage.from("trip-documents").remove([doc.file_path])
  const { error } = await admin.from("trip_documents").delete().eq("id", docId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
