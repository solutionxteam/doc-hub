/**
 * Name search for the trip map's search bar — "type a name, get suggestions
 * with photos", the one thing the existing places endpoints don't cover:
 *   • /api/places is Nearby Search (category/radius), not name search.
 *   • /api/trips/geocode is name search, but via free Nominatim — no photos,
 *     no ratings, so a place found there would need a second lookup anyway.
 *
 * Same Google key, same place_cache table, same upsert pattern as
 * /api/places — see that file's Step 3 for the sibling implementation this
 * one is deliberately kept parallel to.
 */
import type { NextRequest } from "next/server"

const GOOGLE_TEXT_SEARCH = "https://maps.googleapis.com/maps/api/place/textsearch/json"
const GOOGLE_KEY = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""

const PLACE_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  restaurant:         { label: "ร้านอาหาร",   emoji: "🍽️" },
  cafe:               { label: "คาเฟ่",        emoji: "☕" },
  lodging:            { label: "โรงแรม",       emoji: "🏨" },
  shopping_mall:      { label: "ห้างฯ",        emoji: "🛍️" },
  tourist_attraction: { label: "ท่องเที่ยว",   emoji: "🏛️" },
  spa:                { label: "สปา",          emoji: "💆" },
  establishment:      { label: "ทั่วไป",       emoji: "📍" },
}

export interface GoogleTextSearchResult {
  place_id: string
  name: string
  formatted_address?: string
  geometry: { location: { lat: number; lng: number } }
  rating?: number
  user_ratings_total?: number
  photos?: { photo_reference: string }[]
  price_level?: number
  opening_hours?: { open_now?: boolean }
  types?: string[]
}

export interface SearchResult {
  id: string
  name: string
  type: string
  address: string | null
  lat: number
  lng: number
  rating: number | null
  user_ratings: number | null
  photo_url: string | null
  price_level: number | null
  is_open: boolean | null
  maps_url: string
  label: string
  emoji: string
}

/** Pure — reshapes one Google Text Search result. No network, no DB, unit-testable. */
export function toSearchResult(raw: GoogleTextSearchResult, googleKey: string): SearchResult {
  const type = raw.types?.[0] ?? "establishment"
  const photo = raw.photos?.[0]
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${raw.photos[0].photo_reference}&key=${googleKey}`
    : null
  return {
    id: raw.place_id,
    name: raw.name,
    type,
    address: raw.formatted_address ?? null,
    lat: raw.geometry.location.lat,
    lng: raw.geometry.location.lng,
    rating: raw.rating ?? null,
    user_ratings: raw.user_ratings_total ?? null,
    photo_url: photo,
    price_level: raw.price_level ?? null,
    is_open: raw.opening_hours?.open_now ?? null,
    maps_url: `https://www.google.com/maps/place/?q=place_id:${raw.place_id}`,
    label: PLACE_TYPE_LABELS[type]?.label ?? type,
    emoji: PLACE_TYPE_LABELS[type]?.emoji ?? "📍",
  }
}

export async function GET(req: NextRequest) {
  const { NextResponse } = await import("next/server")
  const q   = req.nextUrl.searchParams.get("q")?.trim()
  const lat = req.nextUrl.searchParams.get("lat")
  const lng = req.nextUrl.searchParams.get("lng")

  if (!q || q.length < 2) {
    return NextResponse.json({ error: "q (min 2 chars) required", results: [] }, { status: 400 })
  }
  if (!GOOGLE_KEY()) {
    return NextResponse.json({ results: [], has_google_key: false })
  }

  const url = new URL(GOOGLE_TEXT_SEARCH)
  url.searchParams.set("query", q)
  url.searchParams.set("language", "th")
  url.searchParams.set("key", GOOGLE_KEY())
  if (lat && lng) {
    // Bias, not restrict — a 50km radius nudges results toward the trip's
    // area without hiding a place the user is deliberately searching for
    // outside it (e.g. planning tomorrow's city while still in today's).
    url.searchParams.set("location", `${lat},${lng}`)
    url.searchParams.set("radius", "50000")
  }

  const { createAdminClient } = await import("@/lib/supabase/admin")
  const admin = createAdminClient()
  try {
    const gRes = await fetch(url.toString())
    const gData = await gRes.json() as { results: GoogleTextSearchResult[]; status: string }

    if (gData.status !== "OK" && gData.status !== "ZERO_RESULTS") {
      console.error("[places/search] Google API status:", gData.status)
      return NextResponse.json({ error: `Google: ${gData.status}`, results: [] }, { status: 502 })
    }

    const results = (gData.results ?? []).map(r => toSearchResult(r, GOOGLE_KEY()))

    // Cache every result (fire-and-forget, same posture as /api/places).
    for (const r of results) {
      try {
        await admin.from("place_cache").upsert({
          google_place_id: r.id, name: r.name, place_type: r.type,
          address: r.address, latitude: r.lat, longitude: r.lng,
          rating: r.rating, user_ratings_total: r.user_ratings,
          photo_url: r.photo_url, price_level: r.price_level,
          cached_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        }, { onConflict: "google_place_id" })
      } catch { /* non-critical */ }
    }

    return NextResponse.json({ results, has_google_key: true })
  } catch (err: any) {
    console.error("[places/search] error:", err.message)
    return NextResponse.json({ error: err.message, results: [] }, { status: 502 })
  }
}
