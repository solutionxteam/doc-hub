"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import Link from "next/link"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Heart, Target, Bell, Wallet, Leaf, Calendar } from "lucide-react"

/* ─── Types ───────────────────────────────────────────────────────────────── */

export interface PersonalProfile {
  display_name:    string | null
  bio:             string | null
  longevity_score: number | null
  wealth_score:    number | null
  is_public:       boolean
  follower_count:  number
  following_count: number
}

export interface PersonalOverviewClientProps {
  profile:            PersonalProfile | null
  thisMonthSpend:     number
  lastMonthSpend:     number
  healthEntriesCount: number
  activeGoalsCount:   number
  pendingSubsCount:   number
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const fmtTHB = (n: number) =>
  "฿" + n.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className="rotate-[-90deg]">
      <circle cx={28} cy={28} r={r} fill="none" stroke="currentColor" strokeWidth={5} className="text-black/10 dark:text-white/10" />
      <circle
        cx={28} cy={28} r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  )
}

/* ─── Quick-stat card ─────────────────────────────────────────────────────── */

function StatCard({
  label, value, sub, icon: Icon, iconColor, iconBg,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex flex-col gap-3">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", iconBg)}>
        <Icon className={cn("w-4 h-4", iconColor)} />
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
      </div>
    </div>
  )
}

/* ─── Feature card ────────────────────────────────────────────────────────── */

function FeatureCard({
  href, gradient, emoji, title, subtitle, meta,
}: {
  href:     string
  gradient: string
  emoji:    string
  title:    string
  subtitle: string
  meta:     React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative rounded-2xl overflow-hidden p-6 flex flex-col justify-between min-h-[180px]",
        "transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]",
        gradient,
      )}
    >
      {/* Decorative blob */}
      <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/10 blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between">
        <span className="text-3xl">{emoji}</span>
        <span className="text-white/60 text-xs font-medium bg-white/10 px-2 py-0.5 rounded-full">
          เปิดดู →
        </span>
      </div>

      <div className="mt-auto">
        <h3 className="text-white font-bold text-lg leading-tight">{title}</h3>
        <p className="text-white/70 text-xs mt-1">{subtitle}</p>
        <div className="mt-3 text-white/90 text-sm font-medium">{meta}</div>
      </div>
    </Link>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function PersonalOverviewClient({
  profile,
  thisMonthSpend,
  lastMonthSpend,
  healthEntriesCount,
  activeGoalsCount,
  pendingSubsCount,
}: PersonalOverviewClientProps) {
  const wealthScore    = profile?.wealth_score    ?? 0
  const longevityScore = profile?.longevity_score ?? 0
  const displayName    = profile?.display_name    ?? "คุณ"

  const spendDelta      = thisMonthSpend - lastMonthSpend
  const spendDeltaPct   = lastMonthSpend > 0
    ? Math.round(Math.abs(spendDelta / lastMonthSpend) * 100)
    : 0
  const spendUp         = spendDelta > 0

  return (
    <div className="p-6 lg:p-7 max-w-[1100px] animate-fade-in">

      {/* ── Page Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Personal Space</h2>
            <p className="text-muted-foreground text-sm">จัดการชีวิตในทุกมิติ</p>
          </div>
        </div>
        {profile?.bio && (
          <p className="mt-3 text-sm text-muted-foreground bg-muted/40 rounded-xl px-4 py-2.5 border border-border/50 max-w-lg">
            {profile.bio}
          </p>
        )}
      </div>

      {/* ── Greeting banner ── */}
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, white 0%, transparent 60%)" }} />
        <p className="text-sm font-medium text-white/80 mb-1">ยินดีต้อนรับ, {displayName}</p>
        <p className="text-xl font-bold">ชีวิตคุณดีแค่ไหนวันนี้?</p>
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <ScoreRing score={wealthScore} color="#34d399" />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white rotate-90">
                {wealthScore}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-white/60">Wealth Score</p>
              <p className="font-semibold">{wealthScore}/100</p>
            </div>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <ScoreRing score={longevityScore} color="#a7f3d0" />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white rotate-90">
                {longevityScore}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-white/60">Longevity Score</p>
              <p className="font-semibold">{longevityScore}/100</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Wealth Score"
          value={wealthScore.toString()}
          sub="คะแนนสุขภาพการเงิน"
          icon={Wallet}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100 dark:bg-emerald-500/15"
        />
        <StatCard
          label="Longevity Score"
          value={longevityScore.toString()}
          sub="คะแนนสุขภาพร่างกาย"
          icon={Heart}
          iconColor="text-teal-600"
          iconBg="bg-teal-100 dark:bg-teal-500/15"
        />
        <StatCard
          label="เป้าหมายที่ active"
          value={activeGoalsCount.toString()}
          sub="กำลังดำเนินการ"
          icon={Target}
          iconColor="text-sky-600"
          iconBg="bg-sky-100 dark:bg-sky-500/15"
        />
        <StatCard
          label="Subscription รอยืนยัน"
          value={pendingSubsCount.toString()}
          sub="ตรวจสอบด่วน"
          icon={Bell}
          iconColor="text-amber-600"
          iconBg="bg-amber-100 dark:bg-amber-500/15"
        />
      </div>

      {/* ── Feature cards ── */}
      <div className="grid sm:grid-cols-3 gap-4">
        <FeatureCard
          href="/personal/wealth"
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          emoji="💰"
          title="Wealth Tracker"
          subtitle="ติดตามการใช้จ่ายส่วนตัว"
          meta={
            <div className="flex items-center gap-2">
              <span>{fmtTHB(thisMonthSpend)} เดือนนี้</span>
              {lastMonthSpend > 0 && (
                <span className={cn(
                  "text-[11px] px-1.5 py-0.5 rounded-full font-semibold",
                  spendUp ? "bg-red-500/20 text-red-200" : "bg-emerald-300/20 text-emerald-100"
                )}>
                  {spendUp ? <TrendingUp className="inline w-2.5 h-2.5 mr-0.5" /> : <TrendingDown className="inline w-2.5 h-2.5 mr-0.5" />}
                  {spendDeltaPct}%
                </span>
              )}
            </div>
          }
        />
        <FeatureCard
          href="/personal/health"
          gradient="bg-gradient-to-br from-teal-500 to-cyan-700"
          emoji="🌿"
          title="Health & Longevity"
          subtitle="บันทึก biomarker และ score สุขภาพ"
          meta={
            <span>
              {healthEntriesCount} รายการ ใน 30 วัน
            </span>
          }
        />
        <FeatureCard
          href="/personal/planner"
          gradient="bg-gradient-to-br from-sky-500 to-indigo-600"
          emoji="📅"
          title="Life Planner"
          subtitle="เป้าหมายการเงิน · subscription tracker"
          meta={
            <span>
              {activeGoalsCount} เป้าหมาย · {pendingSubsCount} subscription รอยืนยัน
            </span>
          }
        />
      </div>

    </div>
  )
}
