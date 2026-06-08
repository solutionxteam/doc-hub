import { getMembership } from "@/lib/get-membership"
import { LifeClient }    from "@/components/life/life-client"

export default async function LifePage() {
  const { organization_id: orgId } = await getMembership()
  return <LifeClient orgId={orgId} />
}
