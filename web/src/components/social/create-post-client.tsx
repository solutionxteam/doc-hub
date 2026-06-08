/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

"use client"

import { useState }    from "react"
import { useRouter }   from "next/navigation"
import { toast }       from "sonner"
import { cn }          from "@/lib/utils"
import { Icons }       from "@/components/ui/icons"
import type { RecentDoc } from "@/app/(app)/social/create/page"

/* ─── Types ──────────────────────────────────────────────────── */
type PostType = "protocol" | "review" | "challenge" | "stack"
type Step     = 1 | 2 | 3

type ProductEntry = { name: string; url: string }

/* ─── Constants ──────────────────────────────────────────────── */
const POST_TYPES: {
  type:        PostType
  emoji:       string
  label:       string
  desc:        string
  color:       string
  border:      string
  selectedBg:  string
}[] = [
  {
    type:       "protocol",
    emoji:      "📋",
    label:      "Protocol",
    desc:       "แชร์ routine หรือวิธีการที่คุณใช้",
    color:      "text-purple-700 dark:text-purple-300",
    border:     "border-purple-200 dark:border-purple-800",
    selectedBg: "bg-purple-50 dark:bg-purple-900/20 border-purple-400 ring-2 ring-purple-300 dark:ring-purple-700",
  },
  {
    type:       "review",
    emoji:      "🧾",
    label:      "Review",
    desc:       "รีวิวสินค้าหรือบริการที่คุณใช้จริง",
    color:      "text-blue-700 dark:text-blue-300",
    border:     "border-blue-200 dark:border-blue-800",
    selectedBg: "bg-blue-50 dark:bg-blue-900/20 border-blue-400 ring-2 ring-blue-300 dark:ring-blue-700",
  },
  {
    type:       "challenge",
    emoji:      "🎯",
    label:      "Challenge",
    desc:       "ชวนเพื่อนร่วมกิจกรรมหรือความท้าทาย",
    color:      "text-orange-700 dark:text-orange-300",
    border:     "border-orange-200 dark:border-orange-800",
    selectedBg: "bg-orange-50 dark:bg-orange-900/20 border-orange-400 ring-2 ring-orange-300 dark:ring-orange-700",
  },
  {
    type:       "stack",
    emoji:      "📦",
    label:      "Stack",
    desc:       "รวบรวมสินค้าหรือเครื่องมือที่คุณใช้ประจำ",
    color:      "text-teal-700 dark:text-teal-300",
    border:     "border-teal-200 dark:border-teal-800",
    selectedBg: "bg-teal-50 dark:bg-teal-900/20 border-teal-400 ring-2 ring-teal-300 dark:ring-teal-700",
  },
]

