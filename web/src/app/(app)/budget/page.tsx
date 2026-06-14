import { getMembership }  from "@/lib/get-membership"
import { createClient }   from "@/lib/supabase/server"
import { BudgetClient }   from "@/components/budget/budget-client"

export default async function BudgetPage() {
  const { organization_id: orgId } = await getMembership()
  const month = new Date().toISOString().slice(0, 7)
  const supabase = await createClient()

  const { data: org } = await supabase
    .from("organizations")
    .select("metadata")
    .eq("id", orgId)
    .single()

  const meta    = (org?.metadata as any) ?? {}
  const budgets = meta?.budgets ?? {}
  const monthBudget = budgets[month] ?? { total: 0, categories: {} }

  const start = `${month}-01`
  const end   = `${month}-31`
  const { data: spending } = await supabase
    .from("documents")
    .select("doc_category, total_amount, vat_amount")
    .eq("organization_id", orgId)
    .in("status", ["approved", "pushed"])
    .gte("doc_date", start)
    .lte("doc_date", end)

  const byCategory: Record<string, number> = {}
  let totalSpent = 0
  for (const doc of spending ?? []) {
    const cat = doc.doc_category ?? "other"
    byCategory[cat] = (byCategory[cat] ?? 0) + Number(doc.total_amount ?? 0)
    totalSpent      += Number(doc.total_amount ?? 0)
  }

  const data = {
    budget: monthBudget,
    spent:  { total: totalSpent, byCategory },
    month,
  }

  return <BudgetClient orgId={orgId} initialData={data} />
}
