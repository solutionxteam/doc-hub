/**
 * Edit or remove a single medication — the two capabilities /api/medications
 * never had (its GET only lists, POST only creates, and PATCH updates a dose
 * LOG's status, not the medication itself). The actual logic lives in
 * lib/medications.ts, which takes an injectable db so it can be unit tested
 * (medications.test.mjs) without a live Supabase project — this route is
 * just the auth + HTTP wiring around it.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient }      from "@/lib/supabase/server"
import { updateMedication, deactivateMedication, type MedicationPatch } from "@/lib/medications"

type Params = { params: Promise<{ id: string }> }

async function authedUser(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// PATCH — edit the medication's own fields, and its primary schedule/
// inventory rows by id (never re-inserted, so medication_logs.schedule_id
// keeps pointing at the same row). See lib/medications.ts.
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await authedUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as MedicationPatch
  try {
    await updateMedication(id, user.id, body)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// DELETE — soft-delete (is_active = false). Matches
// /api/liff/medications/[id]'s DELETE exactly — never a hard `.delete()`.
// See lib/medications.ts's file header for why.
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await authedUser(req)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await deactivateMedication(id, user.id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
