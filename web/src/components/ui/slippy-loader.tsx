"use client"

import { useAppLoading } from "@/lib/loading"
import { usePathname }   from "next/navigation"
import { useEffect, useRef, useState } from "react"

/** Thin gradient progress bar at the very top of the page */
function TopBar({ active }: { active: boolean }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!active) { setWidth(0); return }

    // Simulate progress: fast to 80%, then slow
    let w = 10
    const tick = setInterval(() => {
      w = w < 60 ? w + 8 : w < 80 ? w + 2 : w < 92 ? w + 0.5 : w
      setWidth(w)
    }, 150)
    return () => clearInterval(tick)
  }, [active])

  // Snap to 100% then hide
  useEffect(() => {
    if (!active && width > 0) {
      setWidth(100)
      const t = setTimeout(() => setWidth(0), 400)
      return () => clearTimeout(t)
    }
  }, [active, width])

  if (width === 0) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none">
      <div
        className="h-full bg-gradient-to-r from-violet-500 via-indigo-500 to-pink-500 transition-all"
        style={{
          width: `${width}%`,
          transitionDuration: width === 100 ? "300ms" : "150ms",
          boxShadow: "0 0 8px rgba(139,92,246,0.6)",
        }}
      />
    </div>
  )
}

/** Slippy mascot overlay for operations that take >500ms */
function SlippyOverlay({ active, message }: { active: boolean; message: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) { setVisible(false); return }
    // Small delay — don't flash for instant operations
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [active])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 px-8 py-6 rounded-2xl bg-card border border-border shadow-xl">
        {/* Mascot */}
        <div style={{ animation: "sp-float 2s ease-in-out infinite" }}>
          <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id="lo-bg" x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#8b5cf6"/>
                <stop offset="0.5" stopColor="#6366f1"/>
                <stop offset="1" stopColor="#ec4899"/>
              </linearGradient>
              <radialGradient id="lo-sh" cx="0.2" cy="0.15" r="0.85">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.4"/>
                <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
              </radialGradient>
              <linearGradient id="lo-slip" x1="14" y1="13" x2="34" y2="33" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#ffffff"/>
                <stop offset="1" stopColor="#f1f5f9"/>
              </linearGradient>
            </defs>
            <path d="M24 2C9.5 2 2 9.5 2 24S9.5 46 24 46 46 38.5 46 24 38.5 2 24 2z" fill="url(#lo-bg)"/>
            <path d="M24 2C9.5 2 2 9.5 2 24S9.5 46 24 46 46 38.5 46 24 38.5 2 24 2z" fill="url(#lo-sh)"/>
            <g style={{ transformOrigin:"24px 24px", animation:"sp-tilt 2.4s ease-in-out infinite" }}>
              <path d="M16.5 12.5 L31.5 12.5 Q34 12.5 34 15 L34 30 L31.7 32.6 L29.5 30 L27.2 32.6 L25 30 L22.8 32.6 L20.5 30 L18.3 32.6 L16 30 L14 32.6 L14 15 Q14 12.5 16.5 12.5 Z"
                fill="#1e1b4b" fillOpacity="0.15" transform="translate(0.4 0.7)"/>
              <path d="M16.5 12.5 L31.5 12.5 Q34 12.5 34 15 L34 30 L31.7 32.6 L29.5 30 L27.2 32.6 L25 30 L22.8 32.6 L20.5 30 L18.3 32.6 L16 30 L14 32.6 L14 15 Q14 12.5 16.5 12.5 Z"
                fill="url(#lo-slip)"/>
              <g style={{ transformOrigin:"20.2px 20.2px", animation:"sp-blink 2.8s ease-in-out infinite" }}>
                <circle cx="20.2" cy="20.2" r="1.45" fill="#1e1b4b"/>
              </g>
              <g style={{ transformOrigin:"27.8px 20.2px", animation:"sp-blink 2.8s ease-in-out infinite" }}>
                <circle cx="27.8" cy="20.2" r="1.45" fill="#1e1b4b"/>
              </g>
              <circle cx="18.4" cy="24.2" r="1.2" fill="#fb7185" fillOpacity="0.55"/>
              <circle cx="29.6" cy="24.2" r="1.2" fill="#fb7185" fillOpacity="0.55"/>
              <path d="M20 24.5 Q24 28 28 24.5" stroke="#1e1b4b" strokeWidth="1.7" strokeLinecap="round" fill="none"/>
            </g>
          </svg>
        </div>

        {/* Spinning dots */}
        <div className="flex items-center gap-1.5">
          {[0, 160, 320].map(d => (
            <div key={d} className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-bounce"
              style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>

        {/* Message */}
        <p className="text-[13px] font-medium text-foreground text-center max-w-[180px] leading-snug">
          {message}
        </p>
      </div>

      <style>{`
        @keyframes sp-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes sp-tilt  { 0%,100%{transform:rotate(-6deg)} 50%{transform:rotate(-1deg)} }
        @keyframes sp-blink { 0%,42%,48%,100%{transform:scaleY(1)} 45%{transform:scaleY(0.12)} }
      `}</style>
    </div>
  )
}

/** Route-change loader: shows top bar on Next.js navigation */
function RouteChangeLoader() {
  const pathname   = usePathname()
  const prevRef    = useRef(pathname)
  const [nav, setNav] = useState(false)

  useEffect(() => {
    if (prevRef.current !== pathname) {
      setNav(false)
      prevRef.current = pathname
    }
  }, [pathname])

  return <TopBar active={nav} />
}

/** Main export — mount once in AppShell */
export function SlippyLoader() {
  const { loading } = useAppLoading()
  return (
    <>
      <TopBar active={loading.active} />
      <SlippyOverlay active={loading.active} message={loading.message} />
    </>
  )
}
