/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { createClient }      from "@/lib/supabase/server"
import { CreatePostClient }  from "@/components/social/create-post-client"

export const dynamic = "force-dynamic"

export type RecentDoc = {
  id:          string
  vendor_name: string | null
  doc_date:    string | null
  total_amount: number | null
  doc_type:    string | null
}

export default async function CreatePostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ""

  const { data: rawDocs } = await supabase
    .from("documents")
    .select("id, vendor_name, doc_date, total_amount, doc_type")
    .eq("user_id", userId)
    .eq("is_personal", true)
    .order("created_at", { ascending: false })
    .limit(20)

  const recentDocs: RecentDoc[] = (rawDocs ?? []).map((d: any) => ({
    id:           d.id,
    vendor_name:  d.vendor_name ?? null,
    doc_date:     d.doc_date ?? null,
    total_amount: d.total_amount ?? null,
    doc_type:     d.doc_type ?? null,
  }))

  return <CreatePostClient recentDocs={recentDocs} />
}
