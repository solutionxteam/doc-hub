import { getTranslations } from "next-intl/server"
import { getMembership }   from "@/lib/get-membership"
import { createClient }    from "@/lib/supabase/server"
import { DocumentList }    from "@/components/documents/document-list"
import { DocumentUpload }  from "@/components/documents/document-upload"

export default async function DocumentsPage() {
  const t = await getTranslations("documents")
  const { organization_id: orgId, role } = await getMembership()
  const supabase = await createClient()

  const { data: documents } = await supabase
    .from("documents")
    .select(`
      id, vendor_name, total_amount, vat_amount, net_amount, status, doc_date, doc_type,
      overall_confidence, is_duplicate, source, created_at, invoice_number, category
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100)

  return (
    <div className="p-6 lg:p-7 space-y-5 max-w-[1600px] animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[20px] font-bold">{t("title")}</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">เอกสารทั้งหมดที่เข้ามาในระบบ</p>
        </div>
        {["owner", "admin", "accountant"].includes(role) && (
          <DocumentUpload orgId={orgId} />
        )}
      </div>

      <DocumentList documents={documents ?? []} />
    </div>
  )
}
