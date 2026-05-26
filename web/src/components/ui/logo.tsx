/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useId } from "react"

export function LogoMark({ size = 32, className = '', glow = false }: { size?: number; className?: string; glow?: boolean }) {
  // useId() is stable between server and client — Math.random() causes hydration mismatch
  const uid = useId().replace(/:/g, "")
  return (
    <span className={"relative inline-flex shrink-0 " + className} style={{ width: size, height: size }}>
      {glow && <span className="absolute inset-0 rounded-[28%] bg-brand-500/50 blur-xl" />}
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative w-full h-full">
        <defs>
          <linearGradient id={`bg-${uid}`} x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8b5cf6"/>
            <stop offset="0.5" stopColor="#6366f1"/>
            <stop offset="1" stopColor="#ec4899"/>
          </linearGradient>
          <radialGradient id={`shine-${uid}`} cx="0.2" cy="0.15" r="0.85">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5"/>
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.05"/>
            <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id={`slip-${uid}`} x1="14" y1="13" x2="34" y2="33" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffffff"/>
            <stop offset="1" stopColor="#f1f5f9"/>
          </linearGradient>
        </defs>
        {/* Squircle background */}
        <path d="M24 2C9.5 2 2 9.5 2 24S9.5 46 24 46 46 38.5 46 24 38.5 2 24 2z" fill={`url(#bg-${uid})`}/>
        <path d="M24 2C9.5 2 2 9.5 2 24S9.5 46 24 46 46 38.5 46 24 38.5 2 24 2z" fill={`url(#shine-${uid})`}/>
        {/* Tilted paper slip with friendly face */}
        <g transform="rotate(-7 24 24)">
          {/* shadow */}
          <path d="M16.5 12.5 L31.5 12.5 Q34 12.5 34 15 L34 30 L31.7 32.6 L29.5 30 L27.2 32.6 L25 30 L22.8 32.6 L20.5 30 L18.3 32.6 L16 30 L14 32.6 L14 15 Q14 12.5 16.5 12.5 Z"
                fill="#1e1b4b" fillOpacity="0.18" transform="translate(0.6 0.9)"/>
          {/* slip body */}
          <path d="M16.5 12.5 L31.5 12.5 Q34 12.5 34 15 L34 30 L31.7 32.6 L29.5 30 L27.2 32.6 L25 30 L22.8 32.6 L20.5 30 L18.3 32.6 L16 30 L14 32.6 L14 15 Q14 12.5 16.5 12.5 Z"
                fill={`url(#slip-${uid})`}/>
          {/* eyes */}
          <circle cx="20.2" cy="20.2" r="1.45" fill="#1e1b4b"/>
          <circle cx="27.8" cy="20.2" r="1.45" fill="#1e1b4b"/>
          {/* cheek blush */}
          <circle cx="18.4" cy="24.2" r="1.2" fill="#fb7185" fillOpacity="0.55"/>
          <circle cx="29.6" cy="24.2" r="1.2" fill="#fb7185" fillOpacity="0.55"/>
          {/* smile */}
          <path d="M20 24.5 Q24 28 28 24.5" stroke="#1e1b4b" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
        </g>
      </svg>
    </span>
  )
}
