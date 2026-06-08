/**
 * /split/join/[token] — Web page for non-LINE users to join a split bill
 */
import { createAdminClient } from "@/lib/supabase/admin"
import { SplitJoinClient }   from "@/components/split/split-join-client"
import { notFound }          from "next/navigation"

export default async function SplitJoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: bill } = await admin
    .from("split_bills")
    .select(`
      id, title, total_amount, vat_amount, status, document_id,
      split_participants(id, name, line_user_id, amount)
    `)
    .eq("share_token", token)
    .single()

  if (!bill) notFound()

  const { data: lineItems } = await admin
    .from("document_line_items")
    .select("id, description, amount")
    .eq("document_id", bill.document_id ?? "")
    .order("sort_order")

  const { data: claims } = await admin
    .from("split_item_claims")
    .select("line_item_id, claimer_name, claimer_line_id, participant_id")
    .eq("split_bill_id", bill.id)

  return (
    <SplitJoinClient
      bill={{ ...bill, participants: (bill as any).split_participants ?? [] }}
      lineItems={lineItems ?? []}
      claims={claims ?? []}
      token={token}
    />
  )
}
