"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Plus, Check, X, Clock, Loader2, ChevronRight, Briefcase, DollarSign, FileText, AlertCircle } from "lucide-react"

type Claim = {
  id: string; title: string; amount: number; status: string
  submitted_at: string | null; reviewed_at: string | null; category: string | null
  documents: { vendor_name: string | null } | null
  business_projects: { name: string } | null
}
type Project = { id: string; name: string; status: string; budget: number | null }

const fmtTHB  = (n: number) => "฿" + n.toLocaleString("th-TH", { maximumFractionDigits: 0 })
const fmtDate = (d: string)  => new Date(d).toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"2-digit" })

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  pending:      { label: "ร่าง",          color: "text-muted-foreground",            bg: "bg-muted",              icon: Clock },
  submitted:    { label: "รอตรวจสอบ",     color: "text-amber-700 dark:text-amber-300",  bg: "bg-amber-50 dark:bg-amber-500/10", icon: Clock },
  under_review: { label: "กำลังตรวจสอบ",  color: "text-blue-700 dark:text-blue-300",   bg: "bg-blue-50 dark:bg-blue-500/10",   icon: Clock },
  approved:     { label: "อนุมัติแล้ว",   color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10", icon: Check },
  rejected:     { label: "ไม่อนุมัติ",    color: "text-rose-700 dark:text-rose-300",  bg: "bg-rose-50 dark:bg-rose-500/10",  icon: X },
  paid:         { label: "จ่ายแล้ว",      color: "text-violet-700 dark:text-violet-300", bg: "bg-violet-50 dark:bg-violet-500/10", icon: Check },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? STATUS_LABEL.pending
  const Icon = s.icon
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold", s.color, s.bg)}>
      <Icon className="w-2.5 h-2.5" /> {s.label}
    </span>
  )
}

