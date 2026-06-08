/**
 * location-search.ts — Location-Based Place Suggestions
 *
 * Strategy (Internal First):
 *   1. Search life_merchants (receipts already in system) → "เคยไป"
 *   2. Search place_cache (previously fetched Google results)
 *   3. If results < threshold → call Google Maps Nearby Search
 *   4. Cache Google results for 7 days (reduce API costs)
 *
 * Place Types: restaurant | pharmacy | hotel | tourist_attraction |
 *              cafe | hospital | shopping_mall | convenience_store
 *
 * Pharmacy Special: connects with medication_inventory for low-stock alerts
 */

import { createClient } from "../lib/supabase"

const GOOGLE_MAPS_KEY = () => process.env.GOOGLE_MAPS_API_KEY ?? ""
const GOOGLE_NEARBY   = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
const GOOGLE_GEOCODE  = "https://maps.googleapis.com/maps/api/geocode/json"
const GOOGLE_DETAILS  = "https://maps.googleapis.com/maps/api/place/details/json"

// ─── Place types mapping ────────────────────────────────────────────────────
export const PLACE_TYPES = {
  restaurant:    { label: "ร้านอาหาร",      emoji: "🍽️", google: "restaurant" },
  pharmacy:      { label: "ร้านยา",          emoji: "💊", google: "pharmacy" },
  hotel:         { label: "โรงแรม",          emoji: "🏨", google: "lodging" },
  tourist:       { label: "ท่องเที่ยว",      emoji: "🏛️", google: "tourist_attraction" },
  cafe:          { label: "คาเฟ่",           emoji: "☕", google: "cafe" },
  hospital:      { label: "โรงพยาบาล",      emoji: "🏥", google: "hospital" },
  shopping:      { label: "ห้างสรรพสินค้า",  emoji: "🛍️", google: "shopping_mall" },
  convenience:   { label: "ร้านสะดวกซื้อ",  emoji: "🏪", google: "convenience_store" },
  all:           { label: "ทั้งหมด",         emoji: "📍", google: "" },
} as const

export type PlaceTypeKey = keyof typeof PLACE_TYPES

// ─── Result shape ────────────────────────────────────────────────────────────
export interface PlaceResult {
  id:            string    // google_place_id or internal uuid
  name:          string
  place_type:    string
  address:       string | null
  latitude:      number
  longitude:     number
  distance_m:    number    // distance in meters
  rating:        number | null
  user_ratings:  number | null
  photo_url:     string | null
  price_level:   number | null
  phone:         string | null
  website:       string | null
  is_internal:   boolean   // true = from life_merchants (user has been there)
  visit_count?:  number    // if internal
  last_spent?:   number    // if internal
  is_open?:      boolean   // from opening_hours
  maps_url:      string    // Google Maps deep link
  // Pharmacy special
  low_med_alert?: string   // medication name that's running low
}

