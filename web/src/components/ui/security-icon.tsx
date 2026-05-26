/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

/**
 * SecurityIcon — squircle-gradient SVG icons matching the Slippy logo style.
 * Works in both Server Components and Client Components (no hooks, stable IDs).
 *
 * id: 0=AES-256  1=TLS 1.3  2=Google Cloud  3=PDPA Ready
 */

import type React from "react"

interface SecurityIconProps {
  id: 0 | 1 | 2 | 3
  size?: number
  className?: string
}

// Squircle background path (same shape as the LogoMark)
const SQUIRCLE = "M24 2C9.5 2 2 9.5 2 24S9.5 46 24 46 46 38.5 46 24 38.5 2 24 2z"

// Use render functions instead of JSX in module-level constants to avoid RSC bundler issues
const CONFIGS: Array<{ g1: string; g2: string; content: () => React.ReactNode }> = [
  // ── 0: AES-256 — Lock + binary grid ─────────────────────────────────────
  {
    g1: "#8b5cf6", g2: "#6366f1",   // violet → indigo  (same as logo)
    content: () => (
      <>
        {/* Lock body */}
        <rect x="13" y="24" width="22" height="16" rx="3.5"
          fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
        {/* Shackle */}
        <path d="M17 24v-5a7 7 0 0 1 14 0v5"
          stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* Keyhole */}
        <circle cx="24" cy="31" r="2.8" fill="white" fillOpacity="0.9" />
        <rect x="22.8" y="31.5" width="2.4" height="4" rx="1.2"
          fill="white" fillOpacity="0.9" />
        {/* Binary dots — top-right sparkle */}
        {[
          [33, 11], [36, 11], [33, 14], [36, 14],
          [35, 8],
        ].map(([x, y]) => (
          <rect key={`${x}${y}`} x={x} y={y} width="1.8" height="1.8" rx="0.5"
            fill="white" fillOpacity="0.55" />
        ))}
      </>
    ),
  },

  // ── 1: TLS 1.3 — Encrypted tunnel / two-way arrows ──────────────────────
  {
    g1: "#38bdf8", g2: "#2563eb",   // sky → blue
    content: () => (
      <>
        {/* Top arrow → right */}
        <path d="M12 18h18l-4-4m4 4-4 4"
          stroke="white" strokeWidth="2.2" strokeLinecap="round"
          strokeLinejoin="round" fill="none" />
        {/* Bottom arrow ← left */}
        <path d="M36 30H18l4-4m-4 4 4 4"
          stroke="white" strokeWidth="2.2" strokeLinecap="round"
          strokeLinejoin="round" fill="none" />
        {/* Shield badge — centre */}
        <path d="M24 11 L30 14 L30 19 Q30 24 24 26 Q18 24 18 19 L18 14 Z"
          fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.2" />
        <path d="M21 19 L23 21 L27 16"
          stroke="white" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round" fill="none" />
      </>
    ),
  },

  // ── 2: Google Cloud — Cloud + infrastructure nodes ───────────────────────
  {
    g1: "#34d399", g2: "#0891b2",   // emerald → cyan
    content: () => (
      <>
        {/* Cloud shape */}
        <path d="M14 29a6 6 0 0 1 1-12 8 8 0 0 1 15.5 2A5 5 0 0 1 34 29Z"
          fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5" />
        {/* Node dots below cloud */}
        <circle cx="17" cy="35" r="2.2" fill="white" fillOpacity="0.8" />
        <circle cx="24" cy="35" r="2.2" fill="white" fillOpacity="0.8" />
        <circle cx="31" cy="35" r="2.2" fill="white" fillOpacity="0.8" />
        {/* Connecting lines from cloud base */}
        <line x1="17" y1="29" x2="17" y2="33" stroke="white" strokeWidth="1.4"
          strokeLinecap="round" strokeOpacity="0.6" />
        <line x1="24" y1="29" x2="24" y2="33" stroke="white" strokeWidth="1.4"
          strokeLinecap="round" strokeOpacity="0.6" />
        <line x1="31" y1="29" x2="31" y2="33" stroke="white" strokeWidth="1.4"
          strokeLinecap="round" strokeOpacity="0.6" />
        {/* Horizontal connector */}
        <line x1="17" y1="35" x2="31" y2="35" stroke="white" strokeWidth="1.4"
          strokeLinecap="round" strokeOpacity="0.35" />
      </>
    ),
  },

  // ── 3: PDPA Ready — Document + official check stamp ──────────────────────
  {
    g1: "#c084fc", g2: "#ec4899",   // purple → pink  (logo accent)
    content: () => (
      <>
        {/* Document body (tilted slightly like LogoMark slip) */}
        <rect x="13" y="11" width="16" height="20" rx="2.5"
          fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.4" />
        {/* Ruled lines */}
        <line x1="16" y1="17" x2="26" y2="17" stroke="white" strokeWidth="1.3"
          strokeLinecap="round" strokeOpacity="0.55" />
        <line x1="16" y1="21" x2="26" y2="21" stroke="white" strokeWidth="1.3"
          strokeLinecap="round" strokeOpacity="0.55" />
        <line x1="16" y1="25" x2="22" y2="25" stroke="white" strokeWidth="1.3"
          strokeLinecap="round" strokeOpacity="0.55" />
        {/* Stamp circle — bottom-right overlap */}
        <circle cx="30" cy="32" r="8"
          fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.6" />
        {/* Check inside stamp */}
        <path d="M25.5 32 L28.5 35 L34.5 28"
          stroke="white" strokeWidth="2.2" strokeLinecap="round"
          strokeLinejoin="round" fill="none" />
      </>
    ),
  },
]

export function SecurityIcon({ id, size = 48, className = "" }: SecurityIconProps) {
  const c = CONFIGS[id]
  // Stable prefix — no Math.random(), safe for SSR + client hydration
  const p = `si${id}`

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${p}bg`} x1="2" y1="2" x2="46" y2="46"
          gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.g1} />
          <stop offset="1" stopColor={c.g2} />
        </linearGradient>
        <radialGradient id={`${p}sh`} cx="0.2" cy="0.15" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0.06" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Squircle background */}
      <path d={SQUIRCLE} fill={`url(#${p}bg)`} />
      {/* Inner shine */}
      <path d={SQUIRCLE} fill={`url(#${p}sh)`} />
      {/* Icon artwork */}
      {c.content()}
    </svg>
  )
}

/** Convenience: render all 4 badges as a data array */
export const SECURITY_BADGES = [
  { id: 0 as const, label: "AES-256",      sub: "เข้ารหัสข้อมูลทั้งหมด" },
  { id: 1 as const, label: "TLS 1.3",      sub: "การรับส่งข้อมูล" },
  { id: 2 as const, label: "Google Cloud", sub: "SOC 2 Type II" },
  { id: 3 as const, label: "PDPA Ready",   sub: "ตรวจสอบรายปี" },
]

export const TRUST_BADGE_DATA = [
  { id: 3 as const, label: "PDPA Compliant",    sub: "ปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล 2562" },
  { id: 0 as const, label: "AES-256 Encrypted", sub: "ข้อมูลทุกชิ้นถูกเข้ารหัสทั้งขณะส่งและจัดเก็บ" },
  { id: 2 as const, label: "Google Cloud",       sub: "โครงสร้างพื้นฐานระดับ Enterprise บน GCP Asia" },
  { id: 1 as const, label: "TLS 1.3",            sub: "เข้ารหัสการรับส่งข้อมูลทุกครั้ง" },
]
