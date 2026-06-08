"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2, MapPin, Star, Navigation, Phone, Globe, AlertCircle, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"
import { getMembership } from "@/lib/get-membership"

const TYPES = [
  { id: "all",                label: "ทั้งหมด",       emoji: "📍" },
  { id: "restaurant",         label: "ร้านอาหาร",     emoji: "🍽️" },
  { id: "pharmacy",           label: "ร้านยา",         emoji: "💊" },
  { id: "lodging",            label: "โรงแรม",         emoji: "🏨" },
  { id: "tourist_attraction", label: "ท่องเที่ยว",     emoji: "🏛️" },
  { id: "cafe",               label: "คาเฟ่",          emoji: "☕" },
  { id: "hospital",           label: "โรงพยาบาล",     emoji: "🏥" },
]

function fmtDist(m: number) { return m < 1000 ? `${m} ม.` : `${(m/1000).toFixed(1)} กม.` }

function PlaceCard({ place, lowMeds }: { place: any; lowMeds: string[] }) {
  const isPharmacy = place.type === "pharmacy" || place.type === "drugstore"
  const hasLowMed  = isPharmacy && lowMeds.length > 0

  return (
    <div className={cn("rounded-2xl border bg-white shadow-sm overflow-hidden",
      place.source === "internal" ? "border-violet-200" : "border-gray-100")}>
      {/* Photo */}
      {place.photo_url && (
        <div className="h-36 bg-gray-100 overflow-hidden">
          <img src={place.photo_url} alt={place.name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              {place.source === "internal" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">⭐ เคยไป</span>
              )}
              <span className="text-xs text-gray-400">{place.emoji} {place.label}</span>
            </div>
            <p className="font-bold text-gray-900 leading-tight">{place.name}</p>
            {place.address && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{place.address}</p>}
          </div>
          <span className="text-xs font-semibold text-brand-600 shrink-0 bg-brand-50 px-2 py-1 rounded-full">
            {fmtDist(place.distance_m)}
          </span>
        </div>

        {/* Pharmacy low-med alert */}
        {hasLowMed && (
          <div className="mt-2.5 p-2.5 bg-rose-50 rounded-xl border border-rose-100">
            <p className="text-xs text-rose-700 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              ยา "{lowMeds[0]}" ของคุณเหลือน้อย — ร้านนี้อยู่ใกล้แค่ {fmtDist(place.distance_m)}!
            </p>
          </div>
        )}

        {/* Rating + status */}
        <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-500 flex-wrap">
          {place.rating && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              {place.rating}{place.user_ratings ? ` (${place.user_ratings.toLocaleString()})` : ""}
            </span>
          )}
          {place.price_level != null && (
            <span>{"฿".repeat(place.price_level + 1)}</span>
          )}
          {place.is_open === true  && <span className="text-emerald-600 font-medium">● เปิดอยู่</span>}
          {place.is_open === false && <span className="text-rose-500 font-medium">● ปิดแล้ว</span>}
          {place.visit_count && <span>{place.visit_count} ครั้งที่ไป</span>}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <a href={place.maps_url} target="_blank" rel="noreferrer"
            className="flex-1 h-9 rounded-xl bg-brand-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" /> นำทาง
          </a>
          {place.phone && (
            <a href={`tel:${place.phone}`}
              className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
          {place.website && (
            <a href={place.website} target="_blank" rel="noreferrer"
              className="h-9 w-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
              <Globe className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LiffPlacesPage() {
  const searchParams = useSearchParams()
  const initLat = searchParams.get("lat")
  const initLng = searchParams.get("lng")
  const initType = searchParams.get("type") ?? "all"

  const [lat,       setLat]       = useState<number | null>(initLat ? Number(initLat) : null)
  const [lng,       setLng]       = useState<number | null>(initLng ? Number(initLng) : null)
  const [type,      setType]      = useState(initType)
  const [places,    setPlaces]    = useState<any[]>([])
  const [lowMeds,   setLowMeds]   = useState<string[]>([])
  const [loading,   setLoading]   = useState(false)
  const [geoError,  setGeoError]  = useState("")
  const [orgId,     setOrgId]     = useState<string | null>(null)

  // Get orgId from LIFF profile if available
  useEffect(() => {
    // Try to get org from API (user must be logged in on web)
    fetch("/api/org/current").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.orgId) setOrgId(d.orgId)
    }).catch(() => {})
  }, [])

  const search = useCallback(async (searchLat: number, searchLng: number, searchType: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        lat: String(searchLat), lng: String(searchLng),
        type: searchType, radius: "1000",
        ...(orgId ? { orgId } : {}),
      })
      const res  = await fetch(`/api/places?${params}`)
      const data = await res.json()
      setPlaces(data.results ?? [])
      setLowMeds(data.low_medications ?? [])
    } catch { setPlaces([]) } finally { setLoading(false) }
  }, [orgId])

  // Auto-request location on mount (if not provided in URL)
  useEffect(() => {
    if (lat && lng) { search(lat, lng, type); return }
    if (!navigator.geolocation) { setGeoError("Browser ไม่รองรับ GPS"); return }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude); setLng(pos.coords.longitude) },
      err => setGeoError(`ไม่สามารถรับตำแหน่งได้: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => { if (lat && lng) search(lat, lng, type) }, [lat, lng, type, search])

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white px-4 pt-12 pb-5 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Slippy</p>
            <h1 className="text-xl font-black mt-0.5">📍 สถานที่ใกล้เคียง</h1>
            {lat && lng && <p className="text-white/60 text-xs mt-0.5">รัศมี 1 กิโลเมตร</p>}
          </div>
          {lat && lng && (
            <button onClick={() => search(lat, lng, type)} disabled={loading}
              className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center">
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          {TYPES.map(t => (
            <button key={t.id} onClick={() => setType(t.id)}
              className={cn("flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-colors shrink-0",
                type === t.id ? "bg-white text-violet-700" : "bg-white/20 text-white hover:bg-white/30")}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Low medication banner */}
        {lowMeds.length > 0 && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
            <span className="text-2xl shrink-0">💊</span>
            <div>
              <p className="text-sm font-bold text-rose-800">ยาเหลือน้อย!</p>
              <p className="text-xs text-rose-600 mt-0.5">
                {lowMeds.join(", ")} — ร้านยาใกล้คุณแสดงด้านล่าง
              </p>
            </div>
          </div>
        )}

        {/* GPS error */}
        {geoError && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800">
            ⚠️ {geoError}
          </div>
        )}

        {/* Loading */}
        {loading && !places.length && (
          <div className="flex flex-col items-center py-16 gap-3 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
            <p className="text-sm">กำลังค้นหา...</p>
          </div>
        )}

        {/* Results */}
        {!loading && places.length === 0 && lat && (
          <div className="flex flex-col items-center py-16 gap-2 text-gray-400 text-center">
            <MapPin className="w-10 h-10 text-gray-300" />
            <p className="font-medium">ไม่พบสถานที่ในรัศมี 1 กม.</p>
            <p className="text-sm">ลองเปลี่ยนประเภทหรือตรวจสอบการตั้งค่า Google Maps API</p>
          </div>
        )}

        <div className="space-y-3">
          {places.map((p, i) => (
            <PlaceCard key={`${p.id}-${i}`} place={p} lowMeds={type === "pharmacy" ? lowMeds : []} />
          ))}
        </div>

        {places.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-5">
            พบ {places.length} สถานที่ · {places.filter(p => p.source === "internal").length} เคยไป
          </p>
        )}
      </div>
    </div>
  )
}