/* ─── Submit Modal ─────────────────────────────────────────────────────────── */
function SubmitClaimModal({ orgId, projects, onClose, onCreate }: {
  orgId: string; projects: Project[]
  onClose: () => void; onCreate: (c: Claim) => void
}) {
  const [title,     setTitle]     = useState("")
  const [amount,    setAmount]    = useState("")
  const [category,  setCategory]  = useState("")
  const [projectId, setProjectId] = useState("")
  const [desc,      setDesc]      = useState("")
  const [saving,    setSaving]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/claims", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, title, amount: Number(amount), category: category || null, projectId: projectId || null, description: desc || null }),
      })
      const { claimId } = await res.json()
      onCreate({ id: claimId, title, amount: Number(amount), status: "submitted", submitted_at: new Date().toISOString(), reviewed_at: null, category: category || null, documents: null, business_projects: projectId ? projects.find(p => p.id === projectId) ?? null : null })
      toast.success("ยื่นเบิกค่าใช้จ่ายแล้ว ✅")
      onClose()
    } catch { toast.error("เกิดข้อผิดพลาด") } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-semibold">ยื่นเบิกค่าใช้จ่าย</h3>
            <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">รายการ *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="เช่น ค่าเดินทาง, ค่าอาหารลูกค้า"
                className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">จำนวนเงิน (บาท) *</label>
                <input required type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500" />
              </div>
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">หมวดหมู่</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500">
                  <option value="">เลือกหมวดหมู่</option>
                  {["เดินทาง","อาหาร","ที่พัก","อุปกรณ์","การตลาด","ฝึกอบรม","อื่นๆ"].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {projects.length > 0 && (
              <div>
                <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">โปรเจกต์</label>
                <select value={projectId} onChange={e => setProjectId(e.target.value)}
                  className="w-full h-10 rounded-[10px] border bg-background px-3 text-sm outline-none focus:border-brand-500">
                  <option value="">ไม่ระบุโปรเจกต์</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">หมายเหตุ</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="รายละเอียดเพิ่มเติม..."
                className="w-full rounded-[10px] border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500 resize-none" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} className="flex-1 h-10 rounded-[10px] border text-sm font-medium hover:bg-muted transition-colors">ยกเลิก</button>
              <button type="submit" disabled={saving}
                className="flex-1 h-10 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} ยื่นเบิก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ─── Approve/Reject Modal ─────────────────────────────────────────────────── */
function ReviewModal({ claim, onClose, onUpdate }: { claim: Claim; onClose: () => void; onUpdate: (id: string, status: string) => void }) {
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(false)

  const act = async (action: "approve" | "reject") => {
    if (action === "reject" && !comment.trim()) { toast.error("กรุณาระบุเหตุผลที่ไม่อนุมัติ"); return }
    setLoading(true)
    try {
      await fetch(`/api/claims/${claim.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, comment }) })
      onUpdate(claim.id, action === "approve" ? "approved" : "rejected")
      toast.success(action === "approve" ? "อนุมัติแล้ว ✅" : "ไม่อนุมัติ ❌")
      onClose()
    } catch { toast.error("เกิดข้อผิดพลาด") } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border rounded-[16px] shadow-2xl w-full max-w-md">
        <div className="p-6 space-y-4">
          <h3 className="text-[17px] font-semibold">ตรวจสอบการเบิก</h3>
          <div className="p-4 bg-muted/40 rounded-xl space-y-1.5">
            <p className="font-medium">{claim.title}</p>
            <p className="text-2xl font-black text-brand-600">{fmtTHB(claim.amount)}</p>
            {claim.category && <p className="text-xs text-muted-foreground">{claim.category}</p>}
          </div>
          <div>
            <label className="text-[11.5px] font-medium text-muted-foreground block mb-1">ความเห็น / เหตุผล</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="ระบุความเห็น..."
              className="w-full rounded-[10px] border bg-background px-3 py-2 text-sm outline-none focus:border-brand-500 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 h-10 rounded-[10px] border text-sm font-medium hover:bg-muted">ยกเลิก</button>
            <button onClick={() => act("reject")} disabled={loading}
              className="flex-1 h-10 rounded-[10px] bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
              <X className="w-3.5 h-3.5" /> ไม่อนุมัติ
            </button>
            <button onClick={() => act("approve")} disabled={loading}
              className="flex-1 h-10 rounded-[10px] bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} อนุมัติ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main ─────────────────────────────────────────────────────────────────── */
export function ClaimsClient({ orgId, userId, isManager, claims: initial, projects, stats }: {
  orgId: string; userId: string; isManager: boolean
  claims: Claim[]; projects: Project[]
  stats: { pending: number; approved: number; total: number }
}) {
  const [claims,   setClaims]   = useState(initial)
  const [showNew,  setShowNew]  = useState(false)
  const [reviewing, setReviewing] = useState<Claim | null>(null)
  const [tab,      setTab]      = useState<"all"|"submitted"|"approved"|"rejected">("all")

  const filtered = claims.filter(c => tab === "all" ? true : c.status === tab || (tab === "submitted" && c.status === "under_review"))

  return (
    <div className="p-6 lg:p-7 max-w-[960px] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center"><Briefcase className="w-5 h-5 text-indigo-500" /></div>
          <div>
            <h2 className="text-xl font-bold">การเบิกค่าใช้จ่าย</h2>
            <p className="text-sm text-muted-foreground">{isManager ? "จัดการการอนุมัติของทีม" : "ยื่นและติดตามการเบิก"}</p>
          </div>
        </div>
        <button onClick={() => setShowNew(true)}
          className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> ยื่นเบิกใหม่
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "รอตรวจสอบ", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-500/10" },
          { label: "อนุมัติแล้ว", value: stats.approved, icon: Check, color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: "ยอดที่อนุมัติ", value: fmtTHB(stats.total), icon: DollarSign, color: "text-brand-600", bg: "bg-brand-500/10" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <div className={cn("w-9 h-9 rounded-[10px] flex items-center justify-center mb-3", s.bg)}>
              <s.icon className={cn("w-4 h-4", s.color)} />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 border-b mb-4">
        {[
          { id: "all",      label: `ทั้งหมด (${claims.length})` },
          { id: "submitted", label: "รอตรวจ" },
          { id: "approved", label: "อนุมัติ" },
          { id: "rejected", label: "ไม่อนุมัติ" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={cn("px-4 h-10 text-[13px] font-medium border-b-2 -mb-px transition whitespace-nowrap",
              tab === t.id ? "border-brand-500 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Claims list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card py-14 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-2xl">💼</div>
          <p className="font-medium">ยังไม่มีการเบิก</p>
          <p className="text-sm text-muted-foreground mt-1">กดปุ่ม "ยื่นเบิกใหม่" เพื่อส่งคำขอ</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="px-5 py-3">รายการ</th>
                  <th className="px-4 py-3 text-right">จำนวน</th>
                  <th className="px-4 py-3">หมวด</th>
                  <th className="px-4 py-3">โปรเจกต์</th>
                  <th className="px-4 py-3">สถานะ</th>
                  <th className="px-4 py-3">วันที่</th>
                  {isManager && <th className="px-4 py-3">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 font-medium">{c.title}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{fmtTHB(c.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.category ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{(c.business_projects as any)?.name ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {c.submitted_at ? fmtDate(c.submitted_at) : "—"}
                    </td>
                    {isManager && (
                      <td className="px-4 py-3">
                        {["submitted","under_review"].includes(c.status) && (
                          <button onClick={() => setReviewing(c)}
                            className="h-7 px-2.5 rounded-[6px] bg-brand-50 hover:bg-brand-100 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[11px] font-medium transition-colors">
                            ตรวจสอบ
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNew  && <SubmitClaimModal orgId={orgId} projects={projects} onClose={() => setShowNew(false)} onCreate={c => setClaims(p => [c, ...p])} />}
      {reviewing && <ReviewModal claim={reviewing} onClose={() => setReviewing(null)} onUpdate={(id, status) => { setClaims(p => p.map(c => c.id === id ? { ...c, status } : c)); setReviewing(null) }} />}
    </div>
  )
}
