/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 *
 * GET /api/documents/[id]/view
 *
 * Serves the document file as a browser-displayable image.
 * HEIC/HEIF files are converted to JPEG on-the-fly so every browser can display them.
 * Other image types are proxied through unchanged.
 * PDFs are proxied unchanged (iframe can display them).
 *
 * Auth: caller must be authenticated AND be a member of the document's org.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"

const HEIC_EXTS = new Set(["heic", "heif", "hif"])
const CACHE_SECONDS = 3600 // 1 hour — file content never changes

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  // ── Fetch doc ─────────────────────────────────────────────────────────────────
  const { data: doc } = await supabase
    .from("documents")
    .select("file_path, organization_id")
    .eq("id", id)
    .single()

  if (!doc) return new NextResponse("Not found", { status: 404 })

  // ── Membership check ──────────────────────────────────────────────────────────
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", doc.organization_id)
    .single()

  if (!membership) return new NextResponse("Forbidden", { status: 403 })

  // ── Download original file ────────────────────────────────────────────────────
  const { data: blob, error } = await supabase.storage
    .from("documents")
    .download(doc.file_path)

  if (error || !blob) {
    return new NextResponse("File not found in storage", { status: 404 })
  }

  const buffer = Buffer.from(await blob.arrayBuffer())
  const ext    = doc.file_path.split(".").pop()?.toLowerCase() ?? ""

  // ── PDF — proxy unchanged ─────────────────────────────────────────────────────
  if (ext === "pdf") {
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":  "application/pdf",
        "Cache-Control": `private, max-age=${CACHE_SECONDS}`,
      },
    })
  }

  // ── HEIC/HEIF — convert to JPEG ───────────────────────────────────────────────
  if (HEIC_EXTS.has(ext)) {
    try {
      const heicConvert = (await import("heic-convert")).default
      const jpegBuf = await heicConvert({
        buffer:  new Uint8Array(buffer) as unknown as ArrayBuffer,
        format:  "JPEG",
        quality: 0.92,
      })
      return new NextResponse(Buffer.from(jpegBuf), {
        headers: {
          "Content-Type":  "image/jpeg",
          "Cache-Control": `private, max-age=${CACHE_SECONDS}`,
        },
      })
    } catch (e) {
      console.error("[view] HEIC conversion failed:", e)
      // Fall through to serve raw — browser may still handle it (Safari)
    }
  }

  // ── Other images (jpg, png, webp, …) — proxy unchanged ───────────────────────
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
  }
  const contentType = mimeMap[ext] ?? "application/octet-stream"

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":  contentType,
      "Cache-Control": `private, max-age=${CACHE_SECONDS}`,
    },
  })
}
