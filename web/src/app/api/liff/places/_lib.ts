const GOOGLE_DETAILS    = "https://maps.googleapis.com/maps/api/place/details/json"
const GOOGLE_GEOCODE    = "https://maps.googleapis.com/maps/api/geocode/json"
const GOOGLE_FIND_PLACE = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
const GOOGLE_KEY        = () => process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ""

// category → display label + emoji, used by both the API and the picker UI
export const PLACE_CATEGORIES: Record<string, { label: string; emoji: string }> = {
  gym:                { label: "สนามกีฬา/ฟิตเนส", emoji: "🏸" },
  restaurant:         { label: "ร้านอาหาร",        emoji: "🍽️" },
  cafe:               { label: "คาเฟ่",            emoji: "☕" },
  tourist_attraction: { label: "ท่องเที่ยว",       emoji: "🏛️" },
  lodging:            { label: "โรงแรม",           emoji: "🏨" },
  other:              { label: "อื่นๆ",            emoji: "📍" },
}

// Map a Google Places `types[0]` value onto one of our categories.
const GOOGLE_TYPE_MAP: Record<string, string> = {
  gym: "gym", stadium: "gym", sports_complex: "gym",
  restaurant: "restaurant", food: "restaurant", meal_takeaway: "restaurant",
  cafe: "cafe", bakery: "cafe",
  tourist_attraction: "tourist_attraction", park: "tourist_attraction", museum: "tourist_attraction",
  lodging: "lodging", hotel: "lodging",
}

export function categoryFromGoogleTypes(types?: string[]): string {
  for (const t of types ?? []) {
    if (GOOGLE_TYPE_MAP[t]) return GOOGLE_TYPE_MAP[t]
  }
  return "other"
}

export interface ResolvedPlace {
  name:     string | null
  category: string
  address:  string | null
  lat:      number | null
  lng:      number | null
  mapsUrl:  string
  photoUrl: string | null
}

// Resolve a Google Maps share link (incl. short links like maps.app.goo.gl/...)
// into place details. Works with or without NEXT_PUBLIC_GOOGLE_MAPS_KEY —
// without a key it falls back to parsing name/coords directly out of the URL.
export async function resolveGoogleMapsLink(url: string): Promise<ResolvedPlace> {
  let finalUrl = url
  try {
    const res = await fetch(url, { redirect: "follow" })
    finalUrl = res.url || url
  } catch {
    // Network error following the link — fall back to parsing the raw URL
  }

  let lat: number | null = null
  let lng: number | null = null
  const coordMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (coordMatch) {
    lat = Number(coordMatch[1])
    lng = Number(coordMatch[2])
  }

  let name: string | null = null
  const nameMatch = finalUrl.match(/\/maps\/place\/([^/@]+)/)
  if (nameMatch) {
    name = decodeURIComponent(nameMatch[1]).replace(/[+_]/g, " ").trim()
  }

  // Fallback for share links like `https://www.google.com/maps?q=<name or lat,lng>`
  if (!name && lat == null) {
    const qMatch = finalUrl.match(/[?&]q=([^&]+)/)
    if (qMatch) {
      const q = decodeURIComponent(qMatch[1]).replace(/\+/g, " ").trim()
      const qCoordMatch = q.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/)
      if (qCoordMatch) {
        lat = Number(qCoordMatch[1])
        lng = Number(qCoordMatch[2])
      } else if (q) {
        name = q
      }
    }
  }

  let placeId: string | null = null
  const placeIdMatch = finalUrl.match(/(?:query_place_id|place_id)[=:]([^&/]+)/)
  if (placeIdMatch) placeId = decodeURIComponent(placeIdMatch[1])

  // No place_id and no coordinates yet, but we have a text query (e.g. from
  // `?q=<name>`) — look it up via Find Place From Text to get a place_id.
  if (GOOGLE_KEY() && !placeId && lat == null && name) {
    try {
      const findUrl = new URL(GOOGLE_FIND_PLACE)
      findUrl.searchParams.set("input", name)
      findUrl.searchParams.set("inputtype", "textquery")
      findUrl.searchParams.set("fields", "place_id")
      findUrl.searchParams.set("language", "th")
      findUrl.searchParams.set("key", GOOGLE_KEY())
      const fRes  = await fetch(findUrl.toString())
      const fData = await fRes.json() as { candidates?: any[]; status: string }
      placeId = fData.candidates?.[0]?.place_id ?? null
    } catch { /* fall through to URL-derived data */ }
  }

  let address: string | null = null
  let category = "other"
  let photoUrl: string | null = null

  if (GOOGLE_KEY() && placeId) {
    try {
      const detailsUrl = new URL(GOOGLE_DETAILS)
      detailsUrl.searchParams.set("place_id", placeId)
      detailsUrl.searchParams.set("fields", "name,formatted_address,geometry,photo,type")
      detailsUrl.searchParams.set("language", "th")
      detailsUrl.searchParams.set("key", GOOGLE_KEY())
      const dRes  = await fetch(detailsUrl.toString())
      const dData = await dRes.json() as { result?: any; status: string }
      const result = dData.result
      if (result) {
        name     = result.name ?? name
        address  = result.formatted_address ?? null
        lat      = result.geometry?.location?.lat ?? lat
        lng      = result.geometry?.location?.lng ?? lng
        category = categoryFromGoogleTypes(result.types)
        if (result.photos?.[0]?.photo_reference) {
          photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${result.photos[0].photo_reference}&key=${GOOGLE_KEY()}`
        }
      }
    } catch { /* fall through to URL-derived data */ }
  } else if (GOOGLE_KEY() && lat != null && lng != null) {
    try {
      const geoUrl = new URL(GOOGLE_GEOCODE)
      geoUrl.searchParams.set("latlng", `${lat},${lng}`)
      geoUrl.searchParams.set("language", "th")
      geoUrl.searchParams.set("key", GOOGLE_KEY())
      const gRes  = await fetch(geoUrl.toString())
      const gData = await gRes.json() as { results?: any[]; status: string }
      address = gData.results?.[0]?.formatted_address ?? null
    } catch { /* fall through */ }
  }

  return { name, category, address, lat, lng, mapsUrl: finalUrl, photoUrl }
}
