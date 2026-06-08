"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Brain, TrendingUp, MapPin, Users, Briefcase, Star,
  Sparkles, RefreshCw, ChevronRight, Loader2, Plus,
  BarChart3, Target, Calendar, Clock, AlertCircle,
  CheckCircle, Lightbulb, Heart,
} from "lucide-react"

/* ─── Types ────────────────────────────────────────────────────────────────── */
interface Merchant { id: string; name: string; category: string | null; visit_count: number; total_spent: number; avg_amount: number }
interface LifeEvent { id: string; event_type: string; amount: number; description: string; occurred_at: string; doc_category: string | null; life_merchants: { name: string } | null }
interface Insight { id: string; insight_type: string; title: string; body: string; data: any; priority: number }
interface Journey { id: string; title: string; journey_type: string; cover_emoji: string; started_at: string | null; ended_at: string | null; destination: string | null; expense_count: number; total_spent: number }
interface LifeScore { overall: number; wealth: number; journey: number; doc_count: number }

interface GraphData {
  merchants:  Merchant[]
  events:     LifeEvent[]
  insights:   Insight[]
  journeys:   Journey[]
  summary:    { total_spent: number; event_count: number; by_category: Record<string, number>; period_days: number }
  life_score: LifeScore
}

const fmtTHB = (n: number) => "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 })

const INSIGHT_ICON: Record<string, React.ReactNode> = {
  spending:       <BarChart3 className="w-4 h-4" />,
  habit:          <Heart className="w-4 h-4" />,
  anomaly:        <AlertCircle className="w-4 h-4" />,
  recommendation: <Lightbulb className="w-4 h-4" />,
  milestone:      <Star className="w-4 h-4" />,
}

const INSIGHT_COLOR: Record<string, string> = {
  spending:       "text-brand-600 bg-brand-50 dark:bg-brand-500/10",
  habit:          "text-rose-600 bg-rose-50 dark:bg-rose-500/10",
  anomaly:        "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
  recommendation: "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10",
  milestone:      "text-violet-600 bg-violet-50 dark:bg-violet-500/10",
}

const CAT_EMOJI: Record<string, string> = {
  consumer_receipt: "🍽️", receipt: "📄", tax_invoice_full: "📋",
  tax_invoice_simplified: "🧾", receipt_with_tax: "🧾", invoice: "📩", other: "📁",
}

/* ─── Score Ring ───────────────────────────────────────────────────────────── */
function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const r    = size / 2 - 8
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444"

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div className="flex flex-col items-center -mt-14">
        <span className="text-2xl font-black">{score}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

