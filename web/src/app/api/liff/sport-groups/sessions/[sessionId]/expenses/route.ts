import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rebalance } from "../../../_lib"
import { loadDetail } from "../route"

async function recomputeTotal(admin: ReturnType<typeof createAdminClient>, sessionId: string) {
  const { data: expenses } = await admin.from("session_expenses")
    .select("amount").eq("split_bill_id", sessionId)
  const total = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  await admin.from("split_bills").update({ total_amount: total }).eq("id", sessionId)
  await rebalance(admin, sessionId, total)
  return total
}

// GET /api/liff/sport-groups/sessions/[sessionId]/expenses
export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const admin = createAdminClient()

  const { data: expenses } = await admin.from("session_expenses")
    .select("id, category, label, amount, created_at")
    .eq("split_bill_id", sessionId)
    .order("created_at", { ascending: true })

  const total = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  return NextResponse.json({ expenses: expenses ?? [], total })
}

// POST /api/liff/sport-groups/sessions/[sessionId]/expenses
// — { lineUserId, category, label?, amount } -> adds an expense line item,
//   recomputes split_bills.total_amount and rebalances participants
export async function POST(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const { lineUserId, category, label, amount } = await req.json() as {
    lineUserId: string
    category: string
    label?: string
    amount: number
  }
  if (!lineUserId || !category || !amount || amount <= 0) {
    return NextResponse.json({ error: "lineUserId, category, amount required" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: bill } = await admin.from("split_bills")
    .select("id").eq("id", sessionId).eq("category", "sport").maybeSingle()
  if (!bill) return NextResponse.json({ error: "ไม่พบกลุ่ม" }, { status: 404 })

  const { error } = await admin.from("session_expenses").insert({
    split_bill_id: sessionId, category, label: label || null, amount,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recomputeTotal(admin, sessionId)

  const detail = await loadDetail(admin, sessionId, lineUserId)
  return NextResponse.json({ ok: true, expenses: detail?.expenses, total: detail?.expensesTotal, group: detail })
}

// DELETE /api/liff/sport-groups/sessions/[sessionId]/expenses?id=<expenseId>&lineUserId=Uxxx
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const expenseId  = req.nextUrl.searchParams.get("id")
  const lineUserId = req.nextUrl.searchParams.get("lineUserId")
  if (!expenseId || !lineUserId) return NextResponse.json({ error: "id and lineUserId required" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("session_expenses")
    .delete().eq("id", expenseId).eq("split_bill_id", sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await recomputeTotal(admin, sessionId)

  const detail = await loadDetail(admin, sessionId, lineUserId)
  return NextResponse.json({ ok: true, expenses: detail?.expenses, total: detail?.expensesTotal, group: detail })
}
