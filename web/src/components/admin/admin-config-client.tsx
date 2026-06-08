"use client"

import { useState, useTransition } from "react"
import { Save, RotateCcw, AlertCircle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

type Config = {
  key:         string
  value:       unknown
  description: string | null
  updated_at:  string
  updated_by:  string | null
}

// Human-readable labels and input types per key
const KEY_META: Record<string, { label: string; type: "number" | "boolean" | "string" | "select"; options?: string[] }> = {
  free_plan_org_quota:     { label: "Free Plan — จำนวน Org สูงสุด",        type: "number" },
  starter_plan_org_quota:  { label: "Starter Plan — จำนวน Org สูงสุด",     type: "number" },
  personal_plan_org_quota: { label: "Personal Plan — จำนวน Org สูงสุด",    type: "number" },
  maintenance_mode:        { label: "Maintenance Mode",                      type: "boolean" },
  new_user_default_plan:   { label: "Default Plan สำหรับ user ใหม่",        type: "select", options: ["free","starter","personal","sme","business"] },
  max_file_size_mb:        { label: "ขนาดไฟล์สูงสุด (MB)",                  type: "number" },
  ai_extraction_enabled:   { label: "เปิดใช้ AI OCR Extraction",            type: "boolean" },
  line_bot_enabled:        { label: "เปิดใช้ LINE Bot",                      type: "boolean" },
  email_ingestion_enabled: { label: "เปิดใช้ Email Ingestion",               type: "boolean" },
  camera_upload_enabled:   { label: "เปิดใช้ Camera Upload (web)",           type: "boolean" },
}

const GROUPS = [
  {
    title:  "Plan Limits — Organization Quota",
    desc:   "จำนวน organization สูงสุดที่ user แต่ละ plan สามารถสร้างได้ (0 = ไม่จำกัด)",
    keys:   ["free_plan_org_quota", "starter_plan_org_quota", "personal_plan_org_quota"],
  },
  {
    title:  "Feature Flags",
    desc:   "เปิด-ปิด feature โดยไม่ต้อง deploy",
    keys:   ["ai_extraction_enabled", "line_bot_enabled", "email_ingestion_enabled", "camera_upload_enabled"],
  },
  {
    title:  "App Settings",
    desc:   "การตั้งค่าทั่วไปของระบบ",
    keys:   ["maintenance_mode", "new_user_default_plan", "max_file_size_mb"],
  },
]

async function saveConfig(key: string, value: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/admin/config", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ key, value }),
  })
  const data = await res.json()
  return res.ok ? { ok: true } : { ok: false, error: data.error }
}

function ConfigRow({ config, onSaved }: { config: Config; onSaved: (key: string) => void }) {
  const meta     = KEY_META[config.key]
  const [val, setVal]   = useState(() => {
    const v = config.value
    if (meta?.type === "boolean") return String(v) === "true"
    if (meta?.type === "number")  return String(v).replace(/"/g, "")
    return String(v).replace(/^"|"$/g, "")  // strip JSON string quotes
  })
  const [saved,  setSaved]  = useState(false)
  const [err,    setErr]    = useState("")
  const [pending, startT]   = useTransition()
  const original = (() => {
    const v = config.value
    if (meta?.type === "boolean") return String(v) === "true"
    if (meta?.type === "number")  return String(v).replace(/"/g, "")
    return String(v).replace(/^"|"$/g, "")
  })()
  const dirty = String(val) !== String(original)

  const handleSave = () => {
    startT(async () => {
      setErr("")
      let parsedVal: unknown = val
      if (meta?.type === "number")  parsedVal = Number(val)
      if (meta?.type === "boolean") parsedVal = val === true || val === "true"
      const result = await saveConfig(config.key, parsedVal)
      if (result.ok) {
        setSaved(true); setTimeout(() => setSaved(false), 2000)
        onSaved(config.key)
      } else {
        setErr(result.error ?? "เกิดข้อผิดพลาด")
      }
    })
  }

  return (
    <div className={cn(
      "flex items-start gap-4 px-5 py-4 border-b border-zinc-800/60 last:border-b-0",
      dirty && "bg-amber-950/20"
    )}>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-zinc-200">
          {meta?.label ?? config.key}
        </div>
        {config.description && (
          <div className="text-[11.5px] text-zinc-500 mt-0.5">{config.description}</div>
        )}
        <div className="text-[10.5px] text-zinc-600 mt-1 font-mono">{config.key}</div>
        {err && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
            <AlertCircle className="w-3 h-3" /> {err}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 shrink-0">
        {meta?.type === "boolean" ? (
          <button
            onClick={() => setVal(v => !v)}
            className={cn(
              "w-11 h-6 rounded-full transition-colors relative",
              val ? "bg-emerald-500" : "bg-zinc-700"
            )}
          >
            <span className={cn(
              "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
              val ? "translate-x-5" : "translate-x-0.5"
            )} />
          </button>
        ) : meta?.type === "select" ? (
          <select
            value={String(val)}
            onChange={e => setVal(e.target.value)}
            className="h-8 px-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm outline-none focus:border-brand-500"
          >
            {meta.options?.map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        ) : (
          <input
            type={meta?.type === "number" ? "number" : "text"}
            value={String(val)}
            onChange={e => setVal(meta?.type === "number" ? e.target.value : e.target.value)}
            className="h-8 w-24 px-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200
              text-sm text-right outline-none focus:border-brand-500 tabular-nums"
          />
        )}

        {/* Reset */}
        {dirty && (
          <button
            onClick={() => setVal(original)}
            title="Reset"
            className="h-7 w-7 rounded-md hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!dirty || pending}
          className={cn(
            "h-7 px-3 rounded-md text-xs font-semibold transition-all inline-flex items-center gap-1.5",
            saved
              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              : dirty
              ? "bg-brand-500 hover:bg-brand-600 text-white"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          )}
        >
          {saved
            ? <><CheckCircle2 className="w-3 h-3" /> Saved</>
            : pending
            ? "Saving..."
            : <><Save className="w-3 h-3" /> Save</>
          }
        </button>
      </div>
    </div>
  )
}

export function AdminConfigClient({ configs }: { configs: Config[] }) {
  const [savedKeys, setSavedKeys] = useState<string[]>([])
  const configMap = Object.fromEntries(configs.map(c => [c.key, c]))

  return (
    <div className="space-y-6">
      {GROUPS.map(group => {
        const groupConfigs = group.keys.map(k => configMap[k]).filter(Boolean)
        if (!groupConfigs.length) return null
        return (
          <div key={group.title} className="bg-zinc-900 border border-zinc-800 rounded-[14px] overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/40">
              <h2 className="text-[14px] font-bold text-white">{group.title}</h2>
              <p className="text-[12px] text-zinc-400 mt-0.5">{group.desc}</p>
            </div>
            {groupConfigs.map(config => (
              <ConfigRow
                key={config.key}
                config={config}
                onSaved={key => setSavedKeys(p => [...p, key])}
              />
            ))}
          </div>
        )
      })}

      {/* Unknown keys */}
      {configs.filter(c => !Object.keys(KEY_META).includes(c.key)).length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-[14px] overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-800 bg-zinc-800/40">
            <h2 className="text-[14px] font-bold text-white">Other</h2>
          </div>
          {configs.filter(c => !Object.keys(KEY_META).includes(c.key)).map(config => (
            <ConfigRow key={config.key} config={config} onSaved={key => setSavedKeys(p => [...p, key])} />
          ))}
        </div>
      )}
    </div>
  )
}
