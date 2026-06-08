/**
 * Copyright © 2026 SolutionX Co., Ltd.
 */

import { createClient }       from "@/lib/supabase/server"
import { getMembership }      from "@/lib/get-membership"
import { LineSection }        from "@/components/settings/line-section"
import { IntegrationsClient } from "@/components/settings/integrations-client"
import { StaticLineChatPreview } from "@/components/settings/line-chat-preview"

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { organization_id: orgId, role } = await getMembership()
  const isAdmin = ["owner", "admin"].includes(role)

  const [{ data: integrations }, { data: lineConn }, { data: org }] = await Promise.all([
    supabase.from("integrations").select("id, provider, is_active, last_synced_at, meta").eq("organization_id", orgId),
    supabase.from("line_connections").select("id, line_user_id, display_name, created_at").eq("organization_id", orgId).limit(10),
    supabase.from("organizations").select("slug").eq("id", orgId).single(),
  ])

  return (
    <div className="flex gap-6 p-6 lg:p-7 animate-fade-in">

      {/* ── Main column ─────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-[22px] font-bold text-foreground">การเชื่อมต่อ</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            เชื่อมต่อ Slippy กับบริการภายนอกเพื่อเพิ่มประสิทธิภาพการทำงาน
          </p>
        </div>

        {/* LINE Bot */}
        <section>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">LINE Bot</h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              รับสลิปและใบเสร็จผ่าน LINE · ดูรายงาน · อนุมัติเอกสาร
            </p>
          </div>
          <LineSection orgId={orgId} isAdmin={isAdmin} />
        </section>

        {/* Accounting connectors */}
        <section>
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold text-foreground">ระบบบัญชี</h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              ส่งเอกสารที่อนุมัติแล้วเข้าโปรแกรมบัญชีโดยอัตโนมัติ
            </p>
          </div>
          <IntegrationsClient
            orgId={orgId}
            orgSlug={org?.slug ?? ""}
            integrations={integrations ?? []}
            lineConnections={lineConn ?? []}
            userRole={role}
          />
        </section>

      </div>

      {/* ── Right sidebar: static LINE preview (sticky, never affects left) ── */}
      <div className="hidden xl:block w-[260px] shrink-0">
        <div className="sticky top-[80px]">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            ตัวอย่างการใช้งาน
          </p>
          <StaticLineChatPreview />
        </div>
      </div>

    </div>
  )
}
