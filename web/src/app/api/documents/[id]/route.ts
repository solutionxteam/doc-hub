/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient }              from "@/lib/supabase/server"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  // Verify caller is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Fetch document — verify it belongs to one of the user's orgs
  const { data: doc, error: fetchErr } = await supabase
    .from("documents")
    .select("id, file_path, organization_id")
    .eq("id", id)
    .single()

  if (fetchErr || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", doc.organization_id)
    .single()

  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Delete file from storage (best-effort — row deletion is the source of truth)
  if (doc.file_path) {
    await supabase.storage.from("documents").remove([doc.file_path])
  }

  // Delete document row
  const { error: deleteErr } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