/* ─── Journey Card ─────────────────────────────────────────────────────────── */
function JourneyCard({ journey }: { journey: Journey }) {
  const dur = journey.started_at && journey.ended_at
    ? Math.ceil((new Date(journey.ended_at).getTime() - new Date(journey.started_at).getTime()) / 86400000)
    : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors rounded-xl">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">
        {journey.cover_emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{journey.title}</p>
        <p className="text-xs text-muted-foreground">
          {journey.destination && `📍 ${journey.destination} · `}
          {dur ? `${dur} วัน` : journey.started_at ? new Date(journey.started_at).toLocaleDateString("th-TH", { month: "short", day: "numeric" }) : "—"}
        </p>
      </div>
      <div className="text-right shrink-0">
        {journey.total_spent > 0 && <p className="text-sm font-semibold">{fmtTHB(journey.total_spent)}</p>}
        {journey.expense_count > 0 && <p className="text-xs text-muted-foreground">{journey.expense_count} รายการ</p>}
      </div>
    </div>
  )
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export function LifeClient({ orgId }: { orgId: string }) {
  const [data,       setData]       = useState<GraphData | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [period,     setPeriod]     = useState(30)
  const [tab,        setTab]        = useState<"overview"|"merchants"|"journeys"|"insights">("overview")

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/life/graph?orgId=${orgId}&period=${period}`)
      if (res.ok) setData(await res.json())
    } catch { toast.error("โหลดข้อมูลไม่สำเร็จ") }
    finally   { setLoading(false) }
  }

  useEffect(() => { load() }, [period])

  const generateInsights = async () => {
    setGenerating(true)
    try {
      const res = await fetch("/api/life/insights", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      })
      if (res.ok) { await load(); toast.success("สร้าง Insights ใหม่แล้ว ✨") }
    } catch { toast.error("สร้าง Insights ไม่สำเร็จ") }
    finally   { setGenerating(false) }
  }

  const markInsightRead = async (id: string) => {
    await fetch("/api/life/insights", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId: id }),
    })
    setData(d => !d ? d : { ...d, insights: d.insights.filter(i => i.id !== id) })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const score  = data?.life_score
  const summary = data?.summary

  return (
    <div className="p-6 lg:p-7 max-w-[1200px] animate-fade-in">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Life Graph</h2>
            <p className="text-sm text-muted-foreground">ภาพรวมชีวิตดิจิทัลของคุณ — Wealth · Journey · Social</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex p-0.5 bg-muted rounded-[10px] gap-0.5">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={cn("h-7 px-3 rounded-[7px] text-xs font-medium transition-colors",
                  period === d ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}>
                {d} วัน
              </button>
            ))}
          </div>
          <button onClick={generateInsights} disabled={generating}
            className="h-9 px-3 rounded-[10px] border bg-card hover:bg-muted text-sm font-medium transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI Insights
          </button>
          <button onClick={load} className="h-9 w-9 rounded-[10px] border bg-card hover:bg-muted flex items-center justify-center text-muted-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Life Score Hero ── */}
      {score && (
        <div className="rounded-xl border bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/5 dark:to-indigo-500/5 p-6 mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Life Score</p>
          <div className="flex items-center gap-8 flex-wrap">
            <div className="relative">
              <ScoreRing score={score.overall} label="Overall" size={100} />
            </div>
            <div className="flex gap-6 flex-wrap">
              <ScoreRing score={score.wealth}  label="Wealth"  size={70} />
              <ScoreRing score={score.journey} label="Journey" size={70} />
              <ScoreRing score={Math.min(Math.round((data?.journeys.length ?? 0) * 25), 100)} label="Social" size={70} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm text-muted-foreground">
                {score.overall >= 70 ? "🌟 ชีวิตดิจิทัลของคุณสมบูรณ์มาก" :
                 score.overall >= 50 ? "📈 กำลังสร้างฐานข้อมูลที่ดี" :
                 "🌱 เริ่มต้นดี — ยิ่งใช้มาก Life Graph ยิ่งฉลาด"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{score.doc_count} เอกสารในระบบ</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 border-b mb-6">
        {[
          { id: "overview",   label: "ภาพรวม",      icon: BarChart3  },
          { id: "merchants",  label: "ร้านค้า",      icon: TrendingUp },
          { id: "journeys",   label: "การเดินทาง",   icon: MapPin     },
          { id: "insights",   label: `Insights ${data?.insights.length ? `(${data.insights.length})` : ""}`, icon: Lightbulb },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("flex items-center gap-1.5 px-4 h-10 text-[13.5px] font-medium border-b-2 -mb-px transition whitespace-nowrap",
              tab === t.id ? "border-brand-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Spending summary */}
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              ค่าใช้จ่าย {period} วัน
            </h3>
            <p className="text-3xl font-black mb-4">{fmtTHB(summary?.total_spent ?? 0)}</p>
            <div className="space-y-2.5">
              {Object.entries(summary?.by_category ?? {})
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, amount]) => {
                  const pct = summary?.total_spent ? (amount / summary.total_spent) * 100 : 0
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>{CAT_EMOJI[cat] ?? "📁"} {cat}</span>
                        <span className="font-medium">{fmtTHB(amount)} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Recent events */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-3.5 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> กิจกรรมล่าสุด
              </h3>
              <span className="text-xs text-muted-foreground">{summary?.event_count} รายการ</span>
            </div>
            <div className="divide-y max-h-64 overflow-y-auto">
              {(data?.events ?? []).slice(0, 10).map(e => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="text-lg shrink-0">{CAT_EMOJI[e.doc_category ?? ""] ?? "📁"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{e.life_merchants?.name ?? e.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.occurred_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</p>
                  </div>
                  <p className="text-sm font-semibold shrink-0">{fmtTHB(Number(e.amount))}</p>
                </div>
              ))}
              {!data?.events.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">อนุมัติเอกสารเพื่อดูกิจกรรม</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Merchants Tab ── */}
      {tab === "merchants" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="px-5 py-3">ร้านค้า</th>
                  <th className="px-4 py-3 text-right">ครั้ง</th>
                  <th className="px-4 py-3 text-right">ยอดรวม</th>
                  <th className="px-4 py-3 text-right">เฉลี่ย</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.merchants ?? []).map((m, i) => (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium">{m.name}</p>
                          {m.category && <p className="text-xs text-muted-foreground">{m.category}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.visit_count}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtTHB(Number(m.total_spent))}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{fmtTHB(Number(m.avg_amount))}</td>
                  </tr>
                ))}
                {!data?.merchants.length && (
                  <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">ยังไม่มีข้อมูลร้านค้า</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Journeys Tab ── */}
      {tab === "journeys" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <a href="/life/journey/new"
              className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> บันทึกการเดินทาง
            </a>
          </div>
          {data?.journeys.length ? (
            <div className="rounded-xl border bg-card overflow-hidden divide-y">
              {data.journeys.map(j => <JourneyCard key={j.id} journey={j} />)}
            </div>
          ) : (
            <div className="rounded-xl border bg-card flex flex-col items-center py-14 text-center">
              <div className="text-4xl mb-3">🗺️</div>
              <p className="font-medium">ยังไม่มีการเดินทาง</p>
              <p className="text-sm text-muted-foreground mt-1">บันทึกทริปของคุณเพื่อเชื่อมค่าใช้จ่ายกับประสบการณ์</p>
            </div>
          )}
        </div>
      )}

      {/* ── Insights Tab ── */}
      {tab === "insights" && (
        <div className="space-y-3">
          {data?.insights.length ? (
            <>
              <div className="flex justify-end">
                <button onClick={() => fetch("/api/life/insights", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markAllRead: true, orgId }) }).then(() => setData(d => d ? { ...d, insights: [] } : d))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  ทำเครื่องหมายทั้งหมดว่าอ่านแล้ว
                </button>
              </div>
              {data.insights.map(ins => (
                <div key={ins.id} className="rounded-xl border bg-card p-4 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                  <div className={cn("w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0", INSIGHT_COLOR[ins.insight_type])}>
                    {INSIGHT_ICON[ins.insight_type] ?? <Sparkles className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{ins.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ins.body}</p>
                  </div>
                  <button onClick={() => markInsightRead(ins.id)}
                    className="shrink-0 h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center text-muted-foreground">
                    <CheckCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-xl border bg-card flex flex-col items-center py-14 text-center">
              <div className="text-4xl mb-3">💡</div>
              <p className="font-medium">ยังไม่มี Insights</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">กด "AI Insights" เพื่อให้ AI วิเคราะห์พฤติกรรมของคุณ</p>
              <button onClick={generateInsights} disabled={generating}
                className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                สร้าง Insights
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
