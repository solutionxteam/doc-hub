/**
 * Personal Tax Page — ภ.ง.ด.90 / ภ.ง.ด.91
 * ภาษีเงินได้บุคคลธรรมดา (Personal Income Tax)
 *
 * แตกต่างจาก /tax (org) ที่เป็น VAT (ภ.พ.30) + WHT สำหรับนิติบุคคล
 * หน้านี้ช่วยประมาณภาษีเงินได้ส่วนบุคคลและ export สรุปค่าใช้จ่ายที่ลดหย่อนได้
 */
import { createClient }  from "@/lib/supabase/server"
import { getMembership } from "@/lib/get-membership"
import { PersonalTaxClient } from "@/components/tax/personal-tax-client"
import { redirect }      from "next/navigation"

export const metadata = { title: "ภาษีส่วนบุคคล · Slippy" }

export default async function PersonalTaxPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { organization_id: orgId } = await getMembership()

  // Fetch current year's personal documents (source = personal or receipts tagged personal)
  const year = new Date().getFullYear()
  const { data: docs } = await supabase
    .from("documents")
    .select("id, vendor_name, total_amount, vat_amount, doc_date, category, status")
    .eq("organization_id", orgId)
    .gte("doc_date", `${year}-01-01`)
    .lte("doc_date", `${year}-12-31`)
    .not("status", "in", "(failed,rejected,pending,processing)")
    .order("doc_date", { ascending: false })

  return (
    <PersonalTaxClient
      userId={user.id}
      year={year}
      docs={docs ?? []}
    />
  )
}
