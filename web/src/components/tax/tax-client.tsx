"use client"

import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { formatThb, formatDate } from "@/lib/utils"
import { AlertTriangle, AlertCircle, CalendarClock, Download } from "lucide-react"

interface Props { orgId: string }

export function TaxClient({ orgId }: Props) {
  const t   = useTranslations("tax")
  const now = new Date()

  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [vat,   setVat]   = useState<any>(null)
  const [wht,   setWht]   = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const API = process.env.NEXT_PUBLIC_APP_URL

  useEffect(() => {
    setLoading(true)
    const safeJson = (r: Response) => r.text().then(t => t ? JSON.parse(t) : {})
    Promise.all([
      fetch(`${API}/api/tax/vat?orgId=${orgId}&year=${year}&month=${month}`).then(safeJson).catch(() => ({})),
      fetch(`${API}/api/tax/wht?orgId=${orgId}&year=${year}&month=${month}`).then(safeJson).catch(() => ({})),
    ]).then(([vatData, whtData]) => {
      setVat(vatData); setWht(whtData)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, year, month])

  const daysLeft = vat?.due_date
    ? Math.ceil((new Date(vat.due_date).getTime() - Date.now()) / 86400000)
    : null

  const exportWht = async (form: string) => {
    const url = `${API}/api/tax/wht/export?orgId=${orgId}&year=${year}&month=${month}&form=${form}`
    const res  = await fetch(url)
    const blob = await res.blob()
    const a    = document.createElement("a")
    a.href     = URL.createObjectURL(blob)
    a.download = `wht-${form}-${year}-${String(month).padStart(2,"0")}.xlsx`
    a.click()
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i).toLocaleString("th-TH", { month: "long" }),
  }))

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i)

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-semibold">{t("title")}</h2>

        {/* Period selector */}
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
            {years.map(y => <option key={y} value={y}>{y + 543}</option>)}
          </select>
        </div>
      </div>

      {/* Due date banner */}
      {daysLeft != null && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          daysLeft < 0
            ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
            : daysLeft <= 5
            ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"
            : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
        }`}>
          {daysLeft < 0 ? <AlertTriangle className="w-5 h-5 shrink-0" />
          : daysLeft <= 5 ? <AlertCircle className="w-5 h-5 shrink-0" />
          : <CalendarClock className="w-5 h-5 shrink-0" />}
          <div className="text-sm">
            {daysLeft < 0
              ? `${t("overdue")} — เลยกำหนดมาแล้ว ${Math.abs(daysLeft)} วัน`
              : daysLeft <= 5
              ? `⚠️ ${t("dueSoon")} — ${t("daysLeft").replace("{days}", String(daysLeft))} (${formatDate(vat?.due_date)})`
              : `${t("dueDate")}: ${formatDate(vat?.due_date)} — ${t("daysLeft").replace("{days}", String(daysLeft))}`
            }
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">กำลังโหลด...</div>
      ) : (
        <>
          {/* ภ.พ.30 */}
          <div className="rounded-xl border bg-card p-5 space-y-4">
            <h3 className="font-semibold">{t("vat30")}</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: t("vatInput"),  value: formatThb(vat?.input?.vat),  color: "text-emerald-500" },
                { label: t("vatOutput"), value: formatThb(vat?.output?.vat), color: "text-brand-500" },
                { label: vat?.net_vat >= 0 ? t("vatPayable") : t("vatRefund"),
                  value: formatThb(Math.abs(vat?.net_vat ?? 0)),
                  color: vat?.net_vat >= 0 ? "text-red-500" : "text-blue-500" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg bg-muted/30 p-4">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ภ.ง.ด.3/53 */}
          {[
            { title: t("wht3"),  form: "3" },
            { title: t("wht53"), form: "53" },
          ].map(({ title, form }) => (
            <div key={form} className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{title}</h3>
                <button
                  onClick={() => exportWht(form)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                    rounded-lg border hover:bg-muted transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t("exportExcel")}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 font-medium">ชื่อผู้ถูกหัก</th>
                      <th className="text-left py-2 font-medium">Tax ID</th>
                      <th className="text-right py-2 font-medium">อัตรา</th>
                      <th className="text-right py-2 font-medium">ยอดเงินได้</th>
                      <th className="text-right py-2 font-medium">ภาษีที่หัก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {wht?.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-2.5 font-medium">{item.vendor_name}</td>
                        <td className="py-2.5 text-muted-foreground font-mono text-xs">{item.vendor_tax_id}</td>
                        <td className="py-2.5 text-right">{item.wht_rate}%</td>
                        <td className="py-2.5 text-right">{formatThb(item.base_amount)}</td>
                        <td className="py-2.5 text-right font-medium text-red-500">{formatThb(item.wht_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td colSpan={3} className="pt-2.5">รวมทั้งสิ้น</td>
                      <td className="pt-2.5 text-right">{formatThb(wht?.total_base)}</td>
                      <td className="pt-2.5 text-right text-red-500">{formatThb(wht?.total_wht)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
