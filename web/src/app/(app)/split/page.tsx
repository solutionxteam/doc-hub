/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getMembership } from "@/lib/get-membership"
import { createClient }  from "@/lib/supabase/server"
import { SplitClient }   from "@/components/split/split-client"

export default async function SplitPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const { data: bills } = await supabase
    .from("split_bills")
    .select(`
      id, title, total_amount, note, created_at, document_id,
      split_participants(id, name, email, amount, paid_at)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <SplitClient
      orgId={orgId}
      bills={bills ?? []}
    />
  )
}
