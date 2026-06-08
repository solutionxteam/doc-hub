import { NextRequest, NextResponse } from "next/server"
import { createClient }       from "@/lib/supabase/server"
import { createAdminClient }  from "@/lib/supabase/admin"

const GOOGLE_NEARBY = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
const GOOGLE_KEY    = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""

// Place types: restaurant|pharmacy|hotel|tourist_attraction|cafe|hospital|shopping_mall|all
const PLACE_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  restaurant:           { label: "ร้านอาหาร",       emoji: "🍽️" },
  pharmacy:             { label: "ร้านยา",           emoji: "💊" },
  lodging:              { label: "โรงแรม",           emoji: "🏨" },
  tourist_attraction:   { label: "ท่องเที่ยว",       emoji: "🏛️" },
  cafe:                 { label: "คาเฟ่",            emoji: "☕" },
  hospital:             { label: "โรงพยาบาล",       emoji: "🏥" },
  shopping_mall:        { label: "ห้างฯ",            emoji: "🛍️" },
  convenience_store:    { label: "ร้านสะดวกซื้อ",   emoji: "🏪" },
  establishment:        { label: "ทั่วไป",           emoji: "📍" },
}

function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000 // meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

export async function GET(req: NextRequest) {
  const lat     = Number(req.nextUrl.searchParams.get("lat"))
  const lng     = Number(req.nextUrl.searchParams.get("lng"))
  const type    = req.nextUrl.searchParams.get("type") ?? "restaurant"
  const radius  = Number(req.nextUrl.searchParams.get("radius") ?? "1000")  // meters
  const orgId   = req.nextUrl.searchParams.get("orgId")

  if (!lat || !lng) return NextResponse.json({ error: "lat and lng required" }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const results: any[] = []
  const THRESHOLD = 3  // call Google if internal results < 3

  // ── Step 1: Internal search ─────────────────────────────────────────────────
  if (orgId) {
    const googleType = type === "all" ? null : type
    const { data: internal } = await admin.rpc("find_nearby_merchants", {
      p_org_id:    orgId,
      p_lat:       lat,
      p_lng:       lng,
      p_radius_km: radius / 1000,
      p_type:      googleType,
      p_limit:     10,
    })

    for (const m of (internal ?? [])) {
      results.push({
        id:          m.id,
        source:      "internal",
        name:        m.name,
        type:        m.place_type ?? type,
        address:     m.address,
        lat:         m.latitude,
        lng:         m.longitude,
        distance_m:  Math.round(m.distance_km * 1000),
        rating:      m.rating,
        user_ratings: null,
        photo_url:   m.photo_url,
        price_level: null,
        visit_count: m.visit_count,
        total_spent: m.total_spent,
        is_open:     null,
        maps_url:    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.name)}`,
        label:       PLACE_TYPE_LABELS[m.place_type ?? type]?.label ?? type,
        emoji:       PLACE_TYPE_LABELS[m.place_type ?? type]?.emoji ?? "📍",
      })
    }
  }

  // ── Step 2: Place cache ─────────────────────────────────────────────────────
  const cachedIds = new Set(results.map(r => r.id))
  const googleType = type === "all" ? null : type
  const { data: cached } = await admin.rpc("find_nearby_cached", {
    p_lat: lat, p_lng: lng, p_radius_km: radius / 1000,
    p_type: googleType, p_limit: 10,
  })
  for (const c of (cached ?? [])) {
    if (cachedIds.has(c.google_place_id)) continue
    results.push({
      id:          c.google_place_id,
      source:      "cache",
      name:        c.name,
      type:        c.place_type,
      address:     c.address,
      lat:         c.latitude,
      lng:         c.longitude,
      distance_m:  Math.round(c.distance_km * 1000),
      rating:      c.rating,
      user_ratings: c.user_ratings_total,
      photo_url:   c.photo_url,
      price_level: c.price_level,
      maps_url:    `https://www.google.com/maps/place/?q=place_id:${c.google_place_id}`,
      label:       PLACE_TYPE_LABELS[c.place_type]?.label ?? c.place_type,
      emoji:       PLACE_TYPE_LABELS[c.place_type]?.emoji ?? "📍",
    })
  }

  // ── Step 3: Google Maps API (if insufficient results) ──────────────────────
  let googleFetched = false
  if (results.length < THRESHOLD && GOOGLE_KEY()) {
    googleFetched = true
    const gType = type === "all" ? "establishment" : type
    const url = new URL(GOOGLE_NEARBY)
    url.searchParams.set("location", `${lat},${lng}`)
    url.searchParams.set("radius",   String(radius))
    url.searchParams.set("type",     gType)
    url.searchParams.set("language", "th")
    url.searchParams.set("key",      GOOGLE_KEY())

    try {
      const gRes  = await fetch(url.toString())
      const gData = await gRes.json() as { results: any[]; status: string }

      for (const g of (gData.results ?? [])) {
        if (results.some(r => r.id === g.place_id)) continue

        const gLat = g.geometry.location.lat
        const gLng = g.geometry.location.lng
        const dist = haversineDist(lat, lng, gLat, gLng)
        const photo = g.photos?.[0]
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${g.photos[0].photo_reference}&key=${GOOGLE_KEY()}`
          : null
        const placeType = g.types?.[0] ?? gType

        results.push({
          id:          g.place_id,
          source:      "google",
          name:        g.name,
          type:        placeType,
          address:     g.vicinity,
          lat:         gLat,
          lng:         gLng,
          distance_m:  Math.round(dist),
          rating:      g.rating ?? null,
          user_ratings: g.user_ratings_total ?? null,
          photo_url:   photo,
          price_level: g.price_level ?? null,
          is_open:     g.opening_hours?.open_now ?? null,
          maps_url:    `https://www.google.com/maps/place/?q=place_id:${g.place_id}`,
          label:       PLACE_TYPE_LABELS[placeType]?.label ?? placeType,
          emoji:       PLACE_TYPE_LABELS[placeType]?.emoji ?? "📍",
        })

        // Cache Google result
        // Cache result (fire-and-forget)
        try {
          await admin.from("place_cache").upsert({
            google_place_id: g.place_id, name: g.name, place_type: placeType,
            address: g.vicinity, latitude: gLat, longitude: gLng,
            rating: g.rating ?? null, user_ratings_total: g.user_ratings_total ?? null,
            photo_url: photo, price_level: g.price_level ?? null,
            cached_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          }, { onConflict: "google_place_id" })
        } catch { /* non-critical */ }
      }
    } catch (err: any) {
      console.error("[places] Google API error:", err.message)
    }
  }

  // ── Step 4: Pharmacy — low medication alert ─────────────────────────────────
  let lowMedications: string[] = []
  if ((type === "pharmacy" || type === "all") && user) {
    const { data: lowMeds } = await admin.from("medication_inventory")
      .select("qty_remaining, low_stock_alert, medications!inner(name)")
      .eq("user_id", user.id)
    lowMedications = (lowMeds ?? [])
      .filter((m: any) => Number(m.qty_remaining) <= Number(m.low_stock_alert))
      .map((m: any) => (m.medications as any)?.name ?? "ยา")
  }

  results.sort((a, b) => a.distance_m - b.distance_m)

  return NextResponse.json({
    results: results.slice(0, 20),
    total:   results.length,
    source:  googleFetched ? "google+internal" : "internal",
    low_medications: lowMedications,
    has_google_key:  !!GOOGLE_KEY(),
  })
}
