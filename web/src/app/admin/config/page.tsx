/**
 * Admin System Config — /admin/config
 * Superadmin-only: adjust global settings without code deployment
 */
import { createAdminClient }    from "@/lib/supabase/admin"
import { AdminConfigClient }    from "@/components/admin/admin-config-client"

export const dynamic = "force-dynamic"

export default async function AdminConfigPage() {
  const admin = createAdminClient()
  const { data: configs, error } = await admin
    .from("system_config")
    .select("*")
    .order("key")

  if (error) {
    return (
      <div className="rounded-lg bg-red-950/40 border border-red-800 p-6 text-red-300">
        <p className="font-semibold">ดึง config ไม่ได้</p>
        <p className="text-sm mt-1 font-mono">{error.message}</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">System Configuration</h1>
        <p className="mt-1 text-sm text-zinc-400">
          ปรับค่า global settings โดยไม่ต้อง deploy ใหม่ ·{" "}
          <span className="text-amber-400">การเปลี่ยนแปลงมีผลทันทีสำหรับ request ใหม่</span>
        </p>
      </div>
      <AdminConfigClient configs={configs ?? []} />
    </div>
  )
}
