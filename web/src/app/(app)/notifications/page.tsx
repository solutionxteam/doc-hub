import { Bell, CheckCircle2, AlertCircle, FileText, Zap } from "lucide-react"

export default function NotificationsPage() {
  const items = [
    { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", title: "เอกสารอนุมัติแล้ว", desc: "ใบเสร็จ AWS (฿8,750) ถูกอนุมัติและส่งเข้า FlowAccount", time: "2 นาทีที่แล้ว", read: false },
    { icon: FileText,     color: "text-brand-500",   bg: "bg-brand-500/10",   title: "เอกสารใหม่จาก LINE", desc: "ได้รับสลิปจาก @slippy_bot — กำลัง OCR", time: "14 นาทีที่แล้ว", read: false },
    { icon: AlertCircle,  color: "text-amber-500",   bg: "bg-amber-500/10",   title: "พบเอกสารซ้ำ", desc: "ใบเสร็จ Grab อาจซ้ำกับ GR-2026-005112 — กรุณาตรวจสอบ", time: "1 ชม.ที่แล้ว", read: false },
    { icon: Zap,          color: "text-purple-500",  bg: "bg-purple-500/10",  title: "ส่ง FlowAccount สำเร็จ", desc: "3 เอกสารถูกส่งเข้าบัญชีเรียบร้อย", time: "3 ชม.ที่แล้ว", read: true },
    { icon: AlertCircle,  color: "text-rose-500",    bg: "bg-rose-500/10",    title: "โควต้าใกล้เต็ม", desc: "ใช้ไป 82% ของโควต้าเดือนนี้ (41/50 เอกสาร)", time: "เมื่อวาน", read: true },
  ]

  return (
    <div className="p-6 lg:p-7 max-w-[700px] animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">การแจ้งเตือน</h2>
          <p className="text-muted-foreground text-sm mt-0.5">3 รายการยังไม่ได้อ่าน</p>
        </div>
        <button className="text-xs font-medium text-brand-600 hover:underline">อ่านทั้งหมด</button>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden divide-y">
        {items.map((item, i) => (
          <div key={i} className={`flex gap-4 px-5 py-4 hover:bg-muted/50 transition-colors ${!item.read ? "bg-brand-50/50 dark:bg-brand-900/10" : ""}`}>
            <div className={`w-9 h-9 rounded-[10px] ${item.bg} flex items-center justify-center shrink-0 mt-0.5`}>
              <item.icon className={`w-4 h-4 ${item.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug">{item.title}</p>
                {!item.read && <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1" />}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">{item.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