// ─── Main search function ────────────────────────────────────────────────────
export async function searchNearbyPlaces(params: {
  lat:         number
  lng:         number
  type:        PlaceTypeKey
  radiusKm:    number
  orgId:       string
  userId?:     string
  minResults?: number      // minimum results before calling Google (default: 3)
}): Promise<PlaceResult[]> {
  const { lat, lng, type, radiusKm, orgId, userId, minResults = 3 } = params
  const supabase = createClient()
  const results: PlaceResult[] = []

  // ── Step 1: Internal search (life_merchants) ──────────────────────────────
  const googleType = type === "all" ? null : PLACE_TYPES[type]?.google
  const { data: internal } = await supabase.rpc("find_nearby_merchants", {
    p_org_id:    orgId,
    p_lat:       lat,
    p_lng:       lng,
    p_radius_km: radiusKm,
    p_type:      googleType,
    p_limit:     10,
  })

  for (const m of (internal ?? [])) {
    results.push({
      id:          m.id,
      name:        m.name,
      place_type:  m.place_type ?? type,
      address:     m.address,
      latitude:    m.latitude,
      longitude:   m.longitude,
      distance_m:  Math.round(m.distance_km * 1000),
      rating:      m.rating,
      user_ratings: null,
      photo_url:   m.photo_url,
      price_level: null,
      phone:       null,
      website:     null,
      is_internal: true,
      visit_count: m.visit_count,
      last_spent:  m.total_spent,
      maps_url:    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.name)}&query_place_id=${m.google_place_id ?? ""}`,
    })
  }

  // ── Step 2: Check cache ────────────────────────────────────────────────────
  const cachedIds = new Set(results.map(r => r.id))
  const { data: cached } = await supabase.rpc("find_nearby_cached", {
    p_lat:       lat,
    p_lng:       lng,
    p_radius_km: radiusKm,
    p_type:      googleType,
    p_limit:     10,
  })

  for (const c of (cached ?? [])) {
    if (cachedIds.has(c.google_place_id)) continue
    results.push({
      id:          c.google_place_id,
      name:        c.name,
      place_type:  c.place_type ?? type,
      address:     c.address,
      latitude:    c.latitude,
      longitude:   c.longitude,
      distance_m:  Math.round(c.distance_km * 1000),
      rating:      c.rating,
      user_ratings: c.user_ratings_total,
      photo_url:   c.photo_url,
      price_level: c.price_level,
      phone:       null,
      website:     null,
      is_internal: false,
      maps_url:    `https://www.google.com/maps/place/?q=place_id:${c.google_place_id}`,
    })
  }

  // ── Step 3: Call Google if not enough results ─────────────────────────────
  if (results.length < minResults && GOOGLE_MAPS_KEY()) {
    const googleResults = await searchGoogleNearby({ lat, lng, type, radiusKm })

    for (const g of googleResults) {
      if (results.some(r => r.id === g.place_id)) continue
      const r = googleResultToPlace(g, lat, lng)
      results.push(r)
      // Cache the result
      await cachePlace(g, supabase).catch(() => {})
    }
  }

  // ── Step 4: Pharmacy special — check low medication stock ─────────────────
  if ((type === "pharmacy" || type === "all") && userId) {
    const pharmResults = results.filter(r => r.place_type === "pharmacy")
    if (pharmResults.length > 0) {
      const lowMeds = await getLowStockMedications(userId, supabase)
      if (lowMeds.length > 0) {
        for (const r of pharmResults) {
          r.low_med_alert = lowMeds[0]  // Closest pharmacy shows first low-stock med
        }
      }
    }
  }

  // Sort by distance
  results.sort((a, b) => a.distance_m - b.distance_m)

  // Log search
  if (userId) {
    supabase.from("location_searches").insert({
      user_id:         userId,
      organization_id: orgId,
      latitude:        lat,
      longitude:       lng,
      place_type:      type,
      result_count:    results.length,
      source:          results.some(r => !r.is_internal) ? "both" : "internal",
    })  // fire-and-forget
  }

  return results
}

// ─── Google Maps Nearby Search ───────────────────────────────────────────────
async function searchGoogleNearby(params: {
  lat: number; lng: number; type: PlaceTypeKey; radiusKm: number
}): Promise<any[]> {
  const { lat, lng, type, radiusKm } = params
  const googleType = type === "all" ? "establishment" : (PLACE_TYPES[type]?.google ?? "establishment")

  const url = new URL(GOOGLE_NEARBY)
  url.searchParams.set("location", `${lat},${lng}`)
  url.searchParams.set("radius",   String(radiusKm * 1000))
  url.searchParams.set("type",     googleType)
  url.searchParams.set("language", "th")
  url.searchParams.set("key",      GOOGLE_MAPS_KEY())

  const res  = await fetch(url.toString())
  const data = await res.json() as { results: any[]; status: string }

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    console.error("[places] Google API error:", data.status)
  }

  return data.results ?? []
}

