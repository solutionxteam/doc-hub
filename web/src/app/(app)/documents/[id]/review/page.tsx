/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { notFound }       from "next/navigation"
import { ReviewClient }   from "@/components/documents/review-client"

interface Props { params: Promise<{ id: string }> }

export default async function ReviewPage({ params }: Props) {
  const { id } = await params
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const [{ data: doc }, { data: integrations }] = await Promise.all([
    supabase
      .from("documents")
      .select(`
        *,
        document_line_items(*),
        document_audit_logs(id, action, actor_id, created_at, note)
      `)
      .eq("id", id)
      .single(),
    supabase
      .from("integrations")
      .select("id, provider, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true),
  ])

  if (!doc) notFound()

  // Fetch original doc for duplicate resolution UI
  let duplicateOriginal: { id: string; vendor_name: string | null; doc_date: string | null; total_amount: number | null; doc_number: string | null } | null = null
  if (doc.is_duplicate && (doc.duplicate_of || doc.duplicate_doc_id)) {
    const originalId = doc.duplicate_of ?? doc.duplicate_doc_id
    const { data: orig } = await supabase
      .from("documents")
      .select("id, vendor_name, doc_date, total_amount, doc_number")
      .eq("id", originalId)
      .single()
    duplicateOriginal = orig ?? null
  }

  // HEIC/HEIF files cannot be displayed by most browsers natively.
  // Route through our /view API which converts to JPEG on the fly.
  const heicExts = new Set(["heic", "heif", "hif"])
  const fileExt  = doc.file_path?.split(".").pop()?.toLowerCase() ?? ""
  const isHeic   = heicExts.has(fileExt)

  let fileUrl: string
  if (isHeic) {
    // Use our conversion endpoint — auth is handled inside the route
    fileUrl = `/api/documents/${id}/view`
  } else {
    // Signed URL (1 hour) — works for both public and private storage buckets.
    // Falls back to public URL if signing fails.
    const { data: signedData } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60 * 60)

    fileUrl = signedData?.signedUrl
      ?? supabase.storage.from("documents").getPublicUrl(doc.file_path).data.publicUrl
  }

  return (
    <ReviewClient
      doc={doc}
      fileUrl={fileUrl}
      integrations={integrations ?? []}
      userRole={role}
      duplicateOriginal={duplicateOriginal}
    />
  )
}
