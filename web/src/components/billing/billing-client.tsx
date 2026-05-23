"use client"

import { useState } from "react"
import { Check, Download, Zap, Star, Building2, PackagePlus } from "lucide-react"
import { formatThb, formatDate, cn } from "@/lib/utils"

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "ฟรีตลอด",
    features: ["50 เอกสาร/เดือน", "เชื่อมต่อ 1 ตัว", "1 ผู้ใช้งาน"],
    cta: "แพ็กเกจปัจจุบัน",
    featured: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: 490,
    period: "/เดือน",
    features: ["500 เอกสาร/เดือน", "เชื่อมต่อ 3 ตัว", "3 ผู้ใช้งาน", "ส่งออก PP.30"],
    cta: "อัปเกรด",
    featured: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 990,
    period: "/เดือน",
    badge: "แนะนำ",
    features: ["เอกสารไม่จำกัด", "เชื่อมต่อทุกตัว", "ผู้ใช้ไม่จำกัด", "API + Webhooks", "AI ระดับสูง · 99% accuracy"],
    cta: "อัปเกรดเป็น Pro",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    period: "",
    features: ["ทุกอย่างใน Pro", "SSO / SAML", "Custom AI training", "Dedicated CSM"],
    cta: "ติดต่อสอบถาม",
    featured: false,
  },
]

const ADDONS = [
  { qty: 100, price: 199, per: 1.99 },
  { qty: 300, price: 499, per: 1.66, best: true },
  { qty: 500, price: 799, per: 1.60 },
]

const SAMPLE_INVOICES = [
  { no: "SF-2604-00318", date: "2026-04-01", plan: "Pro · เดือน เม.ย. 2026",    amount: 990 },
  { no: "SF-2603-00271", date: "2026-03-01", plan: "Pro · เดือน มี.ค. 2026",    amount: 990 },
  { no: "SF-2602-00224", date: "2026-02-01", plan: "Pro · เดือน ก.พ. 2026",    amount: 990 },
  { no: "SF-2602-00190", date: "2026-02-04", plan: "Doc Pack 300 ใบ",            amount: 499 },
  { no: "SF-2601-00164", date: "2026-01-01", plan: "Starter · เดือน ม.ค. 2026", amount: 490 },
]

interface Props {
  org:      any
  invoices: any[]
  plans:    any[]
  userRole: string
}