// ─── Geocode an address → lat/lng ────────────────────────────────────────────
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_KEY()) return null
  const url = new URL(GOOGLE_GEOCODE)
  url.searchParams.set("address",  address)
  url.searchParams.set("language", "th")
  url.searchParams.set("region",   "TH")
  url.searchParams.set("key",      GOOGLE_MAPS_KEY())

  try {
    const res  = await fetch(url.toString())
    const data = await res.json() as { results: any[]; status: string }
    if (data.status !== "OK" || !data.results[0]) return null
    const loc = data.results[0].geometry.location
    return { lat: loc.lat, lng: loc.lng }
  } catch { return null }
}

// ─── Auto-geocode life_merchants that have address but no coordinates ─────────
export async function geocodeMissingMerchants(orgId: string, limit = 20): Promise<number> {
  if (!GOOGLE_MAPS_KEY()) {
    console.log("[places] No Google API key — skipping geocoding")
    return 0
  }
  const supabase = createClient()
  const { data: merchants } = await supabase.from("life_merchants")
    .select("id, name, address")
    .eq("organization_id", orgId)
    .not("address", "is", null)
    .is("latitude", null)
    .limit(limit)

  let count = 0
  for (const m of (merchants ?? [])) {
    const coords = await geocodeAddress(`${m.name} ${m.address}`)
    if (coords) {
      await supabase.from("life_merchants").update({
        latitude:    coords.lat,
        longitude:   coords.lng,
        geocoded_at: new Date().toISOString(),
      }).eq("id", m.id)
      count++
      await new Promise(r => setTimeout(r, 100))  // Rate limit
    }
  }
  console.log(`[places] Geocoded ${count} merchants`)
  return count
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function googleResultToPlace(g: any, userLat: number, userLng: number): PlaceResult {
  const lat = g.geometry.location.lat
  const lng = g.geometry.location.lng
  const distM = Math.round(haversineDistance(userLat, userLng, lat, lng) * 1000)
  const photo = g.photos?.[0]
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${g.photos[0].photo_reference}&key=${GOOGLE_MAPS_KEY()}`
    : null

  return {
    id:           g.place_id,
    name:         g.name,
    place_type:   g.types?.[0] ?? "establishment",
    address:      g.vicinity,
    latitude:     lat,
    longitude:    lng,
    distance_m:   distM,
    rating:       g.rating ?? null,
    user_ratings: g.user_ratings_total ?? null,
    photo_url:    photo,
    price_level:  g.price_level ?? null,
    phone:        null,
    website:      null,
    is_internal:  false,
    is_open:      g.opening_hours?.open_now,
    maps_url:     `https://www.google.com/maps/place/?q=place_id:${g.place_id}`,
  }
}

async function cachePlace(g: any, supabase: any): Promise<void> {
  const photo = g.photos?.[0]
    ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${g.photos[0].photo_reference}&key=${GOOGLE_MAPS_KEY()}`
    : null

  await supabase.from("place_cache").upsert({
    google_place_id:    g.place_id,
    name:               g.name,
    place_type:         g.types?.[0] ?? "establishment",
    address:            g.vicinity,
    latitude:           g.geometry.location.lat,
    longitude:          g.geometry.location.lng,
    rating:             g.rating ?? null,
    user_ratings_total: g.user_ratings_total ?? null,
    photo_url:          photo,
    price_level:        g.price_level ?? null,
    cached_at:          new Date().toISOString(),
    expires_at:         new Date(Date.now() + 7 * 86400000).toISOString(),
  }, { onConflict: "google_place_id" })
}

async function getLowStockMedications(userId: string, supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from("medication_inventory")
    .select("qty_remaining, low_stock_alert, medications!inner(name)")
    .eq("user_id", userId)
    .filter("qty_remaining", "lte", 7)

  return (data ?? [])
    .filter((i: any) => Number(i.qty_remaining) <= Number(i.low_stock_alert))
    .map((i: any) => (i.medications as any)?.name ?? "ยา")
    .slice(0, 3)
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
