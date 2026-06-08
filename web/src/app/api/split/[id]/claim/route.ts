import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lineItemId, claimerName, isNonLine } = await req.json()
  const admin = createAdminClient()

  // Ensure participant exists for non-LINE user
  let participantId: string | undefined
  if (isNonLine) {
    const { data: existing } = await admin.from("split_participants")
      .select("id").eq("split_bill_id", id).eq("name", claimerName).maybeSingle()
    if (existing) {
      participantId = existing.id
    } else {
      const { data: newP } = await admin.from("split_participants")
        .insert({ split_bill_id: id, name: claimerName, is_non_line: true, amount: 0 })
        .select("id").single()
      participantId = newP?.id
    }
  }

  const { error } = await admin.from("split_item_claims").upsert({
    split_bill_id:  id,
    line_item_id:   lineItemId,
    participant_id: participantId,
    claimer_name:   claimerName,
  }, { onConflict: "split_bill_id,line_item_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { lineItemId, claimerName } = await req.json()
  const admin = createAdminClient()
  await admin.from("split_item_claims")
    .delete().eq("split_bill_id", id).eq("line_item_id", lineItemId).eq("claimer_name", claimerName)
  return NextResponse.json({ ok: true })
}
