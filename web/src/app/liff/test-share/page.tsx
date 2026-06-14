"use client"

/**
 * /liff/test-share — minimal diagnostic page for liff.shareTargetPicker().
 *
 * Use this to isolate whether shareTargetPicker actually DELIVERS messages
 * to the picked chat, separate from any app logic. Open this page from
 * inside the LINE app, tap a test button, pick a group/chat, then check
 * that chat for the message.
 */

import { useEffect, useState } from "react"

type Status = "init" | "checking" | "ready" | "outsideLine" | "needLogin" | "error"

export default function TestSharePage() {
  const [status, setStatus] = useState<Status>("init")
  const [info, setInfo] = useState<Record<string, any>>({})
  const [log, setLog] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  function addLog(line: string) {
    setLog(l => [`${new Date().toLocaleTimeString()}  ${line}`, ...l])
  }

  useEffect(() => { init() }, [])

  async function init() {
    setStatus("checking")
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) {
      setStatus("error")
      addLog("❌ NEXT_PUBLIC_LIFF_ID ไม่พบ")
      return
    }

    try {
      const liff = (await import("@line/liff")).default
      await liff.init({ liffId })

      const ctx = liff.getContext?.()
      const shareAvailable = !!liff.isApiAvailable?.("shareTargetPicker")

      setInfo({
        liffId,
        isInClient: liff.isInClient(),
        isLoggedIn: liff.isLoggedIn(),
        os: liff.getOS?.(),
        lineVersion: liff.getLineVersion?.(),
        contextType: ctx?.type,
        contextGroupId: ctx?.groupId ?? ctx?.roomId ?? null,
        shareTargetPickerAvailable: shareAvailable,
      })
      addLog(`✅ liff.init เสร็จ — shareTargetPicker available = ${shareAvailable}`)

      if (!liff.isInClient()) { setStatus("outsideLine"); return }
      if (!liff.isLoggedIn()) { setStatus("needLogin"); return }
      setStatus("ready")
    } catch (err: any) {
      setStatus("error")
      addLog(`❌ liff.init ล้มเหลว: ${err?.message ?? "unknown error"}`)
    }
  }

  async function send(label: string, messages: any[]) {
    setBusy(true)
    addLog(`▶️ กำลังส่ง "${label}"...`)
    try {
      const liff = (await import("@line/liff")).default
      if (!liff.isApiAvailable?.("shareTargetPicker")) {
        addLog("❌ shareTargetPicker ไม่พร้อมใช้งานในเครื่องนี้")
        return
      }
      const result = await liff.shareTargetPicker(messages as any)
      addLog(`◀️ shareTargetPicker resolve: ${JSON.stringify(result)}`)
      if (result === null) addLog("ℹ️ ผู้ใช้กดยกเลิก picker")
      else addLog("✅ Picker resolve สำเร็จ — ตรวจสอบแชทที่เลือกว่าได้รับข้อความจริงหรือไม่")
    } catch (err: any) {
      addLog(`❌ ข้อผิดพลาด: ${err?.message ?? "unknown error"}`)
    } finally {
      setBusy(false)
    }
  }

  const textMsg = [{ type: "text", text: `🧪 ทดสอบข้อความธรรมดา — ${new Date().toLocaleTimeString()}` }]

  const flexMsg = [{
    type: "flex",
    altText: "🧪 ทดสอบ Flex (ไม่มีปุ่ม)",
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "🧪 ทดสอบ Flex", weight: "bold", size: "lg" },
          { type: "text", text: `ส่งเมื่อ ${new Date().toLocaleTimeString()}`, size: "sm", color: "#555555" },
        ],
      },
    },
  }]

  const flexPostbackMsg = [{
    type: "flex",
    altText: "🧪 ทดสอบ Flex + ปุ่ม Postback",
    contents: {
      type: "bubble",
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          { type: "text", text: "🧪 ทดสอบ Flex + Postback", weight: "bold", size: "lg" },
          { type: "text", text: `ส่งเมื่อ ${new Date().toLocaleTimeString()}`, size: "sm", color: "#555555" },
          { type: "separator", margin: "md" },
          { type: "button", style: "primary", height: "sm", margin: "md", color: "#10b981",
            action: { type: "postback", label: "✓ กดทดสอบ", data: "sport:testshare", displayText: "✓ กดทดสอบ" } },
        ],
      },
    },
  }]

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 text-sm">
      <h1 className="text-lg font-bold">🧪 ทดสอบ shareTargetPicker</h1>

      <div className="p-3 rounded-xl bg-muted/50 space-y-1">
        <p className="font-semibold">สถานะ: {status}</p>
        {Object.entries(info).map(([k, v]) => (
          <p key={k} className="text-xs text-muted-foreground">
            {k}: <span className="font-mono">{String(v)}</span>
          </p>
        ))}
      </div>

      {status === "outsideLine" && (
        <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          ⚠️ กรุณาเปิดหน้านี้จากภายในแอป LINE (isInClient = false)
        </p>
      )}
      {status === "needLogin" && (
        <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
          ⚠️ ยังไม่ได้ login LINE (isLoggedIn = false)
        </p>
      )}

      {status === "ready" && (
        <div className="space-y-2">
          <button
            onClick={() => send("ข้อความธรรมดา", textMsg)}
            disabled={busy}
            className="w-full h-11 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-50"
          >
            1. ส่งข้อความธรรมดา (text)
          </button>
          <button
            onClick={() => send("Flex ไม่มีปุ่ม", flexMsg)}
            disabled={busy}
            className="w-full h-11 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-50"
          >
            2. ส่ง Flex (ไม่มีปุ่ม)
          </button>
          <button
            onClick={() => send("Flex + Postback", flexPostbackMsg)}
            disabled={busy}
            className="w-full h-11 rounded-xl bg-violet-600 text-white font-semibold disabled:opacity-50"
          >
            3. ส่ง Flex + ปุ่ม Postback
          </button>
          <p className="text-xs text-muted-foreground">
            กดทีละปุ่ม เลือกแชทกลุ่มเดียวกัน แล้วเข้าไปดูในกลุ่มว่าข้อความไหนมาถึงบ้าง — ช่วยแยกได้ว่าปัญหาอยู่ที่ flex/postback หรือการส่งโดยรวม
          </p>
        </div>
      )}

      <div className="space-y-1">
        <p className="font-semibold">Log</p>
        <div className="p-3 rounded-xl bg-black/90 text-green-400 font-mono text-xs space-y-1 max-h-80 overflow-auto">
          {log.length === 0 && <p>—</p>}
          {log.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      </div>
    </div>
  )
}
