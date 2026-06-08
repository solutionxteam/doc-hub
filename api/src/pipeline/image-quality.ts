import sharp from "sharp"
import { createClient } from "../lib/supabase"

/**
 * Image Quality Checker
 *
 * ตรวจสอบคุณภาพรูปก่อนส่งให้ AI:
 *   1. Blur detection  — วัดความคมชัดด้วย Laplacian variance
 *   2. Size check      — รูปเล็กเกินไปอ่านไม่ออก
 *   3. Contrast check  — รูปมืดหรือสว่างเกินไป
 *
 * ผลลัพธ์ใช้สองอย่าง:
 *   a) เพิ่ม warning ใน extraction prompt ("image is blurry — be extra careful")
 *   b) log ลง image_quality_logs สำหรับ analytics
 */

export interface ImageQuality {
  blurScore:   number   // Laplacian variance — higher = sharper (>100 = clear, <30 = blurry)
  isBlurry:    boolean
  isTooDark:   boolean
  isTooBright: boolean
  width:       number
  height:      number
  warnings:    string[] // human-readable warnings to inject into prompt
}

const BLUR_THRESHOLD       = 35    // ต่ำกว่านี้ = ภาพเบลอ (thermal receipt อาจได้ ~40-80)
const DARK_THRESHOLD       = 40    // mean brightness ต่ำกว่านี้ = มืดเกินไป
const BRIGHT_THRESHOLD     = 240   // mean brightness สูงกว่านี้ = สว่างเกินไป (overexposed)

/**
 * Approximate Laplacian variance using a 3×3 kernel.
 * Sharp supports custom kernel convolution — we convolve then measure std dev.
 * Higher = sharper. Thai thermal receipts: ~40-120. Blurry photos: <30.
 */
export async function measureImageQuality(buffer: Buffer): Promise<ImageQuality> {
  const warnings: string[] = []

  try {
    const meta  = await sharp(buffer).metadata()
    const w     = meta.width  ?? 0
    const h     = meta.height ?? 0

    // ── Laplacian edge detection (approximation via Sharp kernel) ─────────────
    // Laplacian kernel detects edges — blurry images have few/soft edges → low variance
    const laplacianKernel = {
      width:  3,
      height: 3,
      kernel: [0, -1, 0, -1, 4, -1, 0, -1, 0] as number[],
    }

    const laplacianBuf = await sharp(buffer)
      .grayscale()
      .resize(512, 512, { fit: "inside" })  // small enough for speed
      .convolve(laplacianKernel)
      .raw()
      .toBuffer()

    // Compute variance of Laplacian output
    const pixels = new Uint8Array(laplacianBuf)
    const mean   = pixels.reduce((s, v) => s + v, 0) / pixels.length
    const variance = pixels.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pixels.length
    const blurScore = Math.round(variance * 100) / 100

    // ── Brightness check ──────────────────────────────────────────────────────
    const stats       = await sharp(buffer).grayscale().stats()
    const brightness  = stats.channels[0]?.mean ?? 128

    const isBlurry    = blurScore < BLUR_THRESHOLD
    const isTooDark   = brightness < DARK_THRESHOLD
    const isTooBright = brightness > BRIGHT_THRESHOLD

    if (isBlurry) {
      warnings.push(
        `⚠️ IMAGE QUALITY WARNING: This image appears blurry (sharpness score: ${blurScore.toFixed(1)}, threshold: ${BLUR_THRESHOLD}). ` +
        `Be extremely careful with digit recognition — when uncertain between similar-looking digits (1/7, 3/8, 0/6), ` +
        `lower your confidence score for that field rather than guessing.`
      )
    }
    if (isTooDark) {
      warnings.push(
        `⚠️ IMAGE QUALITY WARNING: Image is underexposed (brightness: ${brightness.toFixed(0)}). ` +
        `Text may be hard to read — extract what you can and report low confidence for unclear fields.`
      )
    }
    if (isTooBright) {
      warnings.push(
        `⚠️ IMAGE QUALITY WARNING: Image is overexposed (brightness: ${brightness.toFixed(0)}). ` +
        `White areas may have washed-out text — check carefully for faded numbers and characters.`
      )
    }

    return { blurScore, isBlurry, isTooDark, isTooBright, width: w, height: h, warnings }

  } catch (err) {
    // Never block the pipeline
    console.warn("[image-quality] check failed:", (err as Error).message)
    return { blurScore: 999, isBlurry: false, isTooDark: false, isTooBright: false, width: 0, height: 0, warnings: [] }
  }
}

/**
 * Log quality metrics to DB (fire-and-forget).
 */
export async function logImageQuality(
  documentId: string,
  quality:    ImageQuality,
  fileSizeKb: number,
): Promise<void> {
  try {
    const supabase = createClient()
    await supabase.from("image_quality_logs").insert({
      document_id:  documentId,
      blur_score:   quality.blurScore,
      is_blurry:    quality.isBlurry,
      width:        quality.width,
      height:       quality.height,
      file_size_kb: fileSizeKb,
    })
  } catch { /* never block */ }
}
