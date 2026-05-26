"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useState, useMemo }   from "react"
import Link                    from "next/link"
import { useRouter }           from "next/navigation"
import {
  Search, Calendar, Filter, LayoutGrid, Table2,
  Eye, MoreHorizontal, Check, Send, Globe, Mail,
  Inbox, RefreshCw, Trash2, Loader2,
} from "lucide-react"
import { cn }                  from "@/lib/utils"
import { formatThb, formatDate } from "@/lib/utils"

const STATUS_TABS = [
  { id: "all",       th: "ทั้งหมด" },
  { id: "reviewing", th: "รอตรวจสอบ" },
  { id: "approved",  th: "อนุมัติแล้ว" },
  { id: "pushed",    th: "ส่งเข้าบัญชี" },
  { id: "failed",    th: "ล้มเหลว" },
] as const

const THUMB_MAP: Record<string, string> = {
  "7-eleven": "🧾", "seven": "🧾", "ซีพี": "🧾",
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

function getThumb(name: string | null): string {
  if (!name) return "🧾"
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(THUMB_MAP)) {
    if (lower.includes(key.toLowerCase())) return icon
  }
  return "🧾"
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; th: string }> = {
    pending:    { cls: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",           th: "รอดำเนินการ" },
    processing: { cls: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",               th: "กำลังประมวลผล" },
    reviewing:  { cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",           th: "รอตรวจสอบ" },
    approved:   { cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",   th: "อนุมัติแล้ว" },
    pushed:     { cls: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-300",       th: "ส่งเข้าบัญชี" },
    failed:     { cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",               th: "ล้มเหลว" },
    rejected:   { cls: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-300",           th: "ปฏิเสธ" },
  }
  const s = map[status] ?? map.pending
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap", s.cls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.th}
    </span>
  )
}

function SourceIcon({ source }: { source: string }) {
  if (source === "line")  return <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-600 dark:text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />LINE</span>
  if (source === "email") return <span className="inline-flex items-center gap-1 text-[10.5px] text-blue-600 dark:text-blue-400"><Mail className="w-2.5 h-2.5" />Email</span>
  return <span className="inline-flex items-center gap-1 text-[10.5px] text-muted-foreground"><Globe className="w-2.5 h-2.5" />Web</span>
}

interface Doc {
  id:                 string
  vendor_name:        string | null
  total_amount:       number | null
  vat_amount?:        number | null
  status:             string
  doc_date:           string | null
  doc_type?:          string | null
  doc_category?:      string | null
  overall_confidence: number | null
  is_duplicate?:      boolean
  source:             string
  created_at?:        string
  doc_number?:        string | null
}

export function DocumentList({ documents: initialDocs }: { documents: Doc[] }) {
  const router = useRouter()
  const [documents, setDocuments] = useState(initialDocs)
  const [status,   setStatus]   = useState("all")
  const [search,   setSearch]   = useState("")
  const [view,     setView]     = useState<"table" | "card">("table")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [acting,      setActing]      = useState<Record<string, "retry" | "delete" | null>>({})
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function handleRetry(id: string) {
    setActing(a => ({ ...a, [id]: "retry" }))
    setDocuments(ds => ds.map(d => d.id === id ? { ...d, status: "processing" } : d))
    try {
      await fetch(`/api/documents/${id}/process`, { method: "POST" })
      router.refresh()
    } finally {
      setActing(a => ({ ...a, [id]: null }))
    }
  }

  async function handleBulkDelete() {
    const ids = [...selected]
    if (!confirm(`ลบ ${ids.length} รายการที่เลือก?`)) return
    setBulkDeleting(true)
    try {
      await Promise.all(ids.map(id => fetch(`/api/documents/${id}`, { method: "DELETE" })))
      setDocuments(ds => ds.filter(d => !ids.includes(d.id)))
      setSelected(new Set())
      router.refresh()
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ลบเอกสารนี้ออกจากระบบ?")) return
    setActing(a => ({ ...a, [id]: "delete" }))
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" })
      if (res.ok) {
        setDocuments(ds => ds.filter(d => d.id !== id))
        router.refresh()
      }
    } finally {
      setActing(a => ({ ...a, [id]: null }))
    }
  }

  const filtered = useMemo(() => documents.filter(d => {
    if (status !== "all" && d.status !== status) return false
    if (search) {
      const q = search.toLowerCase()
      if (!(d.vendor_name ?? "").toLowerCase().includes(q) &&
          !(d.doc_number ?? "").toLowerCase().includes(q)) return false
    }
    return true
  }), [documents, status, search])

  const counts = useMemo(() => STATUS_TABS.reduce((acc, t) => {
    acc[t.id] = t.id === "all" ? documents.length : documents.filter(d => d.status === t.id).length
    return acc
  }, {} as Record<string, number>), [documents])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  const allSelected = filtered.length > 0 && filtered.every(d => selected.has(d.id))

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex items-center gap-0.5 border-b border-border -mt-1 overflow-x-auto">
        {STATUS_TABS.map(tab => {
          const active = status === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setStatus(tab.id)}
              className={cn(
                "px-3.5 h-10 text-[13.5px] font-medium border-b-2 -mb-px transition whitespace-nowrap shrink-0",
                active
                  ? "border-brand-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.th}
              <span className={cn(
                "ml-2 inline-flex items-center justify-center min-w-[20px] h-[18px] px-1.5 rounded-full text-[11px]",
                active ? "bg-brand-500/15 text-brand-600 dark:text-brand-300" : "bg-muted text-muted-foreground"
              )}>
                {counts[tab.id]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาผู้ขายหรือเลขใบกำกับ..."
            className="w-full h-10 rounded-[10px] border border-border bg-card text-sm text-foreground
              pl-10 pr-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 placeholder:text-muted-foreground/60 transition"
          />
        </div>
        <button className="h-10 px-4 rounded-[10px] border border-border bg-card text-sm font-medium text-foreground
          hover:bg-muted transition inline-flex items-center gap-2 shrink-0">
          <Calendar className="w-4 h-4" /> พ.ค. 2026
        </button>
        <button className="h-10 px-4 rounded-[10px] border border-border bg-card text-sm font-medium text-foreground
          hover:bg-muted transition inline-flex items-center gap-2 shrink-0">
          <Filter className="w-4 h-4" /> ตัวกรอง
        </button>
        <div className="inline-flex p-0.5 bg-muted rounded-[10px] shrink-0">
          <button
            onClick={() => setView("table")}
            className={cn("h-8 px-2.5 rounded-[8px] text-xs font-medium flex items-center gap-1.5 transition",
              view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <Table2 className="w-3.5 h-3.5" /> ตาราง
          </button>
          <button
            onClick={() => setView("card")}
            className={cn("h-8 px-2.5 rounded-[8px] text-xs font-medium flex items-center gap-1.5 transition",
              view === "card" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> การ์ด
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 dark:bg-brand-500/10 rounded-[10px] border border-brand-200 dark:border-brand-500/20">
          <span className="text-sm font-medium text-foreground">{selected.size} รายการที่เลือก</span>
          <button className="h-8 px-3 rounded-[8px] border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> อนุมัติ
          </button>
          <button className="h-8 px-3 rounded-[8px] border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition inline-flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> ส่งเข้าบัญชี
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="h-8 px-3 rounded-[8px] border border-rose-200 dark:border-rose-500/30 bg-card text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {bulkDeleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />}
            ลบ
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition">
            ยกเลิก
          </button>
        </div>
      )}

      {/* Table view */}
      {view === "table" && filtered.length > 0 && (
        <div className="bg-card border border-border rounded-[12px] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11.5px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="pl-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={e => setSelected(e.target.checked ? new Set(filtered.map(d => d.id)) : new Set())}
                      className="h-4 w-4 rounded border-border accent-brand-500"
                    />
                  </th>
                  <th className="py-3 font-medium">ผู้ขาย / ไฟล์</th>
                  <th className="py-3 font-medium hidden md:table-cell">หมวดหมู่</th>
                  <th className="py-3 font-medium text-right">ยอดเงิน</th>
                  <th className="py-3 font-medium text-right hidden sm:table-cell">VAT</th>
                  <th className="py-3 font-medium">สถานะ</th>
                  <th className="py-3 font-medium hidden sm:table-cell">วันที่</th>
                  <th className="py-3 pr-4 font-medium w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-muted/40 transition group">
                    <td className="pl-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="h-4 w-4 rounded border-border accent-brand-500"
                      />
                    </td>
                    <td className="py-3">
                      <Link href={`/documents/${doc.id}/review`} className="flex items-center gap-2.5 min-w-0">
                        <span className="h-9 w-9 rounded-[8px] bg-muted text-lg flex items-center justify-center shrink-0">
                          {getThumb(doc.vendor_name)}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-medium text-foreground truncate max-w-[180px]">
                            {doc.vendor_name ?? "—"}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span className="truncate max-w-[120px]">{doc.doc_number ?? doc.id.slice(0, 8)}</span>
                            <span>·</span>
                            <SourceIcon source={doc.source} />
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 text-[12.5px] text-muted-foreground hidden md:table-cell">
                      {doc.doc_category ?? doc.doc_type ?? "—"}
                    </td>
                    <td className="py-3 text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                      {doc.total_amount != null ? formatThb(doc.total_amount) : "—"}
                    </td>
                    <td className="py-3 text-right text-[12.5px] text-muted-foreground tabular-nums whitespace-nowrap hidden sm:table-cell">
                      {doc.vat_amount != null ? formatThb(doc.vat_amount) : "—"}
                    </td>
                    <td className="py-3"><StatusBadge status={doc.status} /></td>
                    <td className="py-3 text-[12.5px] text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {doc.doc_date ? formatDate(doc.doc_date) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1">
                        {(doc.status === "failed" || doc.status === "pending") ? (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); handleRetry(doc.id) }}
                              disabled={!!acting[doc.id]}
                              title="ประมวลผลใหม่"
                              className="h-7 w-7 rounded-[6px] hover:bg-brand-50 dark:hover:bg-brand-500/10 flex items-center justify-center text-brand-600 dark:text-brand-400 disabled:opacity-50"
                            >
                              {acting[doc.id] === "retry"
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <RefreshCw className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(doc.id) }}
                              disabled={!!acting[doc.id]}
                              title="ลบเอกสาร"
                              className="h-7 w-7 rounded-[6px] hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center justify-center text-rose-500 disabled:opacity-50"
                            >
                              {acting[doc.id] === "delete"
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </button>
                          </>
                        ) : (
                          <>
                            <Link
                              href={`/documents/${doc.id}/review`}
                              className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center text-muted-foreground"
                              onClick={e => e.stopPropagation()}
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                            <button className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center text-muted-foreground">
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card view */}
      {view === "card" && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(doc => {
            const canRetry = doc.status === "failed" || doc.status === "pending"
            const CardWrapper = canRetry ? "div" : Link as any
            const wrapperProps = canRetry
              ? {}
              : { href: `/documents/${doc.id}/review` }

            return (
              <CardWrapper
                key={doc.id}
                {...wrapperProps}
                className={cn(
                  "bg-card border rounded-[12px] p-4 transition block",
                  canRetry
                    ? "border-rose-200 dark:border-rose-500/30"
                    : "border-border cursor-pointer hover:shadow-md hover:border-brand-300 dark:hover:border-brand-600"
                )}
              >
                <div className={cn(
                  "aspect-[4/3] rounded-[10px] bg-muted flex items-center justify-center text-5xl mb-3 relative",
                  canRetry && "opacity-50"
                )}>
                  {getThumb(doc.vendor_name)}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-foreground truncate">
                      {doc.vendor_name ?? "—"}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {doc.doc_number ?? doc.id.slice(0, 8)}
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-end justify-between">
                  <div>
                    <div className="text-[16px] font-bold text-foreground tabular-nums">
                      {doc.total_amount != null ? formatThb(doc.total_amount) : "—"}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground tabular-nums">
                      VAT {doc.vat_amount != null ? formatThb(doc.vat_amount) : "—"}
                    </div>
                  </div>
                  <div className="text-right text-[10.5px] text-muted-foreground">
                    <div>{doc.doc_date ? formatDate(doc.doc_date) : "—"}</div>
                    <div className="mt-1"><SourceIcon source={doc.source} /></div>
                  </div>
                </div>
                {canRetry && (
                  <div className="mt-3 pt-3 border-t border-rose-100 dark:border-rose-500/20 flex gap-2">
                    <button
                      onClick={e => { e.stopPropagation(); handleRetry(doc.id) }}
                      disabled={!!acting[doc.id]}
                      className="flex-1 h-8 rounded-[8px] border border-brand-300 dark:border-brand-600 text-brand-600 dark:text-brand-400 text-[12px] font-medium flex items-center justify-center gap-1.5 hover:bg-brand-50 dark:hover:bg-brand-500/10 disabled:opacity-50 transition"
                    >
                      {acting[doc.id] === "retry"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5" />}
                      Retry
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(doc.id) }}
                      disabled={!!acting[doc.id]}
                      className="h-8 w-8 rounded-[8px] border border-rose-200 dark:border-rose-500/30 text-rose-500 flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 transition"
                    >
                      {acting[doc.id] === "delete"
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </CardWrapper>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-[12px] p-16 text-center">
          <div className="inline-flex h-16 w-16 rounded-full bg-muted items-center justify-center mb-4">
            <Inbox className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground">ไม่พบเอกสารตามเงื่อนไข</h3>
          <p className="text-sm text-muted-foreground mt-1">ลองเปลี่ยน Filter หรือคำค้นหา</p>
        </div>
      )}
    </div>
  )
}
