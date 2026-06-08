"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import Link           from "next/link"
import { useState }   from "react"
import { LogoMark }   from "@/components/ui/logo"
import { Icons }      from "@/components/ui/icons"
import { SecurityIcon, TRUST_BADGE_DATA } from "@/components/ui/security-icon"
import { PLANS as APP_PLANS } from "@/lib/plans"

// ─────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────
// ─── Feature SVG icons — squircle gradient matching the Slippy logo ───────────
function FeatureIcon({ id }: { id: number }) {
  const uid = `fi-${id}`
  const configs = [
    // 0 — AI Scan: brain/sparkle
    {
      g1: ["#a78bfa","#6366f1"], g2: ["#6366f1","#818cf8"],
      path: (
        <>
          {/* sparkle top-right */}
          <path d="M30 10 L31.2 13.5 L35 14.5 L31.2 15.5 L30 19 L28.8 15.5 L25 14.5 L28.8 13.5 Z" fill="white" fillOpacity="0.9"/>
          {/* document body */}
          <rect x="14" y="16" width="14" height="18" rx="2" fill="white" fillOpacity="0.25"/>
          <rect x="14" y="16" width="14" height="18" rx="2" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.2"/>
          {/* scan lines */}
          <line x1="17" y1="22" x2="25" y2="22" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="17" y1="26" x2="23" y2="26" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="17" y1="30" x2="25" y2="30" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          {/* eye/lens */}
          <circle cx="31" cy="31" r="6" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5"/>
          <circle cx="31" cy="31" r="2.5" fill="white" fillOpacity="0.7"/>
          <line x1="35.2" y1="35.2" x2="37.5" y2="37.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </>
      ),
    },
    // 1 — VAT/WHT Report: bar chart
    {
      g1: ["#34d399","#059669"], g2: ["#10b981","#34d399"],
      path: (
        <>
          {/* bars */}
          <rect x="13" y="26" width="5" height="12" rx="1.5" fill="white" fillOpacity="0.6"/>
          <rect x="21" y="19" width="5" height="19" rx="1.5" fill="white" fillOpacity="0.9"/>
          <rect x="29" y="22" width="5" height="16" rx="1.5" fill="white" fillOpacity="0.75"/>
          {/* trend line */}
          <polyline points="15.5,25 23.5,18 31.5,21" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray="2 1"/>
          {/* top dot */}
          <circle cx="23.5" cy="17.5" r="2" fill="white"/>
          {/* x-axis */}
          <line x1="11" y1="38.5" x2="37" y2="38.5" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.5"/>
        </>
      ),
    },
    // 2 — Connect FlowAccount: plug/link
    {
      g1: ["#f472b6","#ec4899"], g2: ["#db2777","#f472b6"],
      path: (
        <>
          {/* link chain left */}
          <rect x="10" y="20" width="11" height="8" rx="4" fill="none" stroke="white" strokeWidth="2.2"/>
          {/* link chain right */}
          <rect x="27" y="20" width="11" height="8" rx="4" fill="none" stroke="white" strokeWidth="2.2"/>
          {/* connecting bar */}
          <line x1="21" y1="24" x2="27" y2="24" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          {/* arrow top */}
          <path d="M22 15 L24 12 L26 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="24" y1="12" x2="24" y2="19" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          {/* arrow bottom */}
          <path d="M22 33 L24 36 L26 33" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="24" y1="36" x2="24" y2="29" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
        </>
      ),
    },
    // 3 — Approval Workflow: checkmark shield
    {
      g1: ["#60a5fa","#3b82f6"], g2: ["#2563eb","#60a5fa"],
      path: (
        <>
          {/* shield */}
          <path d="M24 11 L36 16 L36 24 Q36 33 24 38 Q12 33 12 24 L12 16 Z" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5"/>
          {/* bold check */}
          <path d="M18 24 L22 28 L30 19" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </>
      ),
    },
    // 4 — LINE Bot: chat bubble + bolt
    {
      g1: ["#4ade80","#16a34a"], g2: ["#15803d","#4ade80"],
      path: (
        <>
          {/* chat bubble */}
          <path d="M12 14 Q12 11 15 11 L33 11 Q36 11 36 14 L36 26 Q36 29 33 29 L26 29 L22 34 L22 29 L15 29 Q12 29 12 26 Z" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.5"/>
          {/* bolt/zap */}
          <path d="M26 14 L21 22 L25 22 L22 30 L29 20 L25 20 Z" fill="white" fillOpacity="0.9"/>
        </>
      ),
    },
    // 5 — Multi-company: building blocks
    {
      g1: ["#fb923c","#ea580c"], g2: ["#c2410c","#fb923c"],
      path: (
        <>
          {/* tall building left */}
          <rect x="11" y="18" width="10" height="20" rx="1.5" fill="white" fillOpacity="0.25" stroke="white" strokeWidth="1.3"/>
          <rect x="13" y="21" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.7"/>
          <rect x="17" y="21" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.7"/>
          <rect x="13" y="26" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.7"/>
          <rect x="17" y="26" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.7"/>
          {/* tall building right */}
          <rect x="27" y="14" width="10" height="24" rx="1.5" fill="white" fillOpacity="0.3" stroke="white" strokeWidth="1.3"/>
          <rect x="29" y="17" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.85"/>
          <rect x="33" y="17" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.85"/>
          <rect x="29" y="22" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.85"/>
          <rect x="33" y="22" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.85"/>
          <rect x="29" y="27" width="2.5" height="2.5" rx="0.5" fill="white" fillOpacity="0.85"/>
          {/* base line */}
          <line x1="10" y1="38.5" x2="38" y2="38.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.55"/>
        </>
      ),
    },
  ]

  const c = configs[id]
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="2" y1="2" x2="46" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={c.g1[0]}/>
          <stop offset="1" stopColor={c.g1[1]}/>
        </linearGradient>
        <radialGradient id={`${uid}-sh`} cx="0.2" cy="0.15" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35"/>
          <stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
      </defs>
      {/* squircle bg */}
      <path d="M24 2C9.5 2 2 9.5 2 24S9.5 46 24 46 46 38.5 46 24 38.5 2 24 2z" fill={`url(#${uid}-bg)`}/>
      <path d="M24 2C9.5 2 2 9.5 2 24S9.5 46 24 46 46 38.5 46 24 38.5 2 24 2z" fill={`url(#${uid}-sh)`}/>
      {c.path}
    </svg>
  )
}

