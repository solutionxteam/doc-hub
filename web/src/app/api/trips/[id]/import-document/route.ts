/**
 * Import a travel document into a trip.
 *
 * Two steps, deliberately separate:
 *   POST (multipart, no `accept`) → reads the file, returns PROPOSED entries
 *   POST (JSON with `accept`)     → writes the entries the user confirmed
 *
 * The read step never writes. A machine-read departure time that nobody checked
 * against the paper is exactly the failure this codebase keeps producing, and
 * an itinerary is not a place to repeat it.
 *
 * The reading itself happens in the api service (pipeline/travel-doc.ts) because
 * that is where PDF rasterising and the vision plumbing already live.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthedUser } from "@/lib/authed-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTripAccess } from "@/lib/trips/trip-access"
import { internalApiError } from "@/lib/trips/internal-api"

type Params = { params: Promise<{ id: string }> }

const MAX_BYTES = 12 * 1024 * 1024
const INTERNAL_URL = process.env.INTERNAL_API_URL ?? "http://localhost:4000"

interface ProposedItem {
  type: string
  title: string
  subtitle: string | null
  date: string | null
  time_from: string | null
  time_to: string | null
  location: string | null
  end_location: string | null
  provider: string | null
  confirmation_code: string | null
  amount: number | null
  currency: string | null
  details: Record<string, unknown>
  notes: string | null
  confidence: number
}

async function guard(tripId: string, req: NextRequest) {
  // Cookie or Bearer — the iOS app sends the latter. See lib/authed-user.ts.
  const user = await getAuthedUser(req)
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) }
  const access = await getTripAccess(tripId, user.id)
  if (!access.allowed) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) }
  return { admin: createAdminClient() }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id: tripId } = await params
  const g = await guard(tripId, req)
  if (g.error) return g.error
  const { admin } = g

  const contentType = req.headers.get("content-type") ?? ""

  // ── Step 2: write the entries the user accepted ──────────────────────────
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null) as
      { accept?: ProposedItem[] } | null
    const accepted = body?.accept
    if (!Array.isArray(accepted) || !accepted.length) {
      return NextResponse.json({ error: "ไม่มีรายการที่จะเพิ่ม" }, { status: 400 })
    }

    const { data: journey } = await admin.from("life_journeys")
      .select("base_currency").eq("id", tripId).single()
    const baseCurrency = journey?.base_currency ?? "THB"

    const { data: existingDays } = await admin.from("trip_itinerary_days")
      .select("id, day_number, date").eq("journey_id", tripId).order("day_number")
    const days = existingDays ?? []
    let nextDayNumber = days.reduce((max, d) => Math.max(max, d.day_number), 0) + 1

    const created: unknown[] = []
    const skipped: string[] = []

    for (const item of accepted) {
      // File each entry on the day whose DATE matches. A document's own date is
      // the only correct answer here; putting an unmatched entry on day 1 would
      // quietly move a flight by a week.
      if (!item.date) {
        skipped.push(`${item.title} — เอกสารไม่ได้ระบุวันที่`)
        continue
      }
      let day = days.find(d => d.date === item.date)
      if (!day) {
        // No existing day has this date — most often because the trip is brand
        // new and has no days at all yet. Rather than reject the import (the
        // one thing that would actually put this document's data in the
        // database), create the day the document itself says this belongs on.
        // Appended after whatever days already exist, never renumbering them —
        // an import should not reorder days a person already arranged, even if
        // that leaves day numbers slightly out of date order.
        const { data: newDay, error: dayError } = await admin.from("trip_itinerary_days")
          .insert({ journey_id: tripId, day_number: nextDayNumber++, date: item.date })
          .select("id, day_number, date").single()
        if (dayError || !newDay) {
          skipped.push(`${item.title} — สร้างวันที่ ${item.date} ไม่สำเร็จ`)
          continue
        }
        days.push(newDay)
        day = newDay
      }

      const { data: last } = await admin.from("trip_itinerary_items")
        .select("sort_order").eq("day_id", day.id)
        .order("sort_order", { ascending: false }).limit(1)

      // Currency is stored as printed. No conversion happens here: the rate is
      // a decision (which day? which card?) and guessing it would put a wrong
      // number into the column trip totals are summed from.
      const amount = typeof item.amount === "number" ? item.amount : 0
      const currency = item.currency ?? baseCurrency
      const sameCurrency = currency === baseCurrency

      const { data: row, error } = await admin.from("trip_itinerary_items").insert({
        day_id: day.id,
        sort_order: (last?.[0]?.sort_order ?? -1) + 1,
        type: item.type,
        title: item.title,
        subtitle: item.subtitle,
        location: item.location,
        end_location: item.end_location,
        time_from: item.time_from,
        time_to: item.time_to,
        provider: item.provider,
        confirmation_code: item.confirmation_code,
        // A document that names a booking reference is a booking.
        status: item.confirmation_code ? "confirmed" : "planned",
        amount,
        currency,
        exchange_rate: sameCurrency ? 1 : 0,
        // 0 when the currency differs — a total that silently included an
        // unconverted foreign amount would be wrong in a way nothing flags.
        // The item shows its printed amount and asks for a rate.
        amount_base_currency: sameCurrency ? amount : 0,
        details: item.details ?? {},
        notes: [
          item.notes,
          !sameCurrency && amount > 0
            ? `ยอด ${amount} ${currency} ยังไม่ได้แปลงเป็น ${baseCurrency} — ใส่อัตราแลกเปลี่ยนเพื่อให้รวมในยอดทริป`
            : null,
          "นำเข้าจากเอกสาร — ควรตรวจกับตัวจริงอีกครั้ง",
        ].filter(Boolean).join("\n"),
      }).select("id, title, day_id").single()

      if (error) skipped.push(`${item.title} — ${error.message}`)
      else created.push(row)
    }

    return NextResponse.json({ created: created.length, items: created, skipped })
  }

  // ── Step 1: read the file ────────────────────────────────────────────────
  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "แนบไฟล์ด้วย" }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `ไฟล์ใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(1)} MB) — จำกัดที่ 12 MB` },
      { status: 413 })
  }

  const key = process.env.INTERNAL_API_KEY
  if (!key) {
    return NextResponse.json({ error: "ระบบอ่านเอกสารยังไม่ได้ตั้งค่า" }, { status: 503 })
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const res = await fetch(`${INTERNAL_URL}/travel-doc/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-key": key },
      body: JSON.stringify({
        fileBase64: bytes.toString("base64"),
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
      }),
      // Vision on a multi-page PDF is not fast; the default fetch timeout would
      // cut it off mid-read and report a network error for a working service.
      signal: AbortSignal.timeout(120_000),
    })
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ error: json.error ?? "อ่านเอกสารไม่สำเร็จ" }, { status: res.status })

    // Tell the client which proposals can actually be filed, so the review
    // screen can say so before the user accepts rather than after.
    const { data: days } = await admin.from("trip_itinerary_days")
      .select("day_number, date, city").eq("journey_id", tripId).order("day_number")
    return NextResponse.json({ ...json, tripDays: days ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: internalApiError(err, "อ่านเอกสาร", INTERNAL_URL) }, { status: 502 })
  }
}
