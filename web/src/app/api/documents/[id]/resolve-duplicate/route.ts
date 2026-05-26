/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 *
 * POST /api/documents/[id]/resolve-duplicate
 * body: { action: "replace" | "discard" }
 *
 * replace — keep this (newer) doc, archive the original (duplicate_of)
 * discard — delete this doc, keep the original
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { action } = await req.json() as { action: "replace" | "discard" }

  if (action !== "replace" && action !== "discard") {
    return NextResponse.json({ error: "action must be replace or discard" }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Load the new (duplicate) document
  const { data: newDoc } = await supabase
    .from("documents")
    .select("id, is_duplicate, duplicate_of, organization_id, file_path")
    .eq("id", id)
    .single()

  if (!newDoc?.is_duplicate || !newDoc.duplicate_of) {
    return NextResponse.json({ error: "Document is not flagged as duplicate" }, { status: 400 })
  }

  // Verify membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", newDoc.organization_id)
    .single()

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const originalId = newDoc.duplicate_of

  if (action === "replace") {
    // Archive (reject) the original, clear duplicate flags on the new one
    await supabase.from("documents").update({
      status:     "rejected",
      notes:      `แทนที่โดยเอกสาร ${id}`,
      updated_at: new Date().toISOString(),
    }).eq("id", originalId)

    await supabase.from("documents").update({
      is_duplicate:  false,
      duplicate_of:  null,
      duplicate_doc_id: null,
      // Remove DUPLICATE from validation_issues / warnings
      validation_issues:   null,
      validation_warnings: null,
      updated_at:    new Date().toISOString(),
    }).eq("id", id)

    // Audit log
    await supabase.from("document_audit_logs").insert({
      document_id: id,
      action:      "duplicate_replaced",
      actor:       "user",
      metadata:    { replaced_doc_id: originalId, actor_id: user.id },
    })

    return NextResponse.json({ action: "replace", originalId, newId: id })
  }

  // action === "discard" — delete the new doc, keep the original
  if (newDoc.file_path) {
    await supabase.storage.from("documents").remove([newDoc.file_path])
  }
  await supabase.from("documents").delete().eq("id", id)

  // Audit log on original
  await supabase.from("document_audit_logs").insert({
    document_id: originalId,
    action:      "duplicate_discarded",
    actor:       "user",
    metadata:    { discarded_doc_id: id, actor_id: user.id },
  })

  return NextResponse.json({ action: "discard", originalId, newId: id })
}
