"use client"

/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { useRef, useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import {
  Upload, Camera, Mail, Loader2, CheckCircle2,
  Copy, Check, X, ExternalLink, SwitchCamera, ZoomIn,
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { logClientError } from "@/lib/log-error"

// ─── Image compression constants ─────────────────────────────────────────────
const MAX_IMAGE_PX    = 1920           // longest side in pixels (sufficient for Claude vision)
const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2 MB — compress above this threshold
const COMPRESS_QUALITY = 0.85

/**
 * Compress + resize a raster image using Canvas.
 * – Resizes if the longest side exceeds MAX_IMAGE_PX
 * – Recompresses if the file size exceeds MAX_IMAGE_BYTES
 * – Always outputs JPEG (best size/quality trade-off for document scans)
 * – Skips compression if the image is already small enough
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file  // PDFs pass through

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file  // Can't decode — let server handle
  }

  const { width, height } = bitmap
  const longestSide  = Math.max(width, height)
  const needsResize  = longestSide > MAX_IMAGE_PX
  const needsCompress = file.size > MAX_IMAGE_BYTES

  if (!needsResize && !needsCompress) {
    bitmap.close()
    return file  // Already within limits — nothing to do
  }

  const scale   = needsResize ? MAX_IMAGE_PX / longestSide : 1
  const canvas  = document.createElement("canvas")
  canvas.width  = Math.round(width  * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error("toBlob returned null")),
      "image/jpeg",
      COMPRESS_QUALITY,
    )
  )

  const newName    = file.name.replace(/\.(jpe?g|png|webp|heic|heif)$/i, ".jpg")
  const compressed = new File([blob], newName, { type: "image/jpeg" })

  const savedPct = Math.round((1 - compressed.size / file.size) * 100)
  if (savedPct >= 5) {
    toast.info(
      `บีบอัดรูปภาพ −${savedPct}%` +
      ` (${(file.size / 1024 / 1024).toFixed(1)} → ${(compressed.size / 1024 / 1024).toFixed(1)} MB)`
    )
  }
  return compressed
}

// ─── HEIC → JPEG conversion + compression ────────────────────────────────────
//  Strategy 1: native createImageBitmap + Canvas  (iOS Safari 15.4+, no WASM)
//  Strategy 2: heic2any dynamic import fallback   (Chromium + WASM)
//  Strategy 3: upload as-is (last resort)
//  After any HEIC conversion, compressImage() runs to enforce size limits.
async function normalizeFile(file: File): Promise<File> {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name)

  // ── Non-HEIC: just compress/resize ───────────────────────────────────────────
  if (!isHeic) return compressImage(file)

  const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg")
  const fileCtx = {
    file_name: file.name,
    file_size: file.size,
    file_type: file.type || "(empty — browser didn't set MIME)",
    file_ext:  file.name.split(".").pop()?.toLowerCase(),
  }

  // ── Strategy 1: native createImageBitmap + Canvas ────────────────────────────
  try {
    const bitmap = await createImageBitmap(file)
    const canvas  = document.createElement("canvas")
    const scale   = Math.min(1, MAX_IMAGE_PX / Math.max(bitmap.width, bitmap.height))
    canvas.width  = Math.round(bitmap.width  * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob returned null")), "image/jpeg", COMPRESS_QUALITY)
    )
    toast.info("แปลง HEIC → JPEG เสร็จแล้ว")
    return new File([blob], newName, { type: "image/jpeg" })
  } catch (err1) {
    await logClientError("heic_conversion", err1, { ...fileCtx, strategy: "createImageBitmap" })
  }

  // ── Strategy 2: heic2any WASM ─────────────────────────────────────────────────
  try {
    const heic2any = (await import("heic2any")).default
    const blob     = await heic2any({ blob: file, toType: "image/jpeg", quality: COMPRESS_QUALITY }) as Blob
    toast.info("แปลง HEIC → JPEG เสร็จแล้ว (WASM)")
    // Result is already JPEG — still run through compressImage to enforce size limit
    return compressImage(new File([blob], newName, { type: "image/jpeg" }))
  } catch (err2) {
    await logClientError("heic_conversion", err2, { ...fileCtx, strategy: "heic2any" })
  }

  // ── Strategy 3: upload original (last resort) ─────────────────────────────────
  await logClientError("heic_conversion", new Error("all strategies failed — uploading original"), {
    ...fileCtx, strategy: "fallback_original",
  })
  toast.warning("ไม่สามารถแปลง HEIC ได้ — กำลังอัปโหลดต้นฉบับ")
  return file
}

// ─── Accepted types ───────────────────────────────────────────────────────────
const ACCEPT_ATTR = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
const MAX_BYTES   = 20 * 1024 * 1024   // 20 MB

// ─── Camera modal (shared between compact and full) ───────────────────────────
interface CameraModalProps {
  videoRef:        React.RefObject<HTMLVideoElement | null>
  cameraError:     string | null
  facingMode:      "environment" | "user"
  hasMultipleCams: boolean
  onClose:         () => void
  onCapture:       () => void
  onFlip:          () => void
  onFallback:      () => void
}
function CompactCameraModal({
  videoRef, cameraError, facingMode, hasMultipleCams,
  onClose, onCapture, onFlip, onFallback,
}: CameraModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <Camera className="w-12 h-12 text-white/40" />
            <p className="text-white/70 text-sm whitespace-pre-line">{cameraError}</p>
            <button
              onClick={onFallback}
              className="mt-2 px-4 py-2 rounded-[10px] bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              เลือกไฟล์แทน
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay playsInline muted
            className={cn("w-full h-full object-cover", facingMode === "user" && "scale-x-[-1]")}
          />
        )}
        {!cameraError && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[72%] max-w-sm aspect-[3/2] relative">
              {[
                "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
                "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
                "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
              ].map((cls, i) => (
                <span key={i} className={cn("absolute w-6 h-6 border-white/70", cls)} />
              ))}
            </div>
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>
        {!cameraError && (
          <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-xs backdrop-blur-sm bg-black/30 px-3 py-1 rounded-full whitespace-nowrap">
            จัดเอกสารให้อยู่ในกรอบ
          </p>
        )}
      </div>
      <div className="shrink-0 bg-black/90 backdrop-blur-sm px-8 py-6 flex items-center justify-between safe-area-pb">
        <div className="w-12 h-12 flex items-center justify-center">
          <ZoomIn className="w-5 h-5 text-white/30" />
        </div>
        <button
          onClick={onCapture}
          disabled={!!cameraError}
          className="w-16 h-16 rounded-full border-4 border-white bg-white/10 hover:bg-white/25 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 flex items-center justify-center shadow-lg shadow-black/50"
        >
          <div className="w-12 h-12 rounded-full bg-white" />
        </button>
        {hasMultipleCams ? (
          <button
            onClick={onFlip}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <SwitchCamera className="w-5 h-5 text-white" />
          </button>
        ) : (
          <div className="w-12 h-12" />
        )}
      </div>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  orgId:    string
  orgSlug?: string   // optional — email button is hidden when not provided
  compact?: boolean  // slim single-row strip for pages where upload is secondary
}

type Status = "idle" | "converting" | "uploading" | "processing" | "done"

// ─── Component ────────────────────────────────────────────────────────────────
export function DashboardUploadZone({ orgId, orgSlug, compact = false }: Props) {
  const router = useRouter()

  const [status,   setStatus]   = useState<Status>("idle")
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState("")
  const [isDrag,   setIsDrag]   = useState(false)

  // Email popover
  const [emailOpen, setEmailOpen] = useState(false)
  const [copied,    setCopied]    = useState(false)

  // Camera modal
  const [cameraOpen,       setCameraOpen]       = useState(false)
  const [facingMode,       setFacingMode]       = useState<"environment" | "user">("environment")
  const [cameraError,      setCameraError]      = useState<string | null>(null)
  const [hasMultipleCams,  setHasMultipleCams]  = useState(false)
  const videoRef  = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Hidden file inputs
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const uploadEmail = orgSlug ? `${orgSlug}@docs.slippy.app` : ""

  // ── Core upload logic ──────────────────────────────────────────────────────
  const processFile = useCallback(async (raw: File) => {
    if (raw.size > MAX_BYTES) {
      toast.error(`ไฟล์ใหญ่เกิน 20MB (${(raw.size / 1024 / 1024).toFixed(1)} MB)`)
      return
    }

    setStatus("converting")
    setFileName(raw.name)
    let file: File
    try {
      file = await normalizeFile(raw)
    } catch (err) {
      await logClientError("heic_conversion", err, {
        file_name: raw.name, file_size: raw.size, file_type: raw.type,
      })
      toast.error("แปลงไฟล์ไม่สำเร็จ กรุณาลองใหม่")
      setStatus("idle")
      return
    }
    setFileName(file.name)

    setStatus("uploading")
    setProgress(10)

    // createClient is called lazily here (not at render level) to avoid
    // SSR issues — createBrowserClient must only run in the browser.
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error("กรุณาเข้าสู่ระบบก่อน"); setStatus("idle"); return }

    const ext  = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
    const path = `${orgId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, file, { contentType: file.type })

    if (uploadError) {
      toast.error(uploadError.message)
      setStatus("idle")
      return
    }
    setProgress(30)

    // file_type must match DB CHECK constraint: ('pdf','jpg','png')
    const fileType =
      ext === "pdf" ? "pdf" :
      ext === "png" ? "png" :
      "jpg"

    const { data: doc, error: insertError } = await supabase
      .from("documents")
      .insert({
        organization_id: orgId,
        uploaded_by:     user.id,
        file_path:       path,
        file_type:       fileType,
        status:          "pending",
        source:          "web",
      })
      .select("id")
      .single()

    if (insertError || !doc) {
      toast.error(insertError?.message ?? "สร้าง record ไม่สำเร็จ")
      setStatus("idle")
      return
    }
    setProgress(40)

    setStatus("processing")
    await fetch(`/api/documents/${doc.id}/process`, { method: "POST" })

    const es = new EventSource(`/api/documents/${doc.id}/progress`)
    es.onmessage = (e) => {
      const payload = JSON.parse(e.data)
      if (payload.progress) setProgress(40 + payload.progress * 0.6)
      if (payload.status && ["reviewing", "approved", "failed"].includes(payload.status)) {
        es.close()
        setStatus("done")
        setProgress(100)
        setTimeout(() => router.push(`/documents/${doc.id}/review`), 800)
      }
    }
    es.onerror = () => {
      es.close()
      setStatus("done")
      router.push(`/documents/${doc.id}/review`)
    }
  }, [orgId, router])

  // ── Camera: stop stream helper ─────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  // ── Camera: close modal ────────────────────────────────────────────────────
  const closeCamera = useCallback(() => {
    stopStream()
    setCameraOpen(false)
    setCameraError(null)
  }, [stopStream])

  // ── Camera: open modal (getUserMedia) or fallback to file input ────────────
  const openCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click()
      return
    }
    setCameraError(null)
    setCameraOpen(true)
  }, [])

  // ── Camera: start stream when modal opens or facingMode changes ────────────
  useEffect(() => {
    if (!cameraOpen) return
    let active = true

    const start = async () => {
      try {
        // Stop any existing stream first
        streamRef.current?.getTracks().forEach(t => t.stop())

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (!active) { stream.getTracks().forEach(t => t.stop()); return }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }

        // Detect if multiple cameras available (for flip button)
        try {
          const devices = await navigator.mediaDevices.enumerateDevices()
          setHasMultipleCams(devices.filter(d => d.kind === "videoinput").length > 1)
        } catch { /* non-critical */ }

      } catch (err: unknown) {
        if (!active) return
        const name = (err as { name?: string })?.name ?? ""
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCameraError("ไม่ได้รับอนุญาตให้ใช้กล้อง\nกรุณาอนุญาตในการตั้งค่าเบราว์เซอร์")
        } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
          // No camera found — fall back to file input
          stopStream()
          setCameraOpen(false)
          cameraInputRef.current?.click()
        } else {
          setCameraError("เปิดกล้องไม่ได้ กรุณาลองใหม่")
        }
      }
    }

    start()
    return () => { active = false; stopStream() }
  }, [cameraOpen, facingMode, stopStream])

  // ── Camera: capture snapshot from video frame ──────────────────────────────
  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const canvas = document.createElement("canvas")
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext("2d")!.drawImage(video, 0, 0)

    canvas.toBlob(blob => {
      if (!blob) { toast.error("ถ่ายรูปไม่สำเร็จ"); return }
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" })
      closeCamera()
      processFile(file)
    }, "image/jpeg", 0.92)
  }, [closeCamera, processFile])

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDrag(true)  }
  const onDragLeave = ()                    => setIsDrag(false)
  const onDrop      = (e: React.DragEvent) => {
    e.preventDefault(); setIsDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  const copyEmail = async () => {
    await navigator.clipboard.writeText(uploadEmail)
    setCopied(true)
    toast.success("คัดลอกอีเมลแล้ว")
    setTimeout(() => setCopied(false), 2000)
  }

  // Close email popover on outside click
  useEffect(() => {
    if (!emailOpen) return
    const handler = (e: MouseEvent) => {
      const el = document.getElementById("email-popover")
      if (el && !el.contains(e.target as Node)) setEmailOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [emailOpen])

  // Close camera modal on Escape
  useEffect(() => {
    if (!cameraOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeCamera() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [cameraOpen, closeCamera])

  // ── Uploading / processing state ───────────────────────────────────────────
  if (status !== "idle") {
    const label =
      status === "converting"  ? "กำลังแปลงไฟล์..." :
      status === "uploading"   ? "กำลังอัปโหลด..." :
      status === "processing"  ? "AI กำลังอ่านเอกสาร..." :
      "เสร็จสิ้น กำลังเปิดหน้า Review..."

    // ── Compact progress strip ────────────────────────────────────────────────
    if (compact) {
      return (
        <div className="h-14 rounded-[10px] border border-border bg-card px-4
          flex items-center gap-3 overflow-hidden">
          <div className="w-8 h-8 rounded-[8px] bg-brand-50 dark:bg-brand-900/20
            flex items-center justify-center shrink-0">
            {status === "done"
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              : <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate leading-none">{fileName}</p>
            <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-1 rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-[11.5px] text-muted-foreground shrink-0 hidden sm:block">
            {label}
          </span>
        </div>
      )
    }

    // ── Full progress card ────────────────────────────────────────────────────
    return (
      <div className="rounded-[12px] border-2 border-border bg-card overflow-hidden">
        <div className="px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-[12px] bg-brand-50 dark:bg-brand-900/20
              flex items-center justify-center shrink-0">
              {status === "done"
                ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                : <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-1.5 rounded-full bg-brand-500 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Idle / upload zone ─────────────────────────────────────────────────────
  // ── Compact strip ──────────────────────────────────────────────────────────
  if (compact) {
    return (
      <>
        <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR}
          className="hidden" onChange={onFileChange} />
        <input ref={cameraInputRef} type="file" accept="image/*"
          capture="environment" className="hidden" onChange={onFileChange} />

        {cameraOpen && (
          // Camera modal — identical to full version, shared below
          <CompactCameraModal
            videoRef={videoRef}
            cameraError={cameraError}
            facingMode={facingMode}
            hasMultipleCams={hasMultipleCams}
            onClose={closeCamera}
            onCapture={capturePhoto}
            onFlip={() => setFacingMode(m => m === "environment" ? "user" : "environment")}
            onFallback={() => { setCameraError(null); cameraInputRef.current?.click(); setCameraOpen(false) }}
          />
        )}

        <div className="relative">
          {/* Compact drag strip */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "h-14 rounded-[10px] border border-dashed bg-card px-4",
              "flex items-center gap-3 cursor-pointer transition-colors duration-150 group",
              isDrag
                ? "border-brand-400 bg-brand-50/60 dark:bg-brand-900/20"
                : "border-border hover:border-brand-300 hover:bg-muted/30"
            )}
          >
            {/* Icon */}
            <div className={cn(
              "w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 transition-colors",
              isDrag
                ? "bg-brand-100 dark:bg-brand-500/20"
                : "bg-brand-50 dark:bg-brand-900/20 group-hover:bg-brand-100 dark:group-hover:bg-brand-500/20"
            )}>
              <Upload className="w-4 h-4 text-brand-500" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-foreground leading-none">
                {isDrag ? "วางไฟล์ที่นี่" : "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือก"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                PDF · JPG · PNG · HEIC (สูงสุด 20MB)
              </p>
            </div>

            {/* Action buttons */}
            <div
              className="flex items-center gap-1.5 shrink-0"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 rounded-[8px] bg-brand-500 hover:bg-brand-600
                  active:scale-95 text-white text-xs font-medium transition-all
                  inline-flex items-center gap-1.5 shadow-sm shadow-brand-500/20"
              >
                <Upload className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เลือกไฟล์</span>
              </button>

              <button
                type="button"
                onClick={openCamera}
                title="ถ่ายรูป"
                className="h-8 w-8 rounded-[8px] border border-border bg-card
                  hover:bg-muted hover:border-brand-300 active:scale-95
                  text-muted-foreground hover:text-foreground transition-all
                  inline-flex items-center justify-center"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>

              {orgSlug && (
                <button
                  type="button"
                  title="ส่งทางอีเมล"
                  onClick={() => setEmailOpen(v => !v)}
                  className="h-8 w-8 rounded-[8px] border border-border bg-card
                    hover:bg-muted hover:border-brand-300 active:scale-95
                    text-muted-foreground hover:text-foreground transition-all
                    inline-flex items-center justify-center"
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Email popover (same as full version) */}
          {emailOpen && orgSlug && (
            <div
              id="email-popover"
              className="absolute z-20 right-0 mt-2
                w-[320px] bg-card border border-border rounded-[14px]
                shadow-xl shadow-black/10 p-5 space-y-3 animate-in fade-in zoom-in-95
                duration-150"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">อีเมลรับเอกสาร</p>
                <button onClick={() => setEmailOpen(false)}
                  className="p-1 rounded-md hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                ส่งไฟล์แนบ (PDF, JPG, PNG, HEIC) มาที่อีเมลนี้
                ระบบจะรับและประมวลผลอัตโนมัติ
              </p>
              <div className="flex items-center gap-2 bg-muted rounded-[10px] px-3 py-2.5">
                <code className="flex-1 text-xs font-mono text-foreground truncate">
                  {uploadEmail}
                </code>
                <button
                  onClick={copyEmail}
                  className="shrink-0 p-1.5 rounded-md hover:bg-background
                    transition-colors text-muted-foreground hover:text-foreground"
                  title="คัดลอก"
                >
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                    : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <div className="pt-1 border-t border-border flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">ใช้ชื่อ Subject เป็นชื่อเอกสาร</p>
                <Link href="/settings/integrations" onClick={() => setEmailOpen(false)}
                  className="text-[11px] text-brand-600 hover:underline inline-flex items-center gap-1">
                  ตั้งค่า <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      {/* ── Hidden file inputs ── */}
      <input ref={fileInputRef} type="file" accept={ACCEPT_ATTR}
        className="hidden" onChange={onFileChange} />

      {/* Fallback: native camera for browsers without getUserMedia */}
      <input ref={cameraInputRef} type="file" accept="image/*"
        capture="environment" className="hidden" onChange={onFileChange} />

      {/* ── Camera modal ── */}
      {cameraOpen && (
        <CompactCameraModal
          videoRef={videoRef}
          cameraError={cameraError}
          facingMode={facingMode}
          hasMultipleCams={hasMultipleCams}
          onClose={closeCamera}
          onCapture={capturePhoto}
          onFlip={() => setFacingMode(m => m === "environment" ? "user" : "environment")}
          onFallback={() => { setCameraError(null); cameraInputRef.current?.click(); setCameraOpen(false) }}
        />
      )}

      {/* ── Drop zone ── */}
      <div className="relative">
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "rounded-[12px] border-2 border-dashed bg-card overflow-hidden relative",
            "transition-colors duration-200 cursor-pointer group",
            isDrag
              ? "border-brand-400 bg-brand-50/60 dark:bg-brand-900/20"
              : "border-border hover:border-brand-400 hover:bg-brand-50/30 dark:hover:bg-brand-500/5"
          )}
        >
          <div className="absolute inset-0 glow-dotgrid opacity-30 pointer-events-none
            [mask-image:radial-gradient(circle_at_center,black,transparent_75%)]" />

          <div className="relative px-6 py-10 text-center">
            <div className="relative inline-flex">
              <div className="absolute inset-0 rounded-full bg-brand-500/30 blur-2xl" />
              <div className="relative h-14 w-14 rounded-[14px]
                bg-gradient-to-br from-brand-400 to-brand-700 text-white
                flex items-center justify-center shadow-lg shadow-brand-500/30
                group-hover:scale-105 transition-transform duration-200">
                <Upload className="w-6 h-6" />
              </div>
            </div>

            <h3 className="mt-4 text-[17px] font-semibold text-foreground">
              {isDrag ? "วางไฟล์ที่นี่" : "ลากไฟล์มาวางที่นี่"}
            </h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              หรือใช้ปุ่มด้านล่าง · รองรับ PDF, JPG, PNG, <strong>HEIC</strong> (สูงสุด 20MB)
            </p>

            <div
              className="mt-5 flex items-center justify-center gap-2 flex-wrap"
              onClick={e => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-10 px-4 rounded-[10px] bg-brand-500 hover:bg-brand-600
                  active:scale-95 text-white text-sm font-medium transition-all
                  inline-flex items-center gap-2 shadow-sm shadow-brand-500/30"
              >
                <Upload className="w-4 h-4" />
                เลือกไฟล์
              </button>

              <button
                type="button"
                onClick={openCamera}
                className="h-10 px-4 rounded-[10px] border border-border bg-card
                  hover:bg-muted hover:border-brand-300 active:scale-95
                  text-foreground text-sm font-medium transition-all
                  inline-flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                ถ่ายรูป
              </button>

              {orgSlug && (
                <button
                  type="button"
                  onClick={() => setEmailOpen(v => !v)}
                  className="h-10 px-4 rounded-[10px] border border-border bg-card
                    hover:bg-muted hover:border-brand-300 active:scale-95
                    text-foreground text-sm font-medium transition-all
                    inline-flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  ส่งทางอีเมล
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Email popover ── */}
        {emailOpen && (
          <div
            id="email-popover"
            className="absolute z-20 left-1/2 -translate-x-1/2 mt-2
              w-[340px] bg-card border border-border rounded-[14px]
              shadow-xl shadow-black/10 p-5 space-y-3 animate-in fade-in zoom-in-95
              duration-150"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">อีเมลรับเอกสาร</p>
              <button onClick={() => setEmailOpen(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              ส่งไฟล์แนบ (PDF, JPG, PNG, HEIC) มาที่อีเมลนี้
              ระบบจะรับและประมวลผลอัตโนมัติ
            </p>

            <div className="flex items-center gap-2 bg-muted rounded-[10px] px-3 py-2.5">
              <code className="flex-1 text-xs font-mono text-foreground truncate">
                {uploadEmail}
              </code>
              <button
                onClick={copyEmail}
                className="shrink-0 p-1.5 rounded-md hover:bg-background
                  transition-colors text-muted-foreground hover:text-foreground"
                title="คัดลอก"
              >
                {copied
                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                  : <Copy className="w-3.5 h-3.5" />
                }
              </button>
            </div>

            <div className="pt-1 border-t border-border flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                ใช้ชื่อ Subject เป็นชื่อเอกสาร
              </p>
              <Link
                href="/settings/integrations"
                onClick={() => setEmailOpen(false)}
                className="text-[11px] text-brand-600 hover:underline
                  inline-flex items-center gap-1"
              >
                ตั้งค่า <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