const TYPE_META: Record<PostType, { emoji: string; label: string; color: string; bg: string }> = {
  protocol:  { emoji: "📋", label: "Protocol",  color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-900/30"  },
  review:    { emoji: "🧾", label: "Review",    color: "text-blue-700 dark:text-blue-300",     bg: "bg-blue-100 dark:bg-blue-900/30"      },
  challenge: { emoji: "🎯", label: "Challenge", color: "text-orange-700 dark:text-orange-300", bg: "bg-orange-100 dark:bg-orange-900/30"  },
  stack:     { emoji: "📦", label: "Stack",     color: "text-teal-700 dark:text-teal-300",     bg: "bg-teal-100 dark:bg-teal-900/30"      },
}

/* ─── Props ──────────────────────────────────────────────────── */
type Props = { recentDocs: RecentDoc[] }

/* ─── CreatePostClient ───────────────────────────────────────── */
export function CreatePostClient({ recentDocs }: Props) {
  const router = useRouter()

  const [step,         setStep]         = useState<Step>(1)
  const [postType,     setPostType]     = useState<PostType | null>(null)
  const [title,        setTitle]        = useState("")
  const [body,         setBody]         = useState("")
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set())
  const [products,     setProducts]     = useState<ProductEntry[]>([{ name: "", url: "" }])
  const [submitting,   setSubmitting]   = useState(false)

  /* helpers */
  const toggleDoc = (id: string) =>
    setSelectedDocs(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const addProduct = () =>
    setProducts(prev => [...prev, { name: "", url: "" }])

  const updateProduct = (idx: number, field: keyof ProductEntry, val: string) =>
    setProducts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p))

  const removeProduct = (idx: number) =>
    setProducts(prev => prev.filter((_, i) => i !== idx))

  const canGoStep2 = postType !== null
  const canGoStep3 = title.trim().length > 0 && body.trim().length >= 10 && body.trim().length <= 2000

  const handleSubmit = async () => {
    if (!postType || !canGoStep3) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/social/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type:       postType,
          title:      title.trim(),
          body:       body.trim(),
          receiptIds: Array.from(selectedDocs),
          products:   products.filter(p => p.name.trim()),
        }),
      })
      if (!res.ok) throw new Error("failed")
      toast.success("โพสต์สำเร็จ!")
      router.push("/social")
    } catch {
      toast.error("เกิดข้อผิดพลาด กรุณาลองใหม่")
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Step indicators ── */
  const STEPS = ["เลือกประเภท", "เพิ่มเนื้อหา", "ตรวจสอบ & เผยแพร่"]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">
          สร้าง Post ใหม่
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">แชร์ประสบการณ์ของคุณกับชุมชน Slippy</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, idx) => {
          const s = (idx + 1) as Step
          const done    = step > s
          const active  = step === s
          return (
            <div key={idx} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  done   ? "bg-emerald-500 text-white"
                  : active ? "bg-gradient-to-br from-violet-600 to-indigo-600 text-white"
                  : "bg-muted text-muted-foreground"
                )}>
                  {done ? "✓" : s}
                </div>
                <span className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  active ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"
                )}>{label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn(
                  "h-0.5 flex-1 mx-2 mb-4 transition-colors",
                  step > s ? "bg-emerald-400" : "bg-border"
                )} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Choose type ── */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">เลือกประเภทโพสต์</p>
          <div className="grid grid-cols-2 gap-3">
            {POST_TYPES.map(pt => (
              <button
                key={pt.type}
                onClick={() => setPostType(pt.type)}
                className={cn(
                  "text-left p-4 rounded-[14px] border-2 transition-all hover:shadow-md space-y-1.5",
                  postType === pt.type
                    ? pt.selectedBg
                    : `bg-card ${pt.border} hover:border-opacity-60`
                )}
              >
                <div className="text-2xl">{pt.emoji}</div>
                <p className={cn("text-sm font-bold", pt.color)}>{pt.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{pt.desc}</p>
              </button>
            ))}
          </div>
          <button
            disabled={!canGoStep2}
            onClick={() => setStep(2)}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ถัดไป →
          </button>
        </div>
      )}

      {/* ── Step 2: Fill details ── */}
      {step === 2 && postType && (
        <div className="space-y-5">
          {/* Type recap */}
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full",
              TYPE_META[postType].bg, TYPE_META[postType].color
            )}>
              {TYPE_META[postType].emoji} {TYPE_META[postType].label}
            </span>
            <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:underline">
              เปลี่ยน
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              หัวข้อ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="ตั้งชื่อโพสต์ที่ดึงดูดความสนใจ..."
              maxLength={100}
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              เนื้อหา <span className="text-red-500">*</span>
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="เขียนเนื้อหาโพสต์ของคุณ (10–2000 ตัวอักษร)..."
              rows={6}
              maxLength={2000}
              className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
            <p className={cn(
              "text-xs text-right",
              body.length < 10 || body.length > 2000 ? "text-red-500" : "text-muted-foreground"
            )}>
              {body.length} / 2000
            </p>
          </div>

          {/* Link receipts */}
          {recentDocs.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                เชื่อมโยงใบเสร็จ <span className="text-xs text-muted-foreground font-normal">(ไม่จำเป็น)</span>
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {recentDocs.map(doc => (
                  <label key={doc.id} className={cn(
                    "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors",
                    selectedDocs.has(doc.id)
                      ? "bg-green-50 dark:bg-green-900/20 border-green-400"
                      : "bg-card border-border hover:border-violet-300"
                  )}>
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(doc.id)}
                      onChange={() => toggleDoc(doc.id)}
                      className="accent-violet-600 w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {doc.vendor_name ?? "ไม่ระบุร้าน"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {doc.doc_date ?? ""} · {doc.total_amount != null ? `฿${doc.total_amount.toLocaleString("th-TH")}` : ""}
                      </p>
                    </div>
                    {selectedDocs.has(doc.id) && (
                      <span className="text-xs font-bold text-green-600 dark:text-green-400 shrink-0">✅ Verified</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              เพิ่มสินค้าที่เกี่ยวข้อง <span className="text-xs text-muted-foreground font-normal">(ไม่จำเป็น)</span>
            </label>
            {products.map((p, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={p.name}
                  onChange={e => updateProduct(idx, "name", e.target.value)}
                  placeholder="ชื่อสินค้า"
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                <input
                  type="url"
                  value={p.url}
                  onChange={e => updateProduct(idx, "url", e.target.value)}
                  placeholder="URL สินค้า"
                  className="flex-1 bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
                {products.length > 1 && (
                  <button
                    onClick={() => removeProduct(idx)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Icons.X size={16} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addProduct}
              className="text-xs text-violet-600 dark:text-violet-400 hover:underline font-medium flex items-center gap-1"
            >
              <Icons.Plus size={13} />
              เพิ่มสินค้า
            </button>
          </div>

          {/* Nav */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              ← ย้อนกลับ
            </button>
            <button
              disabled={!canGoStep3}
              onClick={() => setStep(3)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && postType && (
        <div className="space-y-5">
          <p className="text-sm font-medium text-foreground">ตรวจสอบโพสต์ก่อนเผยแพร่</p>

          {/* Preview card */}
          <div className="bg-card border-2 border-violet-200 dark:border-violet-800 rounded-[14px] p-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full",
                TYPE_META[postType].bg, TYPE_META[postType].color
              )}>
                {TYPE_META[postType].emoji} {TYPE_META[postType].label}
              </span>
              {selectedDocs.size > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700">
                  ✅ Verified Purchase ({selectedDocs.size} ใบเสร็จ)
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{body}</p>
            {products.filter(p => p.name.trim()).length > 0 && (
              <div className="pt-2 border-t border-border space-y-1">
                <p className="text-xs font-semibold text-foreground">สินค้าที่เกี่ยวข้อง:</p>
                {products.filter(p => p.name.trim()).map((p, i) => (
                  <p key={i} className="text-xs text-muted-foreground">📦 {p.name}</p>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>✔ เนื้อหา: {body.trim().length} ตัวอักษร</p>
            {selectedDocs.size > 0 && <p>✔ ใบเสร็จที่เชื่อมโยง: {selectedDocs.size} รายการ</p>}
          </div>

          {/* Nav */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              ← แก้ไข
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white disabled:opacity-60 transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Icons.Loader size={15} />
                  กำลังโพสต์...
                </>
              ) : (
                <>
                  <Icons.Send size={15} />
                  เผยแพร่โพสต์
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
