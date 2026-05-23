"use client"

import { useState, useEffect, useCallback } from "react"
import { MessageCircle, RefreshCw, Trash2, Copy, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { formatDate } from "@/lib/utils"

interface LineConnection {
  id: string
  line_user_id: string
  display_name: string
  created_at: string
}

interface Props {
  orgId: string
  isAdmin: boolean
}

export function LineSection({ orgId, isAdmin }: Props) {
  const [connections, setConnections] = useState<LineConnection[]>([])
  const [loading,     setLoading]     = useState(true)
  const [genLoading,  setGenLoading]  = useState(false)
  const [code,        setCode]        = useState<string | null>(null)
  const [expiresAt,   setExpiresAt]   = useState<string | null>(null)
  const [copied,      setCopied]      = useState(false)

  const fetchConnections = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/line/connect?orgId=${orgId}`)
    const { connections } = await res.json()
    setConnections(connections ?? [])
    setLoading(false)
  }, [orgId])

  useEffect(() => { fetchConnections() }, [fetchConnections])

  const generateCode = async () => {
    setGenLoading(true)
    const res = await fetch("/api/line/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    })
    const data = await res.json()
    if (data.error) { toast.error(data.error); setGenLoading(false); return }
    setCode(data.code)
    setExpiresAt(data.expiresAt)
    setGenLoading(false)
  }

  const copyCode = async () => {
    if (!code) return
    await navigator.clipboard.writeText(`/connect ${code}`)
    setCopied(true)
    toast.success("คัดลอกแล้ว")
    setTimeout(() => setCopied(false), 2000)
  }

  const disconnect = async (id: string) => {
    await fetch("/api/line/connect", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: id }),
    })
    setConnections(prev => prev.filter(c => c.id !== id))
    toast.success("ยกเลิกการเชื่อมต่อแล้ว")
  }

  const timeLeft = expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000))
    : 0

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#06C755]/10 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-[#06C755]" />
        </div>
        <div>
          <p className="font-semibold text-sm">LINE Bot</p>
          <p className="text-xs text-muted-foreground">รับสลิปและดูรายงานผ่าน LINE</p>
        </div>
      </div>

      {/* Connected users */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>กำลังโหลด...</span>
        </div>
      ) : connections.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            บัญชีที่เชื่อมต่อ ({connections.length})
          </p>
          {connections.map(c => (
            <div key={c.id}
              className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">{c.display_name}</p>
                <p className="text-xs text-muted-foreground">เชื่อมเมื่อ {formatDate(c.created_at)}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => disconnect(c.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่มีบัญชี LINE ที่เชื่อมต่อ</p>
      )}

      {/* Generate code */}
      {isAdmin && (
        <div className="space-y-2">
          <button
            onClick={generateCode}
            disabled={genLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border
              hover:bg-muted transition-colors disabled:opacity-60"
          >
            {genLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />
            }
            สร้าง Connect Code
          </button>

          {code && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                ส่งคำสั่งนี้ใน LINE Bot (หมดอายุใน {timeLeft} นาที)
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-background px-2 py-1.5 rounded border">
                  /connect {code}
                </code>
                <button
                  onClick={copyCode}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                >
                  {copied
                    ? <Check className="w-4 h-4 text-emerald-500" />
                    : <Copy className="w-4 h-4" />
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
