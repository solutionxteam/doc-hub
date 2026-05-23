"use client"

import { useState }    from "react"
import { useRouter }   from "next/navigation"
import { Sparkles }    from "lucide-react"

export function SeedDemoButton() {
  const router  = useRouter()
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState(false)

  const handleSeed = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/seed-demo", { method: "POST" })
      if (res.ok) {
        setDone(true)
        router.refresh()
        setTimeout(() => setDone(false), 3000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSeed}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg
        border border-dashed border-brand-400 text-brand-600 hover:bg-brand-50
        dark:hover:bg-brand-900/20 transition-colors disabled:opacity-60"
    >
      <Sparkles className="w-3.5 h-3.5" />
      {loading ? "กำลังโหลด…" : done ? "โหลดแล้ว ✓" : "โหลดข้อมูล Demo"}
    </button>
  )
}