const FEATURES = [
  { id: 0, title: "AI อ่านเอกสารอัตโนมัติ",      desc: "รองรับใบเสร็จ ใบกำกับภาษี สลิปโอน PDF ความแม่นยำ 95%+ ไม่ต้องพิมพ์เอง" },
  { id: 1, title: "รายงาน VAT & WHT พร้อมใช้",    desc: "คำนวณ ภ.พ.30 และ ภ.ง.ด.3/53 อัตโนมัติ Export Excel/PDF ยื่นสรรพากรได้เลย" },
  { id: 2, title: "เชื่อมต่อ FlowAccount & PEAK", desc: "Push เอกสารที่อนุมัติแล้วเข้าโปรแกรมบัญชีโดยตรง ไม่ต้องกรอกซ้ำ" },
  { id: 3, title: "Approval Workflow",             desc: "ส่งรีวิว → อนุมัติ → Push ทีมงานทุกคนรู้สถานะแบบ real-time" },
  { id: 4, title: "LINE Bot ส่งเอกสารทันที",      desc: "ถ่ายรูปแล้วส่งผ่าน @slippy_bot ในกลุ่มบริษัท อัพโหลดง่ายไม่ต้องเปิดเว็บ" },
  { id: 5, title: "จัดการหลายบริษัท",            desc: "ดูแลทุก entity ในที่เดียว แยก org แยก quota แยก report ได้อิสระ" },
]

