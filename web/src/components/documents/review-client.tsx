"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { formatThb, formatDate } from "@/lib/utils"
import {
  ChevronLeft, ZoomIn, ZoomOut, RotateCw, Download,
  ChevronRight, AlertTriangle, Sparkles, Plus, X,
  Edit, Check, Send,
} from "lucide-react"

const SAMPLE_LINE_ITEMS = [
  { name: "Professional Service Fee", qty: 1, unit: 8750, total: 8750 },
  { name: "Monthly Subscription", qty: 1, unit: 990,  total: 990  },
]

const THUMB_MAP: [string, string][] = [
  ["grab", "🚖"], ["aws", "☁️"], ["amazon", "☁️"], ["google", "☁️"],
  ["microsoft", "☁️"], ["azure", "☁️"], ["7-eleven", "🧾"], ["7eleven", "🧾"],
  ["starbucks", "☕"], ["makro", "🛒"], ["lotus", "🛒"], ["big c", "🛒"],
  ["shell", "⛽"], ["ptt", "⛽"], ["ais", "📶"], ["true", "📶"], ["dtac", "📶"],
  ["figma", "🎨"], ["slack", "🎨"], ["notion", "🎨"], ["electricity", "💡"],
  ["mea", "💡"], ["pea", "💡"], ["water", "💧"], ["mwa", "💧"],
  ["food", "🍲"], ["restaurant", "🍜"], ["hotel", "🏢"], ["office", "🏢"],
]

function getThumb(name: string): string {
  const lower = (name ?? "").toLowerCase()
  for (const [key, emoji] of THUMB_MAP) {
    if (lower.includes(key)) return emoji
  }
  return "🧾"
}

interface ReviewClientProps {
  doc: any
  fileUrl: string
  integrations: { id: string; provider: string }[]
  userRole: string
}

