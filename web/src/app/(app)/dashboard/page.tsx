/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { getTranslations } from "next-intl/server"
import { createClient }    from "@/lib/supabase/server"
import { getMembership }   from "@/lib/get-membership"
import { formatThb, formatDate, statusColor } from "@/lib/utils"
import {
  FileText, Clock, TrendingUp, ArrowUpRight,
  QrCode, Zap, ChevronRight,
  AlertCircle, CheckCircle2, FileUp, Bell, Inbox,
  FileQuestion, FileBadge, Mail,
} from "lucide-react"
import Link from "next/link"
import { SeedDemoButton }        from "@/components/dashboard/seed-demo-button"
import { DashboardUploadZone }   from "@/components/documents/dashboard-upload-zone"

// ── Thumb map ──────────────────────────────────────────────────────────────────
const THUMB_MAP: Record<string, string> = {
  "7-eleven": "🧾", "ซีพี": "🧾",
  "grab": "🚖",
  "amazon web services": "☁️", "aws": "☁️",
  "การไฟฟ้า": "💡", "mea": "💡",
  "ais": "📶",
  "truemove": "📱", "true": "📱",
  "starbucks": "☕",
  "ptt": "⛽",
  "การประปา": "💧", "mwa": "💧",
  "figma": "🎨",
  "lazada": "📦",
  "mk ": "🍲", "mk r": "🍲",
  "tops": "🛒",
  "studio 7": "📱", "istudio": "📱",
  "property": "🏢", "พร็อพ": "🏢",
  "central": "💳",
  "somtam": "🍜", "ส้มตำ": "🍜",
}
function getDocThumb(name: string | null): string {
  if (!name) return "🧾"
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(THUMB_MAP)) if (lower.includes(k)) return v
  return "🧾"
}

