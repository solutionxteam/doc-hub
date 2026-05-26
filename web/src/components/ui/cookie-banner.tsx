"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState, useEffect } from "react"
import Link from "next/link"

type CookiePrefs = {
  necessary : true      // always on, can't disable
  analytics : boolean
  marketing : boolean
}

const STORAGE_KEY  = "slippy_cookie_consent"
const CONSENT_VER  = "1"   // bump this to re-show banner after policy changes

function readStoredConsent(): (CookiePrefs & { version: string }) | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed.version !== CONSENT_VER) return null
    return parsed
  } catch { return null }
}

function storeConsent(prefs: CookiePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prefs, version: CONSENT_VER }))
}

export function CookieBanner() {
  const [visible,  setVisible]  = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [prefs,    setPrefs]    = useState<CookiePrefs>({
    necessary : true,
    analytics : false,
    marketing : false,
  })

  // Only show after mount (avoid SSR mismatch)
  useEffect(() => {
    const consent = readStoredConsent()
    if (!consent) setVisible(true)
  }, [])

  if (!visible) return null

  const acceptAll = () => {
    const all = { necessary: true as const, analytics: true, marketing: true }
    storeConsent(all)
    setVisible(false)
  }

  const rejectAll = () => {
    const min = { necessary: true as const, analytics: false, marketing: false }
    storeConsent(min)
    setVisible(false)
  }

  const saveCustom = () => {
    storeConsent(prefs)
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 md:p-6 pointer-events-none">
      <div className="max-w-2xl mx-auto pointer-events-auto">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-100">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🍪</span>
              <div className="flex-1">
                <h3 className="font-black text-gray-900 text-base leading-tight">
                  เราใช้ Cookie เพื่อปรับปรุงประสบการณ์ของคุณ
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Slippy ใช้คุกกี้เพื่อให้เว็บไซต์ทำงานได้อย่างถูกต้อง วิเคราะห์การใช้งาน และนำเสนอเนื้อหาที่เกี่ยวข้อง
                  ตามมาตรฐาน{" "}
                  <Link href="/privacy-policy" className="text-indigo-600 hover:underline font-semibold">
                    PDPA พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล 2562
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Expandable preferences */}
          {expanded && (
            <div className="px-5 py-4 space-y-3 border-b border-gray-100 bg-gray-50/50">
              {/* Necessary */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-10 h-5 rounded-full bg-indigo-600 relative shrink-0">
                  <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-white shadow" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">คุกกี้จำเป็น</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500">บังคับ</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">จำเป็นสำหรับการทำงานพื้นฐาน เช่น การล็อกอิน session และการรักษาความปลอดภัย ไม่สามารถปิดได้</p>
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setPrefs(p => ({ ...p, analytics: !p.analytics }))}
                  className={`mt-0.5 w-10 h-5 rounded-full relative shrink-0 transition-colors duration-200 ${prefs.analytics ? "bg-indigo-600" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${prefs.analytics ? "right-0.5" : "left-0.5"}`} />
                </button>
                <div>
                  <span className="text-sm font-bold text-gray-900">คุกกี้วิเคราะห์</span>
                  <p className="text-xs text-gray-500 mt-0.5">ช่วยเราเข้าใจว่าคุณใช้งานเว็บไซต์อย่างไร เพื่อปรับปรุงประสบการณ์ใช้งาน ข้อมูลไม่ระบุตัวตน</p>
                </div>
              </div>

              {/* Marketing */}
              <div className="flex items-start gap-3">
                <button
                  onClick={() => setPrefs(p => ({ ...p, marketing: !p.marketing }))}
                  className={`mt-0.5 w-10 h-5 rounded-full relative shrink-0 transition-colors duration-200 ${prefs.marketing ? "bg-indigo-600" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${prefs.marketing ? "right-0.5" : "left-0.5"}`} />
                </button>
                <div>
                  <span className="text-sm font-bold text-gray-900">คุกกี้การตลาด</span>
                  <p className="text-xs text-gray-500 mt-0.5">ใช้เพื่อแสดงโฆษณาและเนื้อหาที่เกี่ยวข้องกับคุณ ข้อมูลอาจแชร์กับพาร์ทเนอร์บุคคลที่สาม</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-5 py-4 flex flex-wrap gap-2 items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs font-semibold text-gray-500 hover:text-indigo-600 transition-colors underline-offset-2 hover:underline"
              >
                {expanded ? "ซ่อนการตั้งค่า ↑" : "จัดการคุกกี้ ↓"}
              </button>
              <Link href="/cookie-policy" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
                นโยบาย Cookie
              </Link>
            </div>

            <div className="flex items-center gap-2">
              {expanded ? (
                <>
                  <button
                    onClick={rejectAll}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    ปฏิเสธทั้งหมด
                  </button>
                  <button
                    onClick={saveCustom}
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
                  >
                    บันทึกการตั้งค่า
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={rejectAll}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                  >
                    ปฏิเสธ
                  </button>
                  <button
                    onClick={acceptAll}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                  >
                    ยอมรับทั้งหมด
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Floating "Manage Cookies" trigger (shown after consent given) ──
export function CookieManageButton() {
  const [show, setShow] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const consent = readStoredConsent()
    if (consent) setShow(true)
  }, [])

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  if (!show) return null

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 left-4 z-50 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center text-lg hover:scale-110 transition-transform"
        title="จัดการคุกกี้"
      >
        🍪
      </button>
      {open && (
        <div className="fixed bottom-16 left-4 z-50 w-64 bg-white border border-gray-200 rounded-2xl shadow-xl p-4">
          <p className="text-xs font-bold text-gray-900 mb-1">การตั้งค่า Cookie</p>
          <p className="text-xs text-gray-500 mb-4">คุณสามารถเปลี่ยนความยินยอมได้ทุกเมื่อ</p>
          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="flex-1 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl">ปิด</button>
            <button onClick={reset} className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl">รีเซ็ต</button>
          </div>
        </div>
      )}
    </>
  )
}
