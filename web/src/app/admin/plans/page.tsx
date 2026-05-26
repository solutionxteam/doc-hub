/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

import { createAdminClient } from "@/lib/supabase/admin"
import { AdminPlansClient }  from "@/components/admin/admin-plans-client"

export const dynamic = "force-dynamic"

export default async function AdminPlansPage() {
  const admin = createAdminClient()
  const { data: plans, error } = await admin
    .from("pricing_plans")
    .select("*")
    .order("sort_order")

  if (error) {
    return (
      <div className="rounded-lg bg-red-950/40 border border-red-800 p-6 text-red-300">
        <p className="font-semibold">ดึงข้อมูล plans ไม่ได้</p>
        <p className="text-sm mt-1 font-mono">{error.message}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Plans &amp; Pricing</h1>
        <p className="mt-1 text-sm text-zinc-400">
          แก้ไขชื่อ ราคา โควต้า features และ Stripe Price ID ของแต่ละ plan ·{" "}
          <span className="text-amber-400">
            การเปลี่ยนแปลงมีผลทันที — ไม่กระทบ subscription ที่ active อยู่
          </span>
        </p>
      </div>
      <AdminPlansClient plans={plans ?? []} />
    </div>
  )
}