// ── Notification meta ──────────────────────────────────────────────────────────
function notifMeta(type: string): { icon: typeof Bell; color: string; bg: string } {
  switch (type) {
    case "document_approved":  return { icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" }
    case "document_failed":    return { icon: AlertCircle,  color: "text-rose-600 dark:text-rose-400",    bg: "bg-rose-500/10" }
    case "document_duplicate": return { icon: FileBadge,    color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10" }
    case "quota_warning":      return { icon: AlertCircle,  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-500/10" }
    case "integration_sync":   return { icon: Zap,          color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" }
    case "line_received":      return { icon: FileText,     color: "text-[#06C755]",                       bg: "bg-[#06C755]/10" }
    case "email_received":     return { icon: Mail,         color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-500/10" }
    default:                   return { icon: Bell,         color: "text-brand-600 dark:text-brand-300",   bg: "bg-brand-500/10" }
  }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return "เมื่อกี้"
  if (m < 60) return `${m} นาทีที่แล้ว`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ชม.ที่แล้ว`
  const d = Math.floor(h / 24)
  return d === 1 ? "เมื่อวาน" : `${d} วันที่แล้ว`
}

function momLabel(cur: number, prev: number): { text: string; color: string } {
  if (prev === 0) return { text: "เดือนนี้", color: "text-muted-foreground" }
  const pct = ((cur - prev) / prev) * 100
  const sign = pct >= 0 ? "+" : ""
  const color = pct >= 0 ? "text-emerald-500" : "text-rose-500"
  return { text: `${sign}${pct.toFixed(0)}% vs เดือนก่อน`, color }
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const t      = await getTranslations("dashboard")
  const tDocs  = await getTranslations("documents")
  const supabase = await createClient()

  const { organization_id: orgId } = await getMembership()

  const { data: org } = await supabase
    .from("organizations")
    .select("name, doc_used, doc_quota, plan, slug")
    .eq("id", orgId)
    .single()

  const orgSlug = org?.slug ?? ""

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    { count: totalDocs },
    { count: pendingDocs },
    { data: monthlyExpense },
    { data: prevMonthExpense },
    { data: recentDocs },
    { data: notifications },
  ] = await Promise.all([
    supabase.from("documents").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase.from("documents").select("id", { count: "exact", head: true })
      .eq("organization_id", orgId).eq("status", "reviewing"),
    supabase.from("documents").select("total_amount, vat_amount")
      .eq("organization_id", orgId).in("status", ["approved", "pushed"])
      .gte("created_at", monthStart),
    supabase.from("documents").select("total_amount")
      .eq("organization_id", orgId).in("status", ["approved", "pushed"])
      .gte("created_at", prevStart).lt("created_at", monthStart),
    supabase.from("documents")
      .select("id, vendor_name, total_amount, status, doc_date, doc_type, overall_confidence, source, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("notifications")
      .select("id, type, title, body, read_at, created_at")
      .or(`user_id.eq.${(await supabase.auth.getUser()).data.user?.id ?? ""},organization_id.eq.${orgId}`)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  // ── KPI computations ──────────────────────────────────────────────────────────
  const totalExpense = monthlyExpense?.reduce((s, d) => s + (d.total_amount ?? 0), 0) ?? 0
  const totalVat     = monthlyExpense?.reduce((s, d) => s + (d.vat_amount   ?? 0), 0) ?? 0
  const prevExpense  = prevMonthExpense?.reduce((s, d) => s + (d.total_amount ?? 0), 0) ?? 0
  const prevDocCount = prevMonthExpense?.length ?? 0

  const docMom    = momLabel(monthlyExpense?.length ?? 0, prevDocCount)
  const spendMom  = momLabel(totalExpense, prevExpense)

  const docUsed   = org?.doc_used ?? 0
  const docQuota  = org?.doc_quota ?? 50
  const quotaPct  = Math.min((docUsed / Math.max(docQuota, 1)) * 100, 100)
  const isUnlimited = docQuota >= 99999

  const statCards = [
    {
      label: "เอกสารเดือนนี้",
      value: String(monthlyExpense?.length ?? 0),
      sub:   docMom.text,
      subColor: docMom.color,
      icon: FileText,
      iconBg: "bg-brand-500/10", iconColor: "text-brand-600",
    },
    {
      label: "รอตรวจสอบ",
      value: String(pendingDocs ?? 0),
      sub:   "ต้องการคุณ",
      subColor: "text-amber-500",
      icon: Clock,
      iconBg: "bg-amber-500/10", iconColor: "text-amber-600",
    },
    {
      label: "ยอดรวม",
      value: formatThb(totalExpense),
      sub:   spendMom.text,
      subColor: spendMom.color,
      icon: TrendingUp,
      iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600",
    },
    {
      label: "ภาษีซื้อ (VAT)",
      value: formatThb(totalVat),
      sub:   "ขอคืนได้",
      subColor: "text-purple-500",
      icon: Zap,
      iconBg: "bg-purple-500/10", iconColor: "text-purple-600",
    },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-7 space-y-5 animate-fade-in max-w-[1500px]">

      {/* Page title */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">{t("title")}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {org?.name} · {t("thisMonth")}
          </p>
        </div>
        <SeedDemoButton />
      </div>

      {/* Quota strip card */}
      {org && (
        <div className="rounded-xl border bg-card px-5 py-4 flex items-center gap-4 flex-wrap">
          <div className="h-10 w-10 rounded-[10px] shrink-0 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#8b5cf6,#6366f1,#ec4899)" }}>
            <FileUp className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-sm font-semibold">
                {docUsed} / {isUnlimited ? "∞" : docQuota} เอกสาร
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600">
                {org.plan}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden w-full max-w-xs">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${quotaPct}%`,
                  background: quotaPct > 80
                    ? "linear-gradient(90deg,#f59e0b,#ef4444)"
                    : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                }}
              />
            </div>
          </div>
          <Link href="/billing"
            className="shrink-0 text-xs font-semibold px-4 py-2 rounded-lg
              bg-brand-500 hover:bg-brand-600 text-white transition-colors">
            อัปเกรด
          </Link>
        </div>
      )}

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, subColor, icon: Icon, iconBg, iconColor }) => (
          <div key={label} className="rounded-xl border bg-card p-5 space-y-3">
            <div className={`w-10 h-10 rounded-[10px] ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{label}</p>
              <p className={`text-xs font-medium mt-1 ${subColor}`}>{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 2-column layout */}
      <div className="grid lg:grid-cols-3 gap-5">

        {/* Left 2/3: Upload zone + Recent docs */}
        <div className="lg:col-span-2 space-y-5">
          <DashboardUploadZone orgId={orgId} orgSlug={orgSlug} />

          <div className="rounded-[12px] border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-[15px] font-semibold">{t("recentDocuments")}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">5 รายการล่าสุดที่เข้ามา</p>
              </div>
              <Link href="/documents"
                className="flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline">
                {t("viewAll")} <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>

            {!recentDocs?.length ? (
              <div className="px-5 py-12 text-center text-muted-foreground">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{tDocs("noDocuments")}</p>
                <p className="text-xs mt-1">{tDocs("noDocumentsDesc")}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentDocs.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}/review`}
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-muted/50 transition-colors"
                  >
                    <span className="h-10 w-10 rounded-[10px] bg-muted text-xl flex items-center justify-center shrink-0">
                      {getDocThumb(doc.vendor_name)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium truncate">{doc.vendor_name ?? "—"}</p>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5">{formatDate(doc.doc_date)}</p>
                    </div>
                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{formatThb(doc.total_amount)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(doc.status)}`}>
                        {tDocs(`status.${doc.status}` as any)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1/3: Activity feed + LINE Bot teaser */}
        <div className="space-y-5">

          {/* Activity feed — from notifications table */}
          <div className="rounded-[12px] border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">กิจกรรมล่าสุด</h3>
              <Link href="/notifications"
                className="text-[11px] font-medium text-brand-600 dark:text-brand-400 hover:underline">
                ดูทั้งหมด
              </Link>
            </div>
            <div className="p-2 space-y-0.5">
              {!notifications?.length ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <Inbox className="w-8 h-8 opacity-40" />
                  <p className="text-[12px]">ยังไม่มีกิจกรรม</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const { icon: Icon, color, bg } = notifMeta(n.type)
                  return (
                    <Link key={n.id} href="/notifications"
                      className="flex gap-3 p-2.5 rounded-[8px] hover:bg-muted/50 transition">
                      <span className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="text-[11.5px] text-muted-foreground leading-snug truncate">{n.body}</p>
                        )}
                      </div>
                      <span className="text-[10.5px] text-muted-foreground shrink-0 whitespace-nowrap">
                        {relTime(n.created_at)}
                      </span>
                    </Link>
                  )
                })
              )}
            </div>
          </div>

          {/* LINE Bot teaser card */}
          <div className="rounded-xl border bg-card overflow-hidden relative glow-radial">
            <div className="px-5 py-5 relative z-10">
              <div className="w-10 h-10 rounded-[10px] bg-[#06C755] flex items-center justify-center mb-3">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-semibold text-sm mb-1">เชื่อมต่อ LINE Bot</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                ถ่ายรูปสลิปส่งผ่าน LINE ได้เลย AI จัดการทุกอย่างอัตโนมัติ
              </p>
              <Link
                href="/settings/integrations"
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:underline"
              >
                ดูวิธีเชื่อมต่อ
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
