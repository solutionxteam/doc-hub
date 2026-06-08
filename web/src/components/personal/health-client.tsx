"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Plus, X, Heart, ChevronLeft } from "lucide-react"
import Link from "next/link"
import type { HealthEntry } from "@/app/(app)/personal/health/page"

/* ─── Types ───────────────────────────────────────────────────────────────── */

export interface HealthClientProps {
  entries:        HealthEntry[]
  longevityScore: number
}

/* ─── Constants ───────────────────────────────────────────────────────────── */

const TYPE_UNITS: Record<string, string> = {
  weight:                   "kg",
  blood_pressure_systolic:  "mmHg",
  blood_pressure_diastolic: "mmHg",
  blood_glucose:            "mg/dL",
  steps:                    "steps",
  sleep_hours:              "ชั่วโมง",
  heart_rate:               "bpm",
  water_ml:                 "ml",
  calories:                 "kcal",
}

const TYPE_LABELS: Record<string, string> = {
  weight:                   "น้ำหนัก",
  blood_pressure_systolic:  "ความดันโลหิต (ตัวบน)",
  blood_pressure_diastolic: "ความดันโลหิต (ตัวล่าง)",
  blood_glucose:            "น้ำตาลในเลือด",
  steps:                    "ก้าวเดิน",
  sleep_hours:              "ชั่วโมงนอน",
  heart_rate:               "อัตราการเต้นหัวใจ",
  water_ml:                 "น้ำที่ดื่ม",
  calories:                 "แคลอรี่",
}

const TYPE_EMOJIS: Record<string, string> = {
  weight:                   "⚖️",
  blood_pressure_systolic:  "❤️",
  blood_pressure_diastolic: "💙",
  blood_glucose:            "🩸",
  steps:                    "👟",
  sleep_hours:              "😴",
  heart_rate:               "💓",
  water_ml:                 "💧",
  calories:                 "🔥",
}

const QUICK_LOG_TYPES = ["weight", "steps", "sleep_hours", "heart_rate", "water_ml"]

/* ─── Longevity Score gauge ───────────────────────────────────────────────── */