export function ReviewClient({ doc, fileUrl, integrations, userRole }: ReviewClientProps) {
  const router   = useRouter()
  const supabase = createClient()
  const canEdit  = ["owner", "admin", "accountant"].includes(userRole)

  const [zoom, setZoom] = useState(1)
  const [rot,  setRot]  = useState(0)
  const [page, setPage] = useState(1)

  const [form, setForm] = useState({
    vendor_name:    doc.vendor_name    ?? "",
    vendor_tax_id:  doc.vendor_tax_id  ?? "",
    doc_date:       doc.doc_date?.slice(0, 10) ?? "",
    doc_number:     doc.doc_number     ?? "",
    category:       doc.category       ?? "ค่า Software / Cloud",
    subtotal:       doc.subtotal       ?? 0,
    vat_amount:     doc.vat_amount     ?? 0,
    total_amount:   doc.total_amount   ?? 0,
    notes:          "",
    integration_id: integrations[0]?.id ?? "",
  })

  const [items, setItems] = useState(SAMPLE_LINE_ITEMS)
  const [saving, setSaving] = useState(false)

  const conf      = doc.overall_confidence ?? doc.confidence ?? 0.87
  const confPct   = Math.round(conf * 100)
  const confTone  = conf >= 0.9 ? "emerald" : conf >= 0.7 ? "amber" : "rose"
  const confLabel = conf >= 0.9 ? "แม่นยำสูง" : conf >= 0.7 ? "ตรวจสอบก่อน" : "ความถูกต้องต่ำ"

  const warnings = useMemo(() => {
    const w: { tone: string; text: string }[] = []
    const expectedVat = +(form.subtotal * 0.07).toFixed(2)
    if (form.vat_amount > 0 && Math.abs(expectedVat - form.vat_amount) > 0.5)
      w.push({ tone: "amber", text: `VAT คำนวณไม่ตรง (คาด ${formatThb(expectedVat)})` })
    if (form.doc_date && new Date(form.doc_date) > new Date())
      w.push({ tone: "rose",  text: "วันที่ในเอกสารเป็นอนาคต" })
    if (!form.doc_number || form.doc_number === "-")
      w.push({ tone: "amber", text: "ไม่พบเลขใบกำกับ" })
    return w
  }, [form])

  const updateItem = (i: number, key: string, val: string | number) => {
    const next = [...items]
    next[i] = { ...next[i], [key]: val }
    setItems(next)
  }

  const handleApprove = async (andPush: boolean) => {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from("documents").update({
      vendor_name: form.vendor_name, vendor_tax_id: form.vendor_tax_id,
      doc_date: form.doc_date, doc_number: form.doc_number,
      subtotal: form.subtotal, vat_amount: form.vat_amount,
      total_amount: form.total_amount,
      status: "approved", reviewed_by: user!.id, reviewed_at: new Date().toISOString(),
    }).eq("id", doc.id)
    if (andPush && form.integration_id) {
      await fetch(`/api/documents/${doc.id}/push`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ integrationId: form.integration_id }),
      })
    }
    toast.success(andPush ? "ส่งเข้า FlowAccount แล้ว" : "อนุมัติเรียบร้อย")
    router.push("/documents")
  }

  const handleReject = async () => {
    await supabase.from("documents").update({ status: "rejected" }).eq("id", doc.id)
    toast.error("ปฏิเสธเอกสารแล้ว")
    router.push("/documents")
  }

  const thumb = getThumb(doc.vendor_name ?? "")

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Sub-toolbar */}
      <div className="flex items-center gap-3 px-6 lg:px-7 py-3 border-b border-border bg-card/60 backdrop-blur-sm">
        <button
          onClick={() => router.push("/documents")}
          className="h-9 px-3 rounded-[8px] hover:bg-muted text-sm font-medium text-foreground
            inline-flex items-center gap-1.5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> กลับเอกสาร
        </button>
        <div className="h-5 w-px bg-border" />
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-9 w-9 rounded-[8px] bg-muted text-lg flex items-center justify-center shrink-0">
            {thumb}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{doc.vendor_name ?? "เอกสาร"}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {doc.file_name ?? "—"} · {form.doc_number || "—"}
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Status badge */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium
            bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {doc.status === "approved" ? "อนุมัติแล้ว" : doc.status === "rejected" ? "ปฏิเสธ" : "รอตรวจสอบ"}
          </span>
          {/* Confidence badge */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
            confTone === "emerald"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
              : confTone === "amber"
              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          }`}>
            {confPct}% · {confLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] min-h-0">
        {/* Left: Document preview */}
        <div className="flex flex-col border-r border-border bg-muted/40 min-h-0">
          {/* Zoom toolbar */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border bg-card">
            <button onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
              className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-muted-foreground w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2)))}
              className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="h-5 w-px bg-border mx-1" />
            <button onClick={() => setRot(r => (r + 90) % 360)}
              className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors">
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <div className="h-5 w-px bg-border mx-1" />
            <div className="flex items-center gap-1 text-xs">
              <button onClick={() => setPage(p => Math.max(1, p - 1))}
                className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-muted-foreground">หน้า <b className="text-foreground">{page}</b> / 1</span>
              <button onClick={() => setPage(p => p + 1)}
                className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1" />
            <a href={fileUrl} download
              className="h-8 w-8 rounded-[8px] hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground">
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Receipt preview */}
          <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
            <ReceiptMock doc={doc} zoom={zoom} rot={rot} />
          </div>
        </div>

        {/* Right: Extracted data */}
        <div className="flex flex-col bg-background min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* AI Confidence bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  ความถูกต้องของ AI
                </span>
                <span className={`text-[12.5px] font-semibold ${
                  confTone === "emerald" ? "text-emerald-600 dark:text-emerald-400"
                  : confTone === "amber" ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400"
                }`}>{confPct}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${
                  confTone === "emerald" ? "bg-emerald-500"
                  : confTone === "amber" ? "bg-amber-500"
                  : "bg-rose-500"
                }`} style={{ width: `${confPct}%` }} />
              </div>
            </div>

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <div key={i} className={`flex items-start gap-2.5 p-3 rounded-[10px] text-[12.5px] ${
                    w.tone === "rose"
                      ? "bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200"
                      : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200"
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{w.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Extracted fields */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                ข้อมูลที่ AI ดึงมา
              </h3>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="col-span-2">
                  <FieldLabel>ชื่อผู้ขาย</FieldLabel>
                  <input value={form.vendor_name}
                    onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))}
                    disabled={!canEdit}
                    className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
                      outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition" />
                </div>
                <div>
                  <FieldLabel>เลขผู้เสียภาษี</FieldLabel>
                  <input value={form.vendor_tax_id}
                    onChange={e => setForm(f => ({ ...f, vendor_tax_id: e.target.value }))}
                    disabled={!canEdit}
                    className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
                      outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition" />
                </div>
                <div>
                  <FieldLabel>เลขที่ใบกำกับ</FieldLabel>
                  <input value={form.doc_number}
                    onChange={e => setForm(f => ({ ...f, doc_number: e.target.value }))}
                    disabled={!canEdit}
                    className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
                      outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition" />
                </div>
                <div>
                  <FieldLabel>วันที่เอกสาร</FieldLabel>
                  <input type="date" value={form.doc_date}
                    onChange={e => setForm(f => ({ ...f, doc_date: e.target.value }))}
                    disabled={!canEdit}
                    className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
                      outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 transition" />
                </div>
                <div>
                  <FieldLabel>หมวดหมู่ค่าใช้จ่าย</FieldLabel>
                  <select value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    disabled={!canEdit}
                    className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground px-3
                      outline-none focus:border-brand-500 transition">
                    {["ค่า Software / Cloud","ค่าเช่าสำนักงาน","ค่าเดินทาง","ของใช้สำนักงาน",
                      "ค่าสาธารณูปโภค","รับรองลูกค้า","ค่าน้ำมัน","ค่าโทรศัพท์"].map(c =>
                      <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-foreground">รายการ</h3>
                <button
                  onClick={() => setItems([...items, { name: "รายการใหม่", qty: 1, unit: 0, total: 0 }])}
                  className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline
                    inline-flex items-center gap-1">
                  <Plus className="w-3 h-3" /> เพิ่มรายการ
                </button>
              </div>
              <div className="border border-border rounded-[10px] overflow-hidden bg-card">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">รายละเอียด</th>
                      <th className="text-right px-3 py-2 font-medium w-12">จำนวน</th>
                      <th className="text-right px-3 py-2 font-medium w-24">ราคา</th>
                      <th className="text-right px-3 py-2 font-medium w-24">รวม</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((it, i) => (
                      <tr key={i} className="hover:bg-muted/40">
                        <td className="px-3 py-2">
                          <input value={it.name}
                            onChange={e => updateItem(i, "name", e.target.value)}
                            className="w-full bg-transparent outline-none text-foreground" />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{it.qty}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatThb(it.unit)}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground tabular-nums">{formatThb(it.total)}</td>
                        <td className="text-center">
                          <button onClick={() => setItems(items.filter((_, j) => j !== i))}
                            className="h-6 w-6 rounded-[4px] hover:bg-rose-50 dark:hover:bg-rose-500/20
                              text-rose-500 inline-flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border border-border rounded-[10px] overflow-hidden bg-card">
              <div className="px-4 py-2.5 bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                สรุปยอด
              </div>
              <div className="p-4 space-y-2 text-sm">
                <TotalRow label="ยอดก่อน VAT" value={formatThb(form.subtotal)} />
                <TotalRow label="VAT 7%" value={formatThb(form.vat_amount)} />
                <div className="h-px bg-border" />
                <TotalRow label="ยอดรวมสุทธิ" value={formatThb(form.total_amount)} strong />
              </div>
            </div>

            {/* Notes */}
            <div>
              <FieldLabel>บันทึก / หมายเหตุ</FieldLabel>
              <textarea rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="เพิ่มบันทึกภายในเกี่ยวกับรายการนี้..."
                className="w-full rounded-[10px] border border-border bg-card text-sm p-3
                  outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 resize-none" />
            </div>
          </div>

          {/* Sticky footer */}
          {canEdit && (
            <div className="border-t border-border p-4 flex items-center gap-2 bg-card">
              <button
                onClick={handleReject}
                className="h-9 px-4 rounded-[10px] text-sm font-medium text-rose-600 dark:text-rose-400
                  hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors inline-flex items-center gap-1.5">
                <X className="w-4 h-4" /> ปฏิเสธ
              </button>
              <div className="flex-1" />
              <button
                onClick={() => {}}
                className="h-9 px-4 rounded-[10px] border border-border bg-card text-sm font-medium
                  text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5">
                <Edit className="w-3.5 h-3.5" /> บันทึกฉบับร่าง
              </button>
              <button
                onClick={() => handleApprove(false)}
                disabled={saving}
                className="h-9 px-4 rounded-[10px] border border-border bg-card text-sm font-medium
                  text-foreground hover:bg-muted transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
                <Check className="w-3.5 h-3.5" /> อนุมัติ
              </button>
              <button
                onClick={() => handleApprove(true)}
                disabled={saving}
                className="h-9 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
                  transition-colors inline-flex items-center gap-1.5 disabled:opacity-60">
                <Send className="w-3.5 h-3.5" /> {saving ? "กำลังส่ง..." : "อนุมัติ & ส่งเข้าบัญชี"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11.5px] font-medium text-muted-foreground mb-1">{children}</label>
}

function TotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-foreground" : "text-muted-foreground"}`}>
      <span className={strong ? "font-semibold" : ""}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-[17px] font-bold text-foreground" : "font-medium text-foreground"}`}>
        {value}
      </span>
    </div>
  )
}

