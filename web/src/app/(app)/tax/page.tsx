import { getMembership } from "@/lib/get-membership"
import { TaxPageClient } from "@/components/tax/tax-page-client"

export default async function TaxPage() {
  const { organization_id: orgId } = await getMembership()
  return <TaxPageClient orgId={orgId} />
}