const HOW_IT_WORKS = [
  { step: "01", icon: "📷", title: "ถ่ายรูปหรืออัพโหลด",    desc: "จาก Mobile App, LINE Bot หรืออีเมล AI รับและประมวลผลอัตโนมัติ" },
  { step: "02", icon: "🧠", title: "AI วิเคราะห์เอกสาร",    desc: "อ่านชื่อผู้ขาย เลขที่ ยอด VAT หมวดหมู่ และคำนวณ WHT ให้ครบ" },
  { step: "03", icon: "📤", title: "รายงานพร้อมส่งงาน",     desc: "Export ภ.พ.30 / ภ.ง.ด.3 หรือ Push ตรงเข้า FlowAccount / PEAK" },
]

const TESTIMONIALS = [
  {
    name:    "คุณมินทร์ เจริญพร",
    role:    "CEO, บริษัท เทคแลบ จำกัด",
    avatar:  "มจ",
    text:    "ลดงานทีมบัญชีจาก 3 วัน เหลือแค่ครึ่งวันต่อเดือน FlowAccount sync ใช้งานได้จริงมาก ไม่ต้องกรอกซ้ำอีกเลย",
    stars:   5,
  },
  {
    name:    "คุณสุนิสา ทองมา",
    role:    "CFO, Grab Food Merchant",
    avatar:  "สท",
    text:    "รายงาน VAT ที่ออกมาถูกต้อง 100% เทียบกับที่เคยทำมือ ตอนนี้ยื่น ภ.พ.30 ทำคนเดียวได้แล้ว",
    stars:   5,
  },
  {
    name:    "คุณปรีชา วงษ์ดี",
    role:    "เจ้าของร้าน SME Café",
    avatar:  "ปว",
    text:    "ส่งสลิปผ่าน LINE Bot ในกลุ่มร้าน ง่ายมากๆ พนักงานทุกคนใช้เป็นภายในวันเดียว ประหยัดเวลาไปเยอะ",
    stars:   5,
  },
]

const COMPARISON = [
  { feature: "AI อ่านเอกสาร",         manual: false, paypers: true,  slippy: true },
  { feature: "รายงาน VAT (ภ.พ.30)",   manual: false, paypers: false, slippy: true },
  { feature: "รายงาน WHT (ภ.ง.ด.)",   manual: false, paypers: false, slippy: true },
  { feature: "Approval Workflow",       manual: false, paypers: false, slippy: true },
  { feature: "เชื่อมต่อ FlowAccount",   manual: false, paypers: false, slippy: true },
  { feature: "Multi-company",           manual: false, paypers: true,  slippy: true },
  { feature: "LINE Bot",                manual: false, paypers: true,  slippy: true },
  { feature: "Mobile App",              manual: false, paypers: true,  slippy: true },
  { feature: "PDPA Compliant",          manual: false, paypers: false, slippy: true },
  { feature: "Export Excel/PDF",        manual: false, paypers: true,  slippy: true },
]

// Pricing plans for landing page — imported from lib/plans.ts (single source of truth)
// Show only paid plans + free on landing (skip enterprise detail here)
const LANDING_PLANS = APP_PLANS.filter(p => p.id !== "enterprise").concat(
  APP_PLANS.filter(p => p.id === "enterprise")
)