function ReceiptMock({ doc, zoom, rot }: { doc: any; zoom: number; rot: number }) {
  const thumb = getThumb(doc.vendor_name ?? "")
  const vendor = doc.vendor_name ?? "ผู้ขาย"
  const invoiceNo = doc.doc_number ?? "INV-2026-0001"
  const date = doc.doc_date ?? "2026-05-17"
  const total = doc.total_amount ?? 0
  const vat   = doc.vat_amount   ?? 0
  const sub   = doc.subtotal     ?? total - vat

  return (
    <div
      className="bg-white text-slate-900 rounded-[6px] shadow-2xl shadow-slate-900/20 overflow-hidden transition-transform"
      style={{ width: 460, transform: `scale(${zoom}) rotate(${rot}deg)`, transformOrigin: "top center" }}
    >
      {/* Header */}
      <div className="px-7 py-6 border-b border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[20px] font-bold tracking-tight">{vendor}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Tax ID: {doc.vendor_tax_id || "0107561234567"} (สำนักงานใหญ่)
            </div>
            <div className="text-[11px] text-slate-500">123 Ratchadaphisek Rd., Bangkok 10310</div>
          </div>
          <div className="h-12 w-12 rounded-[10px] bg-slate-100 flex items-center justify-center text-2xl">
            {thumb}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            Tax Invoice / Receipt
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="text-[11px] text-slate-500 tabular-nums">{invoiceNo}</span>
        </div>
      </div>

      {/* Bill-to + date */}
      <div className="px-7 py-4 grid grid-cols-2 gap-4 text-[11.5px]">
        <div>
          <div className="text-slate-400 uppercase tracking-wider text-[9.5px] font-semibold">Bill to</div>
          <div className="mt-1 font-medium">บริษัท เอบีซี จำกัด</div>
          <div className="text-slate-500 leading-relaxed">8th Fl., ABC Bldg., Sukhumvit Rd., Bangkok 10110</div>
          <div className="text-slate-500">Tax ID: 0105561234567</div>
        </div>
        <div className="text-right">
          <div className="text-slate-400 uppercase tracking-wider text-[9.5px] font-semibold">Date</div>
          <div className="mt-1 font-medium tabular-nums">{formatDate(date)}</div>
        </div>
      </div>

      {/* Line items */}
      <div className="px-7 pb-4">
        <div className="border-t border-slate-200">
          <div className="grid grid-cols-[1fr_50px_80px_80px] py-2.5 text-[10px] uppercase tracking-wider
            text-slate-400 font-semibold border-b border-slate-200">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price</span>
            <span className="text-right">Total</span>
          </div>
          <div className="grid grid-cols-[1fr_50px_80px_80px] py-2 text-[12px] border-b border-slate-100">
            <span className="pr-2">{vendor} Service</span>
            <span className="text-right tabular-nums">1</span>
            <span className="text-right tabular-nums text-slate-600">
              {sub.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-right tabular-nums font-medium">
              {sub.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="px-7 pb-4">
        <div className="ml-auto w-[230px] text-[12px] space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums">{sub.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>VAT 7%</span>
            <span className="tabular-nums">{vat.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between font-bold text-[14px] border-t border-slate-300 pt-1.5 mt-1.5">
            <span>TOTAL (THB)</span>
            <span className="tabular-nums">฿ {total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-7 py-4 bg-slate-50 text-[10px] text-slate-500 flex items-center justify-between">
        <span>Thank you for your business</span>
        <span>Signed · {vendor}</span>
      </div>
    </div>
  )
}
