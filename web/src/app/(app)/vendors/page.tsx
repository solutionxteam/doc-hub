import { VendorsClient } from "@/components/vendors/vendors-client"
import { getMembership }  from "@/lib/get-membership"

export default async function VendorsPage() {
  await getMembership() // auth guard
  return <VendorsClient />
}
