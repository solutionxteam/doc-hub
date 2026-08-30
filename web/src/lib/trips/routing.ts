/**
 * Working out the path a leg actually takes.
 *
 * A transport leg has two ends; what goes between them depends entirely on how
 * you are travelling:
 *
 *   walking, driving, taxi, bus  → follow the road network
 *   flight, ferry                → there is no road; the honest line is the
 *                                  great circle, curved as it appears on a map
 *   train, shinkansen, subway    → rails exist but no free router knows them,
 *                                  and a straight line between two stations is
 *                                  what a transit diagram draws anyway
 *
 * The last case matters: rather than pretend, the result records which kind of
 * answer it is (`provider: "osrm"` vs `"geodesic"`) so the map can say so. A
 * straight line labelled as a route is worse than a straight line labelled as a
 * straight line — someone will read the distance off it.
 */

export type RouteMode = "foot" | "driving" | "direct"

export interface RouteGeometry {
  mode: RouteMode
  /** [lat, lng] pairs, in travel order. */
  coordinates: Array<[number, number]>
  distance_m: number | null
  duration_s: number | null
  /** The endpoints this was computed for — how staleness is detected. */
  from: [number, number]
  to: [number, number]
  provider: "osrm" | "geodesic"
  fetched_at: string
}

/**
 * Which routing profile a stop's type should use.
 *
 * Anything not on this list gets a direct line. That is the safe default: a new
 * transport type added in SQL draws something sensible rather than being routed
 * as a car by accident.
 */
export function modeForType(type: string): RouteMode {
  switch (type) {
    case "walk":                                  return "foot"
    case "car_rental": case "taxi": case "bus":   return "driving"
    default:                                      return "direct"
  }
}

/** Human label, for the line's tooltip. */
export const MODE_LABEL: Record<RouteMode, string> = {
  foot:    "เส้นทางเดินจริง",
  driving: "เส้นทางถนนจริง",
  direct:  "เส้นตรง (ไม่ใช่เส้นทางจริง)",
}

/**
 * Great-circle path between two points, as a polyline.
 *
 * Interpolated with spherical linear interpolation rather than by averaging
 * latitude and longitude: over the 4,600 km from Bangkok to Fukuoka the flat
 * average bows the wrong way by hundreds of kilometres, and the whole point of
 * drawing a curve is that it is the shape the aircraft actually flies.
 *
 * Short hops get few points because a 300 m ferry crossing is a straight line at
 * any sane zoom, and 64 points to say so is just payload.
 */
export function geodesic(
  from: [number, number],
  to: [number, number],
): Array<[number, number]> {
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI

  const [lat1, lon1] = from.map(toRad) as [number, number]
  const [lat2, lon2] = to.map(toRad) as [number, number]

  // Angular distance between the two points.
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ))
  if (!Number.isFinite(d) || d === 0) return [from, to]

  const km = d * 6371
  const steps = km < 50 ? 2 : km < 500 ? 16 : 64

  const out: Array<[number, number]> = []
  for (let i = 0; i <= steps; i++) {
    const f = i / steps
    const a = Math.sin((1 - f) * d) / Math.sin(d)
    const b = Math.sin(f * d) / Math.sin(d)
    const x = a * Math.cos(lat1) * Math.cos(lon1) + b * Math.cos(lat2) * Math.cos(lon2)
    const y = a * Math.cos(lat1) * Math.sin(lon1) + b * Math.cos(lat2) * Math.sin(lon2)
    const z = a * Math.sin(lat1) + b * Math.sin(lat2)
    out.push([toDeg(Math.atan2(z, Math.hypot(x, y))), toDeg(Math.atan2(y, x))])
  }
  return out
}

/** Metres between two points — used to label direct lines honestly. */
export function haversineMetres(from: [number, number], to: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const [lat1, lon1] = from, [lat2, lon2] = to
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(6_371_000 * 2 * Math.asin(Math.sqrt(a)))
}

/**
 * Has the stored geometry drifted from where the pins now are?
 *
 * ~11 m of tolerance (4 decimal places). Below that the line would not visibly
 * change, and re-routing on every pixel of drag would be a request per frame.
 */
export function isStale(
  route: RouteGeometry | null | undefined,
  from: [number, number],
  to: [number, number],
): boolean {
  if (!route?.coordinates?.length) return true
  const near = (a: number, b: number) => Math.abs(a - b) < 0.0001
  return !(near(route.from[0], from[0]) && near(route.from[1], from[1]) &&
           near(route.to[0], to[0])     && near(route.to[1], to[1]))
}

/**
 * Where road routing comes from.
 *
 * The OSRM demo server by default: no key, works immediately. Its operators ask
 * that it not be used for production traffic, and this app caches every answer
 * in `trip_itinerary_items.route_geometry` so a given leg is fetched once ever —
 * but if trips get real usage, point OSRM_URL at your own OSRM or a paid
 * provider rather than leaning harder on a free one.
 */
const OSRM_URL = process.env.OSRM_URL ?? "https://router.project-osrm.org"

/**
 * Ask the router for a path. Returns null on any failure — a leg that cannot be
 * routed falls back to a direct line, which is the correct drawing for it
 * anyway; there is nothing here worth failing a request over.
 */
export async function fetchRoad(
  mode: Exclude<RouteMode, "direct">,
  from: [number, number],
  to: [number, number],
): Promise<RouteGeometry | null> {
  // OSRM takes lng,lat — the opposite order to everything else here, which is
  // the single easiest thing to get wrong in this file.
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`
  const url = `${OSRM_URL}/route/v1/${mode}/${coords}?overview=full&geometries=geojson`

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const json = await res.json() as {
      code?: string
      routes?: Array<{ geometry?: { coordinates?: [number, number][] }; distance?: number; duration?: number }>
    }
    const route = json.routes?.[0]
    const line = route?.geometry?.coordinates
    if (json.code !== "Ok" || !line?.length) return null

    return {
      mode,
      coordinates: line.map(([lng, lat]) => [lat, lng] as [number, number]),
      distance_m: route?.distance ?? null,
      duration_s: route?.duration ?? null,
      from, to,
      provider: "osrm",
      fetched_at: new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** The full decision: route it if a road applies, otherwise draw the honest line. */
export async function buildRoute(
  type: string,
  from: [number, number],
  to: [number, number],
): Promise<RouteGeometry> {
  const mode = modeForType(type)

  if (mode !== "direct") {
    const road = await fetchRoad(mode, from, to)
    if (road) return road
    // Router unavailable — fall through rather than fail. The line is still
    // drawn, just as a direct one, and `provider` says so.
  }

  return {
    mode: "direct",
    coordinates: geodesic(from, to),
    distance_m: haversineMetres(from, to),
    duration_s: null,
    from, to,
    provider: "geodesic",
    fetched_at: new Date().toISOString(),
  }
}