export function BillingClient({ org, invoices: dbInvoices, plans: dbPlans, userRole }: Props) {
  const [selectedAddon, setSelectedAddon] = useState<number | null>(null)

  const plan    = org?.plan ?? "free"
  const used    = org?.doc_used  ?? (plan === "pro" ? 120 : 32)
  const cap     = org?.doc_quota ?? (plan === "pro" ? 500  : 50)
  const pct     = Math.min(100, Math.round((used / cap) * 100))
  const barTone = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-brand-500"

  const invoices = dbInvoices.length > 0 ? dbInvoices : SAMPLE_INVOICES

  return (
    <div className="p-6 lg:p-7 space-y-6 max-w-[1100px] animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-bold text-foreground">การเรียกเก็บเงิน</h2>
        <p className="text-[12.5px] text-muted-foreground mt-0.5">จัดการแพ็กเกจและการชำระเงิน</p>
      </div>

      {/* Current plan card */}
      <div className="bg-card border border-border rounded-[12px] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              แพ็กเกจปัจจุบัน
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[24px] font-bold text-foreground capitalize">{plan}</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
                bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> ใช้งานอยู่
              </span>
            </div>
            <p className="text-[12.5px] text-muted-foreground mt-1">ต่ออายุอัตโนมัติทุกเดือน</p>
          </div>
          <div className="text-right">
            <div className="text-[28px] font-bold text-foreground tabular-nums">
              {plan === "free" ? "฿0" : plan === "starter" ? "฿490" : plan === "pro" ? "฿990" : "Custom"}
            </div>
            <div className="text-[12px] text-muted-foreground">/เดือน</div>
          </div>
        </div>
        {/* Usage bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] font-medium text-foreground">เอกสารที่ใช้</span>
            <span className="text-[12px] text-muted-foreground tabular-nums">
              {used.toLocaleString()} / {cap >= 999999 ? "∞" : cap.toLocaleString()} ใบ
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barTone}`} style={{ width: `${pct}%` }} />
          </div>
          {pct >= 80 && (
            <p className="text-[11.5px] text-amber-600 dark:text-amber-400 mt-1.5">
              ⚠️ คุณใช้โควต้าไปแล้ว {pct}% — พิจารณาอัปเกรดหรือซื้อแพ็กเกจเพิ่ม
            </p>
          )}
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 className="text-[15px] font-semibold text-foreground mb-4">เปรียบเทียบแพ็กเกจ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(p => (
            <div key={p.id} className={cn(
              "bg-card border rounded-[12px] p-5 flex flex-col relative",
              p.featured ? "border-brand-500 ring-2 ring-brand-500/20" : "border-border"
            )}>
              {p.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px]
                    font-semibold bg-brand-500 text-white whitespace-nowrap">
                    <Star className="w-3 h-3" /> {p.badge}
                  </span>
                </div>
              )}
              <div>
                <h4 className="text-[15px] font-bold text-foreground">{p.name}</h4>
                <div className="mt-2 flex items-baseline gap-1">
                  {p.price !== null ? (
                    <>
                      <span className="text-[28px] font-bold text-foreground tabular-nums">
                        ฿{p.price.toLocaleString()}
                      </span>
                      <span className="text-[12px] text-muted-foreground">{p.period}</span>
                    </>
                  ) : (
                    <span className="text-[18px] font-bold text-foreground">Custom</span>
                  )}
                </div>
              </div>
              <ul className="mt-4 space-y-2.5 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground">
                    <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                disabled={p.id === plan}
                className={cn(
                  "mt-5 h-9 rounded-[10px] text-sm font-medium transition-colors w-full",
                  p.featured
                    ? "bg-brand-500 hover:bg-brand-600 text-white"
                    : p.id === plan
                    ? "bg-muted text-muted-foreground cursor-default"
                    : "border border-border bg-card text-foreground hover:bg-muted"
                )}>
                {p.id === plan ? "แพ็กเกจปัจจุบัน" : p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add-on doc packs */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-[15px] font-semibold text-foreground">ซื้อเอกสารเพิ่ม</h3>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium
            bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <Zap className="w-3 h-3" /> One-time
          </span>
        </div>
        <p className="text-[12.5px] text-muted-foreground mb-4">ซื้อครั้งเดียว ใช้ได้ทันที ไม่มีวันหมดอายุ</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {ADDONS.map((a, i) => (
            <div
              key={i}
              onClick={() => setSelectedAddon(selectedAddon === i ? null : i)}
              className={cn(
                "bg-card border rounded-[12px] p-5 relative cursor-pointer transition-all",
                selectedAddon === i
                  ? "border-brand-500 ring-2 ring-brand-500/20"
                  : "border-border hover:border-brand-300"
              )}>
              {a.best && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px]
                    font-semibold bg-emerald-500 text-white whitespace-nowrap">
                    คุ้มที่สุด
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-[10px] bg-brand-500/10 flex items-center justify-center">
                  <PackagePlus className="w-5 h-5 text-brand-500" />
                </div>
                <div>
                  <div className="text-[18px] font-bold text-foreground tabular-nums">+{a.qty} ใบ</div>
                  <div className="text-[11.5px] text-muted-foreground">฿{a.per.toFixed(2)}/ใบ</div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[20px] font-bold text-foreground tabular-nums">฿{a.price}</div>
                  <div className="text-[11px] text-muted-foreground">one-time</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {selectedAddon !== null && (
          <div className="mt-3 flex justify-end">
            <button className="h-9 px-5 rounded-[10px] bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium
              transition-colors inline-flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              ซื้อ +{ADDONS[selectedAddon].qty} ใบ · ฿{ADDONS[selectedAddon].price}
            </button>
          </div>
        )}
      </div>

      {/* Invoice history */}
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[15px] font-semibold text-foreground">ประวัติการชำระเงิน</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11.5px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-2.5 font-medium">เลขที่</th>
                <th className="text-left px-3 py-2.5 font-medium">วันที่</th>
                <th className="text-left px-3 py-2.5 font-medium">รายการ</th>
                <th className="text-right px-3 py-2.5 font-medium">ยอด</th>
                <th className="text-left px-3 py-2.5 font-medium">สถานะ</th>
                <th className="text-right pr-5 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.map((inv: any, i: number) => (
                <tr key={inv.no ?? inv.id ?? i} className="hover:bg-muted/30">
                  <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                    {inv.no ?? inv.invoice_number ?? `INV-${i + 1}`}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {formatDate(inv.date ?? inv.created_at ?? "")}
                  </td>
                  <td className="px-3 py-3 font-medium text-foreground">
                    {inv.plan ?? inv.description ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-foreground">
                    {formatThb(inv.amount ?? inv.amount_thb ?? 0)}
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]
                      font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ชำระแล้ว
                    </span>
                  </td>
                  <td className="px-3 py-3 pr-5 text-right">
                    <button className="h-7 w-7 rounded-[6px] hover:bg-muted flex items-center justify-center
                      text-muted-foreground ml-auto transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
