"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved. Proprietary and confidential.
 */

import { useState, useTransition } from "react"
import { toast }                   from "sonner"

// ── Types ────────────────────────────────────────────────────────────────────
interface DbPlan {
  id:                 string
  name_th:            string
  name_en:            string
  price_thb:          number
  doc_quota:          number
  features:           string[]
  sort_order:         number
  is_active:          boolean
  highlighted:        boolean
  stripe_price_id_m:  string | null
  stripe_price_id_y:  string | null
  updated_at:         string
}

interface AdminPlansClientProps {
  plans: DbPlan[]
}

// ── Component ────────────────────────────────────────────────────────────────
export function AdminPlansClient({ plans: initialPlans }: AdminPlansClientProps) {
  const [plans, setPlans]           = useState<DbPlan[]>(initialPlans)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [draft, setDraft]           = useState<Partial<DbPlan>>({})
  const [isPending, startTransition] = useTransition()
  const [syncingId, setSyncingId]   = useState<string | null>(null)

  // ── Open editor for a plan ────────────────────────────────────────────────
  function startEdit(plan: DbPlan) {
    setEditingId(plan.id)
    setDraft({
      name_th:           plan.name_th,
      name_en:           plan.name_en,
      price_thb:         plan.price_thb,
      doc_quota:         plan.doc_quota,
      features:          plan.features,
      highlighted:       plan.highlighted,
      is_active:         plan.is_active,
      stripe_price_id_m: plan.stripe_price_id_m,
      stripe_price_id_y: plan.stripe_price_id_y,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft({})
  }

  // ── Save edits ────────────────────────────────────────────────────────────
  function saveEdit(planId: string) {
    startTransition(async () => {
      // features: convert from textarea string if needed
      const payload = {
        ...draft,
        features: typeof draft.features === "string"
          ? (draft.features as string).split("\n").map(s => s.trim()).filter(Boolean)
          : draft.features,
      }

      const res = await fetch(`/api/admin/plans/${planId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? "บันทึกไม่สำเร็จ")
        return
      }

      setPlans(prev =>
        prev.map(p => p.id === planId ? { ...p, ...json.plan } : p)
      )
      setEditingId(null)
      setDraft({})
      toast.success(`บันทึก plan "${planId}" เรียบร้อย`)
    })
  }

  // ── Stripe Sync ───────────────────────────────────────────────────────────
  async function stripeSync(planId: string) {
    setSyncingId(planId)
    try {
      const res = await fetch(`/api/admin/plans/${planId}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ yearlyDiscountPct: 17 }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? "Stripe sync ไม่สำเร็จ")
        return
      }

      setPlans(prev =>
        prev.map(p => p.id === planId ? { ...p, ...json.plan } : p)
      )
      toast.success(
        `สร้าง Stripe prices สำเร็จ — M: ${json.stripe_price_id_m} · Y: ${json.stripe_price_id_y}`
      )
    } finally {
      setSyncingId(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-zinc-500 mb-6">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-zinc-600" /> inactive
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> highlighted
        </span>
      </div>

      {plans.map(plan => (
        <div
          key={plan.id}
          className={`rounded-xl border transition-colors ${
            plan.highlighted
              ? "border-amber-500/40 bg-amber-950/20"
              : plan.is_active
              ? "border-zinc-700 bg-zinc-900"
              : "border-zinc-800 bg-zinc-900/40 opacity-60"
          }`}
        >
          {/* ── Plan header (always visible) ── */}
          <div className="flex items-center gap-4 px-5 py-4">
            {/* Status dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              !plan.is_active ? "bg-zinc-600" :
              plan.highlighted ? "bg-amber-400" :
              "bg-emerald-500"
            }`} />

            {/* Name + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-zinc-500 uppercase tracking-wider">{plan.id}</span>
                <span className="font-semibold text-white">{plan.name_th}</span>
                <span className="text-zinc-400 text-sm">/ {plan.name_en}</span>
                {plan.highlighted && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    POPULAR
                  </span>
                )}
                {!plan.is_active && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-700 text-zinc-400">
                    INACTIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mt-0.5 text-sm text-zinc-400">
                <span>
                  {plan.price_thb === 0 ? "ฟรี / ติดต่อ" : `฿${plan.price_thb.toLocaleString()}/เดือน`}
                </span>
                <span>·</span>
                <span>{plan.doc_quota === 0 ? "ไม่จำกัด" : `${plan.doc_quota.toLocaleString()} docs/mo`}</span>
                <span>·</span>
                <span>{plan.features?.length ?? 0} features</span>
              </div>
            </div>

            {/* Stripe status */}
            <div className="text-right text-xs space-y-0.5 mr-4 hidden sm:block">
              <div className={`flex items-center justify-end gap-1 ${
                plan.stripe_price_id_m ? "text-emerald-400" : "text-zinc-600"
              }`}>
                <span>{plan.stripe_price_id_m ? "✓" : "—"}</span>
                <span className="font-mono">{plan.stripe_price_id_m ?? "no monthly price"}</span>
              </div>
              <div className={`flex items-center justify-end gap-1 ${
                plan.stripe_price_id_y ? "text-emerald-400" : "text-zinc-600"
              }`}>
                <span>{plan.stripe_price_id_y ? "✓" : "—"}</span>
                <span className="font-mono">{plan.stripe_price_id_y ?? "no yearly price"}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {plan.price_thb > 0 && (
                <button
                  onClick={() => stripeSync(plan.id)}
                  disabled={syncingId === plan.id}
                  title="Create Stripe Product + Prices"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-purple-700/50 text-purple-300
                    bg-purple-950/30 hover:bg-purple-950/60 disabled:opacity-40 transition-colors"
                >
                  {syncingId === plan.id ? "Syncing…" : "⚡ Stripe Sync"}
                </button>
              )}
              {editingId === plan.id ? (
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-600 text-zinc-400
                    hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => startEdit(plan)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-600 text-zinc-300
                    hover:bg-zinc-800 hover:text-white transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* ── Inline editor (visible when editing) ── */}
          {editingId === plan.id && (
            <div className="border-t border-zinc-700/60 px-5 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* name_th */}
                <Field label="ชื่อภาษาไทย">
                  <Input
                    value={draft.name_th ?? ""}
                    onChange={v => setDraft(d => ({ ...d, name_th: v }))}
                  />
                </Field>

                {/* name_en */}
                <Field label="Name (EN)">
                  <Input
                    value={draft.name_en ?? ""}
                    onChange={v => setDraft(d => ({ ...d, name_en: v }))}
                  />
                </Field>

                {/* price_thb */}
                <Field label="ราคา (THB/เดือน)" hint="0 = ฟรี / custom">
                  <Input
                    type="number"
                    value={String(draft.price_thb ?? 0)}
                    onChange={v => setDraft(d => ({ ...d, price_thb: Number(v) }))}
                  />
                </Field>

                {/* doc_quota */}
                <Field label="Doc quota / เดือน" hint="0 = ไม่จำกัด">
                  <Input
                    type="number"
                    value={String(draft.doc_quota ?? 0)}
                    onChange={v => setDraft(d => ({ ...d, doc_quota: Number(v) }))}
                  />
                </Field>

                {/* stripe_price_id_m */}
                <Field label="Stripe Price ID (Monthly)" hint="price_xxx">
                  <Input
                    value={draft.stripe_price_id_m ?? ""}
                    onChange={v => setDraft(d => ({ ...d, stripe_price_id_m: v || null }))}
                    placeholder="price_xxxxxxxx"
                    mono
                  />
                </Field>

                {/* stripe_price_id_y */}
                <Field label="Stripe Price ID (Yearly)" hint="price_xxx">
                  <Input
                    value={draft.stripe_price_id_y ?? ""}
                    onChange={v => setDraft(d => ({ ...d, stripe_price_id_y: v || null }))}
                    placeholder="price_xxxxxxxx"
                    mono
                  />
                </Field>

                {/* features */}
                <Field label="Features" hint="แต่ละ feature 1 บรรทัด" className="sm:col-span-2 lg:col-span-2">
                  <textarea
                    rows={5}
                    value={
                      Array.isArray(draft.features)
                        ? (draft.features as string[]).join("\n")
                        : (draft.features ?? "")
                    }
                    onChange={e =>
                      setDraft(d => ({
                        ...d,
                        features: e.target.value.split("\n"),
                      }))
                    }
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100
                      px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono"
                  />
                </Field>

                {/* Toggles */}
                <div className="flex flex-col gap-3 pt-1">
                  <Toggle
                    label="Highlighted (Popular)"
                    checked={draft.highlighted ?? false}
                    onChange={v => setDraft(d => ({ ...d, highlighted: v }))}
                  />
                  <Toggle
                    label="Is Active"
                    checked={draft.is_active ?? true}
                    onChange={v => setDraft(d => ({ ...d, is_active: v }))}
                  />
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 rounded-lg text-sm border border-zinc-600 text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={() => saveEdit(plan.id)}
                  disabled={isPending}
                  className="px-5 py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-500
                    text-white disabled:opacity-50 transition-colors"
                >
                  {isPending ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Footer note */}
      <p className="text-xs text-zinc-600 mt-8 text-center">
        การเปลี่ยนแปลงราคา/quota มีผลกับ org ใหม่ที่สมัครเท่านั้น ·
        org ที่มี subscription อยู่แล้วจะยังได้ plan เดิมจาก Stripe ·
        ต้องการเปลี่ยน Stripe product ให้ใช้ปุ่ม ⚡ Stripe Sync เพื่อสร้าง price ใหม่
      </p>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Field({
  label, hint, children, className,
}: {
  label: string; hint?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-zinc-400 mb-1">
        {label}
        {hint && <span className="ml-1 text-zinc-600">({hint})</span>}
      </label>
      {children}
    </div>
  )
}

function Input({
  value, onChange, type = "text", placeholder, mono,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg bg-zinc-800 border border-zinc-700 text-sm text-zinc-100
        px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500/50
        ${mono ? "font-mono" : ""}`}
    />
  )
}

function Toggle({
  label, checked, onChange,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-zinc-700"
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`} />
      </button>
      <span className="text-sm text-zinc-300">{label}</span>
    </label>
  )
}
