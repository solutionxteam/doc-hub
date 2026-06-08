import { getMembership }  from "@/lib/get-membership"
import { BudgetClient }   from "@/components/budget/budget-client"

export default async function BudgetPage() {
  const { organization_id: orgId } = await getMembership()
  const month = new Date().toISOString().slice(0, 7)

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000"}/api/budget?orgId=${orgId}&month=${month}`,
    { cache: "no-store" }
  ).catch(() => null)

  const data = res?.ok ? await res.json() : { budget: { total: 0, categories: {} }, spent: { total: 0, byCategory: {} }, month }

  return <BudgetClient orgId={orgId} initialData={data} />
}
