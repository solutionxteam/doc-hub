"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * VitaCardClient — Score card + share to Vita Community
 */

import { useState, useCallback, useRef } from "react"
import { toast }                         from "sonner"
import { cn }                            from "@/lib/utils"
import type { VitaScores }               from "@/lib/vita-scores"
import { scoreColor, gradeLabel }        from "@/lib/vita-scores"

// ─── Types ─────────────────────────────────────────────────────────────────

interface SnapshotPoint {
  snapshot_date:   string
  longevity_score: number
  wealth_score:    number
}

interface PersonalProfile {
  display_name:    string | null
  bio:             string | null
  longevity_score: number | null
  wealth_score:    number | null
  is_public:       boolean
  follower_count:  number
}

interface Props {
  scores:  VitaScores
  profile: PersonalProfile | null
  history: SnapshotPoint[]
}

// ─── Radial Progress Ring ──────────────────────────────────────────────────

function ScoreRing({
  score, label, grade, size = 140, strokeWidth = 10,
}: {
  score: number; label: string; grade: string; size?: number; strokeWidth?: number
}) {
  const r    = (size - strokeWidth * 2) / 2
  const circ = 2 * Math.PI * r
  const pct  = Math.max(0, Math.min(score, 100))
  const offset = circ - (pct / 100) * circ
  const cx = size / 2
  const color = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={cx} cy={cx} r={r}
            fill="none" stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/20"
          />
          {/* Progress */}
          <circle cx={cx} cy={cx} r={r}
            fill="none" stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-3xl font-black tracking-tighter leading-none"
            style={{ color }}>{score}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: color }}>{grade}</span>
        </div>
      </div>
      <span className="text-sm font-semibold text-muted-foreground">{label}</span>
    </div>
  )
}

// ─── Mini Bar ──────────────────────────────────────────────────────────────

function MiniBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string
}) {
  const pct = Math.round((value / max) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

// ─── Tiny Sparkline ────────────────────────────────────────────────────────

function Sparkline({ data, color }: {
  data: { date: string; longevity: number; wealth: number }[]
  color: "longevity" | "wealth"
}) {
  if (data.length < 2) return (
    <div className="h-16 flex items-center justify-center text-xs text-muted-foreground opacity-50">
      ยังไม่มีข้อมูลประวัติ
    </div>
  )

  const vals = data.map(d => color === "longevity" ? d.longevity : d.wealth)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1
  const W = 240
  const H = 56
  const pts = vals.map((v, i) => [
    (i / (vals.length - 1)) * W,
    H - ((v - minV) / range) * (H - 8) - 4,
  ])
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ")

  const strokeClr = color === "longevity" ? "#10b981" : "#8b5cf6"

  return (
    <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke={strokeClr} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={strokeClr} />
    </svg>
  )
}

// ─── Main VitaCardClient ──────────────────────────────────────────────────

export function VitaCardClient({ scores, profile, history }: Props) {
  const [shareText, setShareText]   = useState("")
  const [sharing,   setSharing]     = useState(false)
  const [recomputing, setRecomp]    = useState(false)
  const [activeTab, setActiveTab]   = useState<"card" | "detail" | "history">("card")
  const cardRef = useRef<HTMLDivElement>(null)

  const displayName = profile?.display_name ?? "You"
  const isPublic    = profile?.is_public ?? true

  const histData = history.map(h => ({
    date:      h.snapshot_date,
    longevity: Number(h.longevity_score),
    wealth:    Number(h.wealth_score),
  }))

  // Recompute scores from latest data
  const handleRecompute = useCallback(async () => {
    setRecomp(true)
    try {
      const res = await fetch("/api/personal/score", { method: "POST" })
      if (res.ok) {
        toast.success("คำนวณ Vita Score ใหม่แล้ว! รีเฟรชหน้าเพื่อดูคะแนนล่าสุด")
      } else {
        toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่")
      }
    } catch {
      toast.error("เชื่อมต่อไม่ได้ กรุณาลองใหม่")
    } finally {
      setRecomp(false)
    }
  }, [])

  // Share to Vita Community
  const handleShareToVita = useCallback(async () => {
    setSharing(true)
    try {
      const body = shareText.trim() ||
        `🌿 Longevity ${scores.longevityScore}/100 · 💰 Wealth ${scores.wealthScore}/100\n` +
        `เกรด ${scores.longevityGrade} | ${scores.wealthGrade} — Vita by Slippy`

      const res = await fetch("/api/social/posts", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:        "stack",
          title:       `Vita Card — ${displayName}`,
          body,
          is_published: isPublic,
        }),
      })
      if (res.ok) {
        toast.success("แชร์ไปยัง Vita Community แล้ว! 🌿")
        setShareText("")
      } else {
        toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่")
      }
    } catch {
      toast.error("เชื่อมต่อไม่ได้")
    } finally {
      setSharing(false)
    }
  }, [shareText, scores, displayName, isPublic])

  // Copy card link
  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}/vita/${profile?.display_name ?? "me"}`
    navigator.clipboard.writeText(url).then(() => toast.success("คัดลอก Vita Card link แล้ว!"))
  }, [profile])

  // ─── Relationship diagram data ────────────────────────────────────────────
  const longevityBars = [
    { label: "Physical",  value: scores.longevity.physical,  max: 40, color: "#10b981" },
    { label: "Metabolic", value: scores.longevity.metabolic, max: 20, color: "#06b6d4" },
    { label: "Lifestyle", value: scores.longevity.lifestyle, max: 25, color: "#8b5cf6" },
    { label: "Financial", value: scores.longevity.financial, max: 15, color: "#3b82f6" },
  ]
  const wealthBars = [
    { label: "Discipline",     value: scores.wealth.discipline,    max: 30, color: "#8b5cf6" },
    { label: "Goals",          value: scores.wealth.goals,         max: 25, color: "#10b981" },
    { label: "Subscriptions",  value: scores.wealth.subscriptions, max: 15, color: "#f59e0b" },
    { label: "Health Invest",  value: scores.wealth.healthInvest,  max: 15, color: "#06b6d4" },
    { label: "Consistency",    value: scores.wealth.consistency,   max: 15, color: "#ec4899" },
  ]

  return (
    <div className="p-5 lg:p-7 max-w-[1000px] animate-fade-in space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Vita wordmark */}
          <div className="flex items-center gap-1.5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2C7.37 2 2 7.37 2 14s5.37 12 12 12 12-5.37 12-12S20.63 2 14 2z"
                fill="url(#vg)" />
              <path d="M9 10l5 8 5-8" stroke="white" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="vg" x1="2" y1="2" x2="26" y2="26"
                  gradientUnits="userSpaceOnUse">
                  <stop stopColor="#10b981"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-emerald-500 to-violet-500 bg-clip-text text-transparent">
              Vita
            </span>
          </div>
          <span className="text-muted-foreground text-sm">by Slippy</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRecompute}
            disabled={recomputing}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors disabled:opacity-50"
          >
            {recomputing ? "⏳ คำนวณ..." : "🔄 คำนวณใหม่"}
          </button>
          <button
            onClick={handleCopyLink}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            🔗 คัดลอกลิงก์
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-muted/30 p-1 rounded-xl w-fit">
        {(["card", "detail", "history"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "text-xs font-medium px-4 py-1.5 rounded-lg transition-colors",
              activeTab === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "card" ? "🌿 Vita Card" : tab === "detail" ? "📊 รายละเอียด" : "📈 ประวัติ"}
          </button>
        ))}
      </div>

      {/* ══════════════ TAB: CARD ══════════════ */}
      {activeTab === "card" && (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Score Card Visual */}
          <div
            ref={cardRef}
            className="rounded-3xl overflow-hidden relative"
            style={{
              background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #052e16 100%)",
              boxShadow: "0 20px 60px rgba(16,185,129,0.2), 0 8px 32px rgba(139,92,246,0.15)",
            }}
          >
            {/* Background glow blobs */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, #10b981, transparent)" }} />
            <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
              style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />

            <div className="relative p-7 space-y-6">
              {/* Card header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-400 text-xs font-semibold tracking-widest uppercase mb-1">
                    Vita Card
                  </p>
                  <p className="text-white font-bold text-lg">{displayName}</p>
                  {profile?.follower_count ? (
                    <p className="text-white/40 text-xs">{profile.follower_count} followers</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                    <path d="M14 2C7.37 2 2 7.37 2 14s5.37 12 12 12 12-5.37 12-12S20.63 2 14 2z"
                      fill="url(#vg2)" />
                    <path d="M9 10l5 8 5-8" stroke="white" strokeWidth="2.2"
                      strokeLinecap="round" strokeLinejoin="round" />
                    <defs>
                      <linearGradient id="vg2" x1="2" y1="2" x2="26" y2="26"
                        gradientUnits="userSpaceOnUse">
                        <stop stopColor="#10b981"/>
                        <stop offset="1" stopColor="#8b5cf6"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* Scores */}
              <div className="flex items-center justify-center gap-8 py-2">
                <ScoreRing
                  score={scores.longevityScore}
                  label="Longevity"
                  grade={scores.longevityGrade}
                  size={128}
                  strokeWidth={9}
                />
                <div className="flex flex-col items-center gap-1">
                  {/* Connection arrows */}
                  <div className="text-white/30 text-[10px] text-center font-mono">
                    <div>💸→🌿</div>
                    <div className="text-[8px] opacity-60">Financial</div>
                    <div className="text-[8px] opacity-60">stress</div>
                    <div className="mt-1">🌿→💰</div>
                    <div className="text-[8px] opacity-60">Health</div>
                    <div className="text-[8px] opacity-60">invest</div>
                  </div>
                </div>
                <ScoreRing
                  score={scores.wealthScore}
                  label="Wealth"
                  grade={scores.wealthGrade}
                  size={128}
                  strokeWidth={9}
                />
              </div>

              {/* Grade labels */}
              <div className="flex justify-center gap-12 text-center">
                <div>
                  <p className="text-emerald-400 text-xs font-semibold">
                    {gradeLabel(scores.longevityGrade)}
                  </p>
                </div>
                <div>
                  <p className="text-violet-400 text-xs font-semibold">
                    {gradeLabel(scores.wealthGrade)}
                  </p>
                </div>
              </div>

              {/* Insights */}
              {(scores.longevityInsights.length > 0 || scores.wealthInsights.length > 0) && (
                <div className="border-t border-white/10 pt-4 space-y-2">
                  {scores.longevityInsights.slice(0, 2).map((ins, i) => (
                    <p key={i} className="text-white/60 text-[11px] flex gap-1.5 items-start">
                      <span className="text-emerald-400 shrink-0">🌿</span> {ins}
                    </p>
                  ))}
                  {scores.wealthInsights.slice(0, 1).map((ins, i) => (
                    <p key={i} className="text-white/60 text-[11px] flex gap-1.5 items-start">
                      <span className="text-violet-400 shrink-0">💰</span> {ins}
                    </p>
                  ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <p className="text-white/30 text-[10px]">
                  {new Date().toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                </p>
                <p className="text-white/30 text-[10px]">vita.slippy.app</p>
              </div>
            </div>
          </div>

          {/* Share Panel */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold mb-1">แชร์ไปยัง Vita Community</h2>
              <p className="text-xs text-muted-foreground">
                Vita คือ social network ของ Slippy Life สำหรับแชร์ประสบการณ์สุขภาพและการเงิน
              </p>
            </div>

            {/* What does Vita mean? */}
            <div className="rounded-2xl border bg-gradient-to-br from-emerald-50/50 to-violet-50/50 dark:from-emerald-900/10 dark:to-violet-900/10 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vita = ชีวิต ในภาษาละติน
              </p>
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { emoji: "🌿", label: "Longevity", sub: "อายุยืนยาว" },
                  { emoji: "💰", label: "Wealth",    sub: "มั่งคั่ง" },
                  { emoji: "🤝", label: "Community", sub: "ชุมชน" },
                  { emoji: "📋", label: "Verified",  sub: "มีใบเสร็จยืนยัน" },
                ].map(it => (
                  <div key={it.label} className="flex items-center gap-2">
                    <span>{it.emoji}</span>
                    <div>
                      <p className="font-semibold text-foreground">{it.label}</p>
                      <p className="text-muted-foreground">{it.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Post text */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                ข้อความที่จะโพสต์ (ไม่บังคับ)
              </label>
              <textarea
                value={shareText}
                onChange={e => setShareText(e.target.value)}
                placeholder={
                  `🌿 Longevity ${scores.longevityScore}/100 · 💰 Wealth ${scores.wealthScore}/100\n` +
                  `เกรด ${scores.longevityGrade} | ${scores.wealthGrade}\n\n` +
                  `เขียนบทสรุปของคุณที่นี่...`
                }
                rows={4}
                className="w-full text-sm rounded-xl border bg-muted/20 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleShareToVita}
                disabled={sharing}
                className={cn(
                  "w-full py-3 rounded-xl text-sm font-bold text-white transition-all",
                  "bg-gradient-to-r from-emerald-500 to-violet-600",
                  "hover:opacity-90 active:scale-[0.98] disabled:opacity-50",
                  "shadow-lg shadow-emerald-500/20"
                )}
              >
                {sharing ? "⏳ กำลังโพสต์..." : "🌿 แชร์ Vita Card ไปยัง Community"}
              </button>
              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 rounded-xl text-sm font-medium border border-border hover:bg-muted/40 transition-colors"
              >
                🔗 คัดลอก Vita Card Link
              </button>
            </div>

            {/* Phase note */}
            <div className="rounded-xl bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-700/30 p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-0.5">
                🚀 Phase 2: Slippy Life
              </p>
              <p className="text-xs text-muted-foreground">
                Vita Community จะเปิดตัวเป็น standalone social platform เมื่อ Slippy Life launch —
                ข้อมูลทุกอย่างที่คุณบันทึกตอนนี้จะถูกนำมาสร้าง profile ของคุณโดยอัตโนมัติ
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TAB: DETAIL ══════════════ */}
      {activeTab === "detail" && (
        <div className="grid sm:grid-cols-2 gap-6">

          {/* Longevity breakdown */}
          <div className="rounded-2xl border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <span className="text-sm">🌿</span>
              </div>
              <div>
                <h3 className="font-bold text-sm">Longevity Score</h3>
                <p className="text-xs text-muted-foreground">
                  {scores.longevityScore}/100 — {gradeLabel(scores.longevityGrade)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {longevityBars.map(b => (
                <MiniBar key={b.label} {...b} />
              ))}
            </div>

            <div className="border-t pt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">💡 สิ่งที่ควรปรับปรุง</p>
              {scores.longevityInsights.map((ins, i) => (
                <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-emerald-500 shrink-0">•</span> {ins}
                </p>
              ))}
            </div>
          </div>

          {/* Wealth breakdown */}
          <div className="rounded-2xl border p-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                <span className="text-sm">💰</span>
              </div>
              <div>
                <h3 className="font-bold text-sm">Wealth Score</h3>
                <p className="text-xs text-muted-foreground">
                  {scores.wealthScore}/100 — {gradeLabel(scores.wealthGrade)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {wealthBars.map(b => (
                <MiniBar key={b.label} {...b} />
              ))}
            </div>

            <div className="border-t pt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">💡 สิ่งที่ควรปรับปรุง</p>
              {scores.wealthInsights.map((ins, i) => (
                <p key={i} className="text-xs text-muted-foreground flex gap-1.5">
                  <span className="text-violet-500 shrink-0">•</span> {ins}
                </p>
              ))}
            </div>
          </div>

          {/* Relationship diagram */}
          <div className="sm:col-span-2 rounded-2xl border p-5">
            <h3 className="text-sm font-bold mb-3">🔄 ความสัมพันธ์ระหว่าง Longevity ↔ Wealth</h3>
            <div className="grid sm:grid-cols-2 gap-4 text-xs text-muted-foreground">
              {[
                {
                  dir: "💰 → 🌿",
                  title: "Wealth feeds Longevity",
                  desc: `Wealth score ${scores.wealthScore}/100 → คะแนน Financial component ${scores.longevity.financial}/15 ในด้าน Longevity — ความมั่นคงทางการเงินลด stress และส่งเสริมสุขภาพ`
                },
                {
                  dir: "🌿 → 💰",
                  title: "Longevity feeds Wealth",
                  desc: `การลงทุนด้านสุขภาพ ${scores.wealth.healthInvest.toFixed(1)}/15 คะแนนใน Wealth — ใบเสร็จฟิตเนส, อาหารสุขภาพ, supplement ช่วยเพิ่ม Wealth score`
                },
              ].map(rel => (
                <div key={rel.dir} className="rounded-xl bg-muted/30 p-4 space-y-2">
                  <p className="font-mono font-bold text-sm text-foreground">{rel.dir}</p>
                  <p className="font-semibold text-foreground text-[11px]">{rel.title}</p>
                  <p>{rel.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ TAB: HISTORY ══════════════ */}
      {activeTab === "history" && (
        <div className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            {(["longevity", "wealth"] as const).map(type => (
              <div key={type} className="rounded-2xl border p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold capitalize">
                    {type === "longevity" ? "🌿 Longevity Score" : "💰 Wealth Score"}
                  </h3>
                  <span className="text-2xl font-black"
                    style={{ color: type === "longevity" ? "#10b981" : "#8b5cf6" }}>
                    {type === "longevity" ? scores.longevityScore : scores.wealthScore}
                  </span>
                </div>
                <Sparkline data={histData} color={type} />
                {histData.length < 2 && (
                  <p className="text-xs text-muted-foreground">
                    กด "คำนวณใหม่" ทุกวันเพื่อสร้างกราฟประวัติ
                  </p>
                )}
              </div>
            ))}
          </div>

          {histData.length > 0 && (
            <div className="rounded-2xl border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left p-3 font-semibold text-muted-foreground">วันที่</th>
                    <th className="text-right p-3 font-semibold text-emerald-600">Longevity</th>
                    <th className="text-right p-3 font-semibold text-violet-600">Wealth</th>
                  </tr>
                </thead>
                <tbody>
                  {[...histData].reverse().slice(0, 14).map((row, i) => (
                    <tr key={row.date} className={cn("border-b last:border-0", i % 2 === 0 && "bg-muted/10")}>
                      <td className="p-3 text-muted-foreground">
                        {new Date(row.date).toLocaleDateString("th-TH", { month: "short", day: "numeric" })}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-600">{row.longevity}</td>
                      <td className="p-3 text-right font-bold text-violet-600">{row.wealth}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
