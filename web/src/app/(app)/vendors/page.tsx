/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { VendorsClient }  from "@/components/vendors/vendors-client"

export default async function VendorsPage() {
  const { organization_id: orgId } = await getMembership()
  const supabase = await createClient()

  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .eq("organization_id", orgId)
    .order("total_amount", { ascending: false })
    .limit(200)

  return <VendorsClient vendors={vendors ?? []} />
}
