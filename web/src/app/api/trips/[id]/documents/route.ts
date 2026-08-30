/**
 * The trip's document library — itinerary scans, passport, visa, insurance,
 * tickets, hotel confirmations. Store-and-view only: no vision extraction
 * here, unlike import-document (which reads a file and discards it after
 * parsing itinerary rows). This keeps the original around to open later.
 *
 * Uploaded into the PRIVATE `trip-documents` bucket, not the shared
 * `documents` bucket — see the migration's own comment for why this is its
 * own table rather than an extension of the accounting documents table.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthedUser } from "@/lib/authed-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTripAccess } from "@/lib/trips/trip-access"
import type { TripDocumentKind } from "@/lib/trips/journey"

type Params = { params: Promise<{ id: string }> }

const MAX_BYTES = 15 * 1024 * 1024
const KINDS: TripDocumentKind[] = ["itinerary", "passport", "visa", "insurance", "ticket", "hotel", "other"]
const EXT_TYPE: Record<string, string> = {
  pdf: "pdf", jpg: "jpg", jpeg: "jpg", png: "png", heic: "heic",
}

async function guard(tripId: string, req: NextRequest) {
  const user = await getAuthedUser(req)
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  const access = await getTripAccess(tripId, user.id)
  if (!access.allowed) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { admin: createAdminClient(), userId: user.id }
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id: tripId } = await params
  const g = await guard(tripId, req)
  if (g.error) return g.error
  const { admin } = g

  const { data, error } = await admin.from("trip_documents")
    .select("id, kind, title, file_path, file_type, file_size, created_at")
    .eq("journey_id", tripId)
    .order("created_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ documents: data ?? [] })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: tripId } = await params
  const g = await guard(tripId, req)
  if (g.error) return g.error
  const { admin, userId } = g

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "แนบไฟล์ด้วย" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)} MB) — จำกัดที่ 15 MB` },
      { status: 413 })
  }

  const kindRaw = form?.get("kind")
  const kind = (typeof kindRaw === "string" && KINDS.includes(kindRaw as TripDocumentKind))
    ? kindRaw as TripDocumentKind : "other"
  const titleRaw = form?.get("title")
  const title = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : file.name

  const ext = (file.name.split(".").pop() ?? "").toLowerCase()
  const fileType = EXT_TYPE[ext]
  if (!fileType) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์ PDF, JPG, PNG, HEIC" }, { status: 400 })
  }

  const path = `${tripId}/${crypto.randomUUID()}.${ext}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage.from("trip-documents")
    .upload(path, bytes, { contentType: file.type || undefined })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: row, error } = await admin.from("trip_documents").insert({
    journey_id: tripId,
    uploaded_by: userId,
    kind, title,
    file_path: path,
    file_type: fileType,
    file_size: file.size,
  }).select("id, kind, title, file_path, file_type, file_size, created_at").single()

  if (error) {
    await admin.storage.from("trip-documents").remove([path])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ document: row })
}