function ScoreGauge({ score }: { score: number }) {
  const r    = 70
  const circ = 2 * Math.PI * r
  const arc  = circ * 0.75 // 270° arc
  const offset = arc - (score / 100) * arc

  const getColor = (s: number) => {
    if (s >= 80) return "#10b981"
    if (s >= 60) return "#14b8a6"
    if (s >= 40) return "#f59e0b"
    return "#f87171"
  }

  const color = getColor(score)

  const label =
    score >= 80 ? "ยอดเยี่ยม" :
    score >= 60 ? "ดี" :
    score >= 40 ? "พอใช้" : "ต้องปรับปรุง"

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-44 h-44">
        <svg viewBox="0 0 180 180" className="w-full h-full -rotate-[135deg]">
          <circle
            cx={90} cy={90} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={12}
            strokeDasharray={`${arc} ${circ - arc}`}
            strokeLinecap="round"
            className="text-muted/40"
          />
          <circle
            cx={90} cy={90} r={r}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeDasharray={`${arc - offset} ${circ - (arc - offset)}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
            style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span className="text-4xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div
        className="mt-1 text-sm font-semibold px-3 py-0.5 rounded-full"
        style={{ backgroundColor: color + "20", color }}
      >
        {label}
      </div>
    </div>
  )
}

/* ─── Add entry modal ─────────────────────────────────────────────────────── */

function AddEntryModal({
  onClose,
  onAdd,
  initialType,
}: {
  onClose:      () => void
  onAdd:        (entry: HealthEntry) => void
  initialType?: string
}) {
  const [type,    setType]    = useState(initialType ?? "weight")
  const [value,   setValue]   = useState("")
  const [notes,   setNotes]   = useState("")
  const [date,    setDate]    = useState(new Date().toISOString().split("T")[0])
  const [loading, setLoading] = useState(false)

  const unit = TYPE_UNITS[type] ?? ""

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!value) { toast.error("กรุณากรอกค่า"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/personal/health", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          value:       Number(value),
          unit,
          notes:       notes.trim() || null,
          recorded_at: new Date(date).toISOString(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "เกิดข้อผิดพลาด")
      onAdd({
        id:          data.id ?? crypto.randomUUID(),
        type,
        value:       Number(value),
        unit,
        notes:       notes.trim() || null,
        recorded_at: new Date(date).toISOString(),
      })
      toast.success("บันทึกข้อมูลสุขภาพแล้ว")
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "เกิดข้อผิดพลาด"
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-[16px] shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-[17px] font-semibold">บันทึกข้อมูลสุขภาพ</h3>
              <p className="text-xs text-muted-foreground mt-0.5">บันทึก biomarker ของคุณ</p>
            </div>
            <button onClick={onClose} className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">ประเภท</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition"
              >
                {Object.entries(TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{TYPE_EMOJIS[key]} {label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">ค่า *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder="กรอกค่า"
                  className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                    outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition"
                />
              </div>
              <div className="w-24">
                <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">หน่วย</label>
                <div className="h-10 px-3 rounded-[10px] border border-border bg-muted/30 text-sm flex items-center text-muted-foreground">
                  {unit}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">วันที่บันทึก</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition"
              />
            </div>

            <div>
              <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">หมายเหตุ</label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="หมายเหตุเพิ่มเติม (ไม่จำเป็น)"
                className="w-full h-10 px-3 rounded-[10px] border border-border bg-background text-sm
                  outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-[10px] hover:bg-muted text-sm font-medium transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={loading}
                className="h-9 px-5 rounded-[10px] bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {loading ? "กำลังบันทึก..." : "บันทึก"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ─── Main component ──────────────────────────────────────────────────────── */

export function HealthClient({ entries: initialEntries, longevityScore }: HealthClientProps) {
  const [entries,     setEntries]     = useState<HealthEntry[]>(initialEntries)
  const [showModal,   setShowModal]   = useState(false)
  const [quickType,   setQuickType]   = useState<string | undefined>(undefined)

  const handleAdd = (entry: HealthEntry) => {
    setEntries(prev => [entry, ...prev])
  }

  const openQuickLog = (type: string) => {
    setQuickType(type)
    setShowModal(true)
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  const recent = entries.slice(0, 10)

  return (
    <div className="p-6 lg:p-7 max-w-[960px] animate-fade-in">

      {/* ── Header ── */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            href="/personal"
            className="h-9 w-9 rounded-[10px] border border-border hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center">
            <Heart className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Health & Longevity</h2>
            <p className="text-muted-foreground text-sm">บันทึก biomarker และ score สุขภาพ</p>
          </div>
        </div>
        <button
          onClick={() => { setQuickType(undefined); setShowModal(true) }}
          className="h-9 px-4 rounded-[10px] bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium
            transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> บันทึกข้อมูล
        </button>
      </div>

      {/* ── Longevity Score ── */}
      <div className="rounded-2xl border bg-card p-6 mb-6 flex flex-col sm:flex-row items-center gap-6">
        <ScoreGauge score={longevityScore} />
        <div className="flex-1">
          <h3 className="text-lg font-bold mb-1">Longevity Score</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Score นี้คำนวณจากความสม่ำเสมอในการบันทึก biomarker และข้อมูลสุขภาพ
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xl font-bold">{entries.length}</p>
              <p className="text-xs text-muted-foreground">รายการ 30 วัน</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xl font-bold">
                {new Set(entries.map(e => e.type)).size}
              </p>
              <p className="text-xs text-muted-foreground">ประเภทที่บันทึก</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick-log buttons ── */}
      <div className="rounded-2xl border bg-card p-5 mb-6">
        <h3 className="text-sm font-semibold mb-3">บันทึกด่วน</h3>
        <div className="flex flex-wrap gap-2">
          {QUICK_LOG_TYPES.map(type => (
            <button
              key={type}
              onClick={() => openQuickLog(type)}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-4 rounded-[10px] border border-border",
                "text-sm font-medium hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700",
                "dark:hover:bg-teal-500/10 dark:hover:border-teal-500 dark:hover:text-teal-400",
                "transition-colors"
              )}
            >
              <span>{TYPE_EMOJIS[type]}</span>
              <span>{TYPE_LABELS[type]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Recent entries ── */}
      <div className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold">รายการล่าสุด</h3>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-2xl">
              🌿
            </div>
            <p className="font-medium">ยังไม่มีข้อมูลสุขภาพ</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              เริ่มบันทึก biomarker เพื่อติดตาม Longevity Score ของคุณ
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-5 h-9 px-5 rounded-[10px] bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium transition-colors"
            >
              บันทึกครั้งแรก
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recent.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0 text-base">
                  {TYPE_EMOJIS[entry.type] ?? "📊"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{TYPE_LABELS[entry.type] ?? entry.type}</p>
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground truncate">{entry.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{entry.value} <span className="text-xs font-normal text-muted-foreground">{entry.unit}</span></p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(entry.recorded_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <AddEntryModal
          onClose={() => { setShowModal(false); setQuickType(undefined) }}
          onAdd={handleAdd}
          initialType={quickType}
        />
      )}
    </div>
  )
}
