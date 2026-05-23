import { Users, Receipt, QrCode, SplitSquareHorizontal } from "lucide-react"

export default function SplitPage() {
  return (
    <div className="p-6 lg:p-7 max-w-[960px] animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <SplitSquareHorizontal className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">หารบิล</h2>
          <p className="text-muted-foreground text-sm">แชร์ค่าใช้จ่ายกับเพื่อนง่ายๆ</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { label: "บิลที่หารอยู่", value: "3", icon: Receipt, color: "text-brand-500", bg: "bg-brand-500/10" },
          { label: "คนค้างจ่าย", value: "5", icon: Users, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "ยอดรอรับ", value: "฿2,530", icon: QrCode, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className={`w-9 h-9 rounded-[10px] ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">บิลล่าสุด</h3>
          <button className="text-sm font-medium px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors text-xs">
            + สร้างบิลใหม่
          </button>
        </div>
        <div className="divide-y">
          {[
            { name: "MK Restaurants EmQuartier", total: "฿2,150", per: "฿358/คน", people: 6, thumb: "🍲", settled: 2, pending: 4 },
            { name: "ส้มตำนัวๆ ทองหล่อ", total: "฿420", per: "฿105/คน", people: 4, thumb: "🍜", settled: 4, pending: 0 },
          ].map((b) => (
            <div key={b.name} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">
                {b.thumb}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{b.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{b.people} คน · {b.per}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                    <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${(b.settled/b.people)*100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{b.settled}/{b.people} จ่ายแล้ว</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-sm">{b.total}</p>
                {b.pending > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 font-medium">
                    ค้าง {b.pending} คน
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
