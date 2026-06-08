import { NextRequest, NextResponse } from "next/server"
import { createClient }       from "@/lib/supabase/server"
import { createAdminClient }  from "@/lib/supabase/admin"

type Params = { params: Promise<{ id: string }> }

// POST — add expense to a trip + auto-compute splits
export async function POST(req: NextRequest, { params }: Params) {
  const { id: tripId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    paid_by_id:   string
    title:        string
    amount:       number
    category?:    string
    split_mode?:  "equal" | "individual" | "exclude"
    split_with?:  string[]    // participant IDs (empty = everyone)
    document_id?: string      // linked receipt
    note?:        string
    expense_date?: string
  }

  const admin = createAdminClient()

  // Get trip + participants
  const { data: trip } = await admin.from("life_journeys")
    .select("split_mode").eq("id", tripId).single()

  const { data: participants } = await admin.from("trip_participants")
    .select("id, display_name").eq("journey_id", tripId)

  if (!participants?.length) return NextResponse.json({ error: "No participants" }, { status: 400 })

  const splitMode = body.split_mode ?? trip?.split_mode ?? "equal"
  const splitWith = body.split_with?.length ? body.split_with : participants.map(p => p.id)
  const splitAmount = Number(body.amount) / splitWith.length

  // Create expense
  const { data: expense, error } = await admin.from("trip_expenses").insert({
    journey_id:   tripId,
    document_id:  body.document_id ?? null,
    paid_by_id:   body.paid_by_id,
    title:        body.title,
    amount:       body.amount,
    category:     body.category ?? "other",
    split_mode:   splitMode,
    split_with:   splitWith,
    note:         body.note ?? null,
    expense_date: body.expense_date ?? new Date().toISOString().slice(0, 10),
  }).select("id").single()

  if (error || !expense) return NextResponse.json({ error: error?.message }, { status: 500 })

  // Create splits
  await admin.from("expense_splits").insert(
    splitWith.map(pid => ({
      expense_id:     expense.id,
      participant_id: pid,
      amount:         splitAmount,
      is_paid:        pid === body.paid_by_id,  // payer has already "paid"
    }))
  )

  // Update amount_owed for each participant
  for (const pid of splitWith) {
    if (pid !== body.paid_by_id) {
      await admin.from("trip_participants")
        .update({ amount_owed: admin.rpc("now") as any })  // will recalculate
        .eq("id", pid)
    }
  }

  // Recalculate amount_owed for all participants in this trip
  await recalculateOwed(tripId, admin)

  return NextResponse.json({ expenseId: expense.id })
}

// GET — list expenses for a trip
export async function GET(req: NextRequest, { params }: Params) {
  const { id: tripId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: expenses } = await supabase.from("trip_expenses")
    .select(`
      id, title, amount, category, split_mode, note, expense_date, created_at,
      documents(vendor_name, total_amount, doc_date),
      trip_participants!trip_expenses_paid_by_id_fkey(id, display_name),
      expense_splits(id, participant_id, amount, is_paid)
    `)
    .eq("journey_id", tripId)
    .order("expense_date")

  return NextResponse.json({ expenses: expenses ?? [] })
}

async function recalculateOwed(tripId: string, admin: ReturnType<typeof createAdminClient>) {
  const { data: splits } = await admin.from("expense_splits")
    .select("participant_id, amount, is_paid, trip_expenses!inner(journey_id, paid_by_id)")
    .eq("trip_expenses.journey_id", tripId)

  if (!splits) return

  // Sum owed per participant
  const owed: Record<string, number> = {}
  const paid: Record<string, number> = {}
  for (const s of splits) {
    const pid = s.participant_id
    if (!owed[pid]) owed[pid] = 0
    if (!paid[pid]) paid[pid] = 0
    owed[pid] += Number(s.amount)
    if (s.is_paid) paid[pid] += Number(s.amount)
  }

  for (const [pid, amt] of Object.entries(owed)) {
    await admin.from("trip_participants").update({
      amount_owed: amt,
      amount_paid: paid[pid] ?? 0,
    }).eq("id", pid)
  }
}