// TRUST_BADGES now uses SecurityIcon — imported as TRUST_BADGE_DATA from security-icon.tsx

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white text-gray-900 font-[var(--font-noto),var(--font-inter),sans-serif]">
      {/* ── NAV ───────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="font-black text-xl tracking-tight text-gray-900">Slippy</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features"    className="hover:text-indigo-600 transition-colors">ฟีเจอร์</a>
            <a href="#how"         className="hover:text-indigo-600 transition-colors">วิธีใช้งาน</a>
            <a href="#pricing"     className="hover:text-indigo-600 transition-colors">ราคา</a>
            <a href="#testimonials" className="hover:text-indigo-600 transition-colors">รีวิว</a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/login"
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-indigo-600 transition-colors">
              เข้าสู่ระบบ
            </Link>
            <Link href="/register"
              className="px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm">
              ทดลองใช้ฟรี
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMenuOpen(!menuOpen)}>
            <div className="w-5 h-0.5 bg-gray-700 mb-1" />
            <div className="w-5 h-0.5 bg-gray-700 mb-1" />
            <div className="w-5 h-0.5 bg-gray-700" />
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 flex flex-col gap-4">
            {["features","how","pricing","testimonials"].map(id => (
              <a key={id} href={`#${id}`}
                className="text-sm font-medium text-gray-600 hover:text-indigo-600"
                onClick={() => setMenuOpen(false)}>
                {id === "features" ? "ฟีเจอร์" : id === "how" ? "วิธีใช้งาน" : id === "pricing" ? "ราคา" : "รีวิว"}
              </a>
            ))}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <Link href="/login" className="flex-1 py-2.5 text-center text-sm font-semibold border border-gray-200 rounded-xl">เข้าสู่ระบบ</Link>
              <Link href="/register" className="flex-1 py-2.5 text-center text-sm font-bold text-white bg-indigo-600 rounded-xl">ทดลองใช้ฟรี</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ─────────────────────────── */}
      <section className="pt-36 pb-24 px-6 text-center relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-indigo-50/60 blur-3xl" />
          <div className="absolute top-20 left-1/4 w-64 h-64 rounded-full bg-purple-100/40 blur-3xl" />
          <div className="absolute top-40 right-1/4 w-48 h-48 rounded-full bg-pink-100/30 blur-3xl" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
          AI Accounting OS สำหรับธุรกิจไทย
        </div>

        <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight mb-6 max-w-4xl mx-auto">
          จาก 3 วัน{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-500">
            เหลือ 10 นาที
          </span>
          <br />ด้วย AI ที่เข้าใจบัญชีไทย
        </h1>

        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          เอกสารเข้า → AI ประมวลผล → รายงาน VAT & WHT พร้อมยื่น ไม่ใช่แค่เก็บไฟล์ แต่ทำบัญชีได้ครบจบในที่เดียว
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link href="/register"
            className="px-8 py-4 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5">
            ทดลองใช้ฟรี 14 วัน →
          </Link>
          <a href="#how"
            className="px-8 py-4 text-base font-semibold text-gray-700 bg-white border border-gray-200 hover:border-indigo-300 rounded-2xl transition-all hover:-translate-y-0.5">
            ดูวิธีการทำงาน
          </a>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap justify-center gap-8 text-center">
          {[
            ["95%+", "ความแม่นยำ AI"],
            ["10 นาที", "ปิดงาน VAT ต่อเดือน"],
            ["500+", "บริษัทไว้วางใจ"],
            ["PDPA", "รองรับแล้ว"],
          ].map(([val, lbl]) => (
            <div key={lbl}>
              <div className="text-2xl font-black text-gray-900">{val}</div>
              <div className="text-xs text-gray-500 mt-0.5">{lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── LINE QUICK START ─────────────── */}
      <section className="py-16 px-6 bg-gradient-to-br from-[#06C755]/5 via-white to-indigo-50/30">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
            <div className="grid md:grid-cols-2 gap-0">
              {/* Left */}
              <div className="p-10 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#06C755]/10 text-[#06C755] text-xs font-bold mb-6 w-fit">
                  <span className="text-base">💬</span> LINE Bot
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-3">
                  ส่งเอกสารผ่าน LINE ได้เลย
                </h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  ไม่ต้องเปิดเว็บ ไม่ต้องล็อกอิน แค่ถ่ายรูปแล้วส่งใน LINE กลุ่มบริษัท AI ประมวลผลทันที ใบเสร็จเข้าระบบอัตโนมัติ
                </p>
                <div className="flex flex-col gap-3 text-sm">
                  {["📸 ถ่ายรูปใบเสร็จ → ส่งใน LINE", "🤖 AI อ่านและจัดหมวดหมู่", "✅ เข้าระบบ Slippy อัตโนมัติ"].map(s => (
                    <div key={s} className="flex items-center gap-3">
                      <span className="w-4 h-4 rounded-full bg-[#06C755]/15 flex items-center justify-center text-[#06C755] text-xs">✓</span>
                      <span className="text-gray-600">{s}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex gap-3">
                  <a href="https://line.me/R/ti/p/@slippy_bot" target="_blank" rel="noopener noreferrer"
                    className="px-5 py-3 rounded-xl bg-[#06C755] text-white text-sm font-bold hover:bg-[#05a847] transition-colors">
                    เพิ่มเพื่อน LINE Bot
                  </a>
                  <a href="#features" className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-indigo-300 transition-colors">
                    ดูฟีเจอร์ทั้งหมด
                  </a>
                </div>
              </div>
              {/* Right – mock chat */}
              <div className="bg-gray-50 p-10 flex flex-col justify-center">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-w-xs mx-auto w-full">
                  <div className="bg-[#06C755] text-white px-4 py-3 text-sm font-bold flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs">🤖</div>
                    Slippy Bot
                  </div>
                  <div className="p-4 space-y-3 text-xs">
                    <div className="flex justify-end">
                      <div className="bg-[#06C755] text-white rounded-xl rounded-tr-sm px-3 py-2 max-w-[70%]">
                        📎 receipt_amazon.pdf
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 shrink-0 flex items-center justify-center text-xs">🤖</div>
                      <div className="bg-gray-100 rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%] text-gray-700">
                        ✅ บันทึกเรียบร้อย<br />
                        <span className="text-gray-500">Amazon Web Services<br />
                        ยอด ฿8,750 VAT ฿571.96<br />
                        หมวด: ค่า Software / Cloud</span>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="bg-[#06C755] text-white rounded-xl rounded-tr-sm px-3 py-2">
                        📎 grab_receipt.jpg
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 shrink-0 flex items-center justify-center text-xs">🤖</div>
                      <div className="bg-gray-100 rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%] text-gray-700">
                        ✅ บันทึกเรียบร้อย<br />
                        <span className="text-gray-500">Grab (Thailand)<br />
                        ยอด ฿450 VAT ฿29.44<br />
                        หมวด: ค่าเดินทาง</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────── */}
      <section id="how" className="py-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-indigo-600 font-bold text-sm tracking-widest uppercase mb-3">วิธีการทำงาน</p>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">3 ขั้นตอน ปิดงานบัญชีทั้งเดือน</h2>
          <p className="text-gray-500 max-w-xl mx-auto mb-14">ไม่ต้องเรียนรู้ใหม่ ไม่ต้องเปลี่ยนพฤติกรรม แค่ส่งเอกสาร ระบบจัดการให้ครบ</p>
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="relative bg-white border border-gray-100 rounded-2xl p-8 text-left shadow-sm hover:shadow-md transition-shadow">
                {i < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2 z-10 text-gray-300 text-xl">→</div>
                )}
                <div className="text-4xl mb-4">{step.icon}</div>
                <div className="text-xs font-black text-indigo-500 tracking-widest mb-2">{step.step}</div>
                <h3 className="font-black text-gray-900 text-lg mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────── */}
      <section id="features" className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-indigo-600 font-bold text-sm tracking-widest uppercase mb-3">ฟีเจอร์ทั้งหมด</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">ครบจบในที่เดียว ไม่ใช่แค่เก็บไฟล์</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Slippy ไม่ใช่แค่ที่เก็บเอกสาร แต่เป็น Accounting OS ที่พาคุณไปจนถึงตอนยื่นภาษี</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl p-7 border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all group">
                <div className="mb-4 drop-shadow-sm group-hover:scale-105 transition-transform duration-200 inline-block">
                  <FeatureIcon id={f.id} />
                </div>
                <h3 className="font-black text-gray-900 text-base mb-2 group-hover:text-indigo-700 transition-colors">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ─────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-indigo-600 font-bold text-sm tracking-widest uppercase mb-3">เปรียบเทียบ</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">ทำไมต้อง Slippy?</h2>
            <p className="text-gray-500">เปรียบเทียบกับการทำมือ และเครื่องมือสแกนใบเสร็จทั่วไป</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-4 font-bold text-gray-700 w-1/2">ฟีเจอร์</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-400">ทำมือ</th>
                  <th className="text-center px-4 py-4 font-bold text-gray-400">สแกนใบเสร็จทั่วไป</th>
                  <th className="text-center px-4 py-4 font-black text-indigo-700">
                    <span className="inline-flex items-center gap-1.5">
                      <LogoMark size={16} /> Slippy
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                    <td className="px-6 py-3.5 font-medium text-gray-700">{row.feature}</td>
                    <td className="text-center px-4 py-3.5">
                      {row.manual ? <span className="text-green-500 text-base">✓</span> : <span className="text-red-300 text-base">✗</span>}
                    </td>
                    <td className="text-center px-4 py-3.5">
                      {row.paypers ? <span className="text-green-500 text-base">✓</span> : <span className="text-red-300 text-base">✗</span>}
                    </td>
                    <td className="text-center px-4 py-3.5">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${row.slippy ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-400"}`}>
                        {row.slippy ? "✓" : "✗"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">* เปรียบเทียบกับเครื่องมือสแกนใบเสร็จทั่วไป ข้อมูล ณ พ.ค. 2026</p>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────── */}
      <section id="testimonials" className="py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-indigo-600 font-bold text-sm tracking-widest uppercase mb-3">รีวิวจากผู้ใช้จริง</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">ธุรกิจหลายร้อยแห่งไว้วางใจ Slippy</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <span key={j} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed flex-1">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────── */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-indigo-600 font-bold text-sm tracking-widest uppercase mb-3">ราคา</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">เลือกแพลนที่เหมาะกับคุณ</h2>
            <p className="text-gray-500">เริ่มต้นฟรี ไม่มีหมดอายุ · อัปเกรดได้เมื่อพร้อม</p>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 items-stretch">
            {LANDING_PLANS.map((plan) => {
              const isHighlight   = plan.highlighted === true
              const isEnterprise  = plan.id === "enterprise"
              const priceLabel    = plan.priceTHB === 0
                ? (isEnterprise ? "ติดต่อ" : "ฟรี")
                : `฿${plan.priceTHB.toLocaleString()}`
              return (
                <div key={plan.id} className={`relative rounded-2xl p-6 flex flex-col border transition-all ${
                  isHighlight
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-2xl shadow-indigo-200 scale-[1.02]"
                    : "bg-white text-gray-900 border-gray-100 shadow-sm hover:shadow-md"
                }`}>
                  {isHighlight && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full text-white text-xs font-black whitespace-nowrap">
                      🔥 แนะนำ
                    </div>
                  )}
                  <div className={`text-xs font-black tracking-widest uppercase mb-3 ${isHighlight ? "text-indigo-200" : "text-indigo-600"}`}>
                    {plan.nameTh}
                  </div>
                  <div className="flex items-end gap-1 mb-2">
                    <span className={`text-3xl font-black ${isHighlight ? "text-white" : "text-gray-900"}`}>{priceLabel}</span>
                    {plan.priceTHB > 0 && (
                      <span className={`text-sm pb-1 ${isHighlight ? "text-indigo-200" : "text-gray-400"}`}>/เดือน</span>
                    )}
                  </div>
                  <p className={`text-xs font-semibold mb-4 ${isHighlight ? "text-indigo-200" : "text-indigo-600"}`}>
                    {plan.docQuota === 0 ? "ไม่จำกัดเอกสาร" : `${plan.docQuota} เอกสาร/เดือน`}
                  </p>
                  <ul className="space-y-2 flex-1 mb-6">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-xs">
                        <span className={`mt-0.5 ${isHighlight ? "text-indigo-200" : "text-indigo-500"}`}>✓</span>
                        <span className={isHighlight ? "text-indigo-50" : "text-gray-600"}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href={isEnterprise ? "mailto:hello@slippy.app?subject=Enterprise" : "/register"}
                    className={`block text-center py-2.5 rounded-xl font-bold text-sm transition-all ${
                      isHighlight
                        ? "bg-white text-indigo-700 hover:bg-indigo-50"
                        : isEnterprise
                          ? "bg-gray-900 text-white hover:bg-gray-800"
                          : "bg-indigo-600 text-white hover:bg-indigo-700"
                    }`}>
                    {isEnterprise ? "ติดต่อทีม" : plan.id === "free" ? "เริ่มฟรี" : "เริ่มต้นใช้งาน"}
                  </Link>
                </div>
              )
            })}
          </div>
          <p className="text-center text-xs text-gray-400 mt-6">
            ทุกแพลนรองรับ PDPA · ชำระรายเดือนหรือรายปี (ประหยัด ~17%) · ยกเลิกได้ทุกเมื่อ
          </p>
        </div>
      </section>

      {/* ── TRUST BADGES ─────────────────── */}
      <section className="py-16 px-6 bg-gradient-to-br from-indigo-950 to-indigo-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black text-white mb-2">ข้อมูลของคุณปลอดภัย</h2>
            <p className="text-indigo-300 text-sm">เราปฏิบัติตามมาตรฐานสากลทุกด้าน</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {TRUST_BADGE_DATA.map((b) => (
              <div key={b.label}
                className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center
                  hover:bg-white/10 hover:border-white/20 transition-all group">
                <div className="flex justify-center mb-3
                  group-hover:scale-105 transition-transform duration-200 drop-shadow-lg">
                  <SecurityIcon id={b.id} size={48} />
                </div>
                <div className="font-black text-white text-sm mb-1">{b.label}</div>
                <div className="text-indigo-300 text-xs leading-snug">{b.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4">
            พร้อมประหยัดเวลา<br />งานบัญชีทุกเดือน?
          </h2>
          <p className="text-gray-500 mb-10">เริ่มต้นฟรี 14 วัน ไม่ต้องใส่บัตรเครดิต ยกเลิกได้ทุกเมื่อ</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="px-10 py-4 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200 hover:-translate-y-0.5">
              ทดลองใช้ฟรีวันนี้ →
            </Link>
            <a href="https://line.me/R/ti/p/@slippy_bot" target="_blank" rel="noopener noreferrer"
              className="px-10 py-4 text-base font-bold text-[#06C755] bg-[#06C755]/8 border border-[#06C755]/20 hover:bg-[#06C755]/12 rounded-2xl transition-all">
              💬 คุยกับเราผ่าน LINE
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────── */}
      <footer className="border-t border-gray-100 bg-gray-50 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <LogoMark size={28} />
                <span className="font-black text-lg text-gray-900">Slippy</span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                AI Accounting OS สำหรับธุรกิจไทย<br />
                บัญชีครบจบ ไม่ต้องพึ่งนักบัญชีทั้งเดือน
              </p>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm mb-4">ผลิตภัณฑ์</div>
              <div className="space-y-2 text-sm text-gray-500">
                <a href="#features"  className="block hover:text-indigo-600 transition-colors">ฟีเจอร์</a>
                <a href="#pricing"   className="block hover:text-indigo-600 transition-colors">ราคา</a>
                <Link href="/login"  className="block hover:text-indigo-600 transition-colors">เข้าสู่ระบบ</Link>
                <Link href="/register" className="block hover:text-indigo-600 transition-colors">สมัครสมาชิก</Link>
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm mb-4">บริษัท</div>
              <div className="space-y-2 text-sm text-gray-500">
                <a href="#" className="block hover:text-indigo-600 transition-colors">เกี่ยวกับเรา</a>
                <a href="#" className="block hover:text-indigo-600 transition-colors">บล็อก</a>
                <a href="#" className="block hover:text-indigo-600 transition-colors">ติดต่อ</a>
              </div>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm mb-4">กฎหมาย</div>
              <div className="space-y-2 text-sm text-gray-500">
                <Link href="/privacy-policy"  className="block hover:text-indigo-600 transition-colors">นโยบายความเป็นส่วนตัว</Link>
                <Link href="/cookie-policy"   className="block hover:text-indigo-600 transition-colors">นโยบาย Cookie</Link>
                <a href="#" className="block hover:text-indigo-600 transition-colors">ข้อกำหนดการใช้งาน</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
            <span>© 2026 Slippy Co., Ltd. บริษัท สลิปปี้ จำกัด · จดทะเบียนในไทย</span>
            <span>🛡️ PDPA Compliant · 🔒 AES-256 Encrypted · ☁️ Google Cloud Asia</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
