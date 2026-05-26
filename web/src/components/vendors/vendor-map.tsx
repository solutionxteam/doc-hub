"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 *
 * Leaflet map — rendered client-side only (SSR disabled via dynamic import).
 */

import { useEffect } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import type { Vendor } from "./vendors-client"
import { formatThb } from "@/lib/utils"
import "leaflet/dist/leaflet.css"
import L from "leaflet"

// Fix Leaflet's default icon paths broken by webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:       "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:     "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
})

// Custom colored marker using SVG
function makeIcon(color: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="32" height="42">
      <ellipse cx="16" cy="40" rx="6" ry="2.5" fill="rgba(0,0,0,0.18)" />
      <path d="M16 2C9.4 2 4 7.4 4 14c0 9 12 26 12 26S28 23 28 14C28 7.4 22.6 2 16 2z"
        fill="${color}" stroke="white" stroke-width="1.5" />
      <circle cx="16" cy="14" r="5" fill="white" fill-opacity="0.88" />
    </svg>
  `
  return L.divIcon({
    html:        svg,
    iconSize:    [32, 42],
    iconAnchor:  [16, 42],
    popupAnchor: [0, -38],
    className:   "",
  })
}

// Deterministic color from vendor name
function brandColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  const colors = [
    "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
    "#06b6d4","#f97316","#ec4899","#84cc16","#6366f1",
  ]
  return colors[Math.abs(h) % colors.length]
}

// Auto-fit bounds when markers change
function FitBounds({ vendors }: { vendors: Vendor[] }) {
  const map = useMap()
  useEffect(() => {
    const pts = vendors.filter(v => v.lat && v.lng).map(v => [v.lat!, v.lng!] as [number, number])
    if (pts.length === 0) return
    if (pts.length === 1) {
      map.setView(pts[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] })
    }
  }, [vendors, map])
  return null
}

interface Props { vendors: Vendor[] }

export default function VendorMap({ vendors }: Props) {
  const geoVendors = vendors.filter(v => v.lat && v.lng)

  // Default center: Bangkok
  const center: [number, number] = [13.7563, 100.5018]

  if (geoVendors.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-muted/20">
        <div className="text-3xl">📍</div>
        <p className="text-sm font-medium text-foreground">ยังไม่มีตำแหน่งพิกัด</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs px-4">
          ระบบจะ geocode ที่อยู่ของผู้ขายอัตโนมัติจาก OpenStreetMap
          ในระหว่างการประมวลผลเอกสาร
        </p>
      </div>
    )
  }

  return (
    <MapContainer
      center={center}
      zoom={10}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds vendors={geoVendors} />
      {geoVendors.map(v => (
        <Marker
          key={v.id}
          position={[v.lat!, v.lng!]}
          icon={makeIcon(brandColor(v.name))}
        >
          <Popup maxWidth={240} className="vendor-popup">
            <div className="p-1 space-y-2 min-w-[180px]">
              <div className="font-semibold text-[13px] leading-tight">{v.name}</div>
              {v.tax_id && (
                <div className="text-[11px] text-gray-500">Tax ID: {v.tax_id}</div>
              )}
              {v.address && (
                <div className="text-[11px] text-gray-500 leading-relaxed">{v.address}</div>
              )}
              <div className="border-t pt-2 grid grid-cols-2 gap-2 text-center">
                <div>
                  <div className="text-[11px] text-gray-400">เอกสาร</div>
                  <div className="text-[14px] font-bold">{v.doc_count}</div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400">ยอดรวม</div>
                  <div className="text-[13px] font-bold">
                    {formatThb(v.total_amount).replace(".00", "")}
                  </div>
                </div>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
