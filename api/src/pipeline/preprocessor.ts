import sharp from "sharp"
import { createClient } from "../lib/supabase"

const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "documents"

// ── Image quality targets ────────────────────────────────────────────────────
// Thai receipts typically use 7-8pt fonts. At 1024px the text is ~4-5px tall
// which causes Claude to misread numerals (e.g. 1↔7, 3↔8).
// 1800px puts a typical 8pt font at ~11px — consistently readable.
// We deliberately stay under 2000px to keep base64 payload < 800 KB.
const TARGET_PX      = 2000    // higher res → smaller font more readable (1800→2000)
const JPEG_QUALITY   = 95      // higher quality → less artifact on fine numbers

// HEIC/HEIF extensions from iOS/macOS cameras
const HEIC_EXTS = new Set(["heic", "heif", "hif"])

export async function downloadFile(filePath: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(filePath)
  if (error || !data) throw new Error(`Download failed: ${error?.message}`)

  const buffer = Buffer.from(await data.arrayBuffer())
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "jpg"
  const mimeType = ext === "pdf" ? "application/pdf" : `image/${ext}`
  return { buffer, mimeType }
}

/**
 * Convert HEIC/HEIF → JPEG buffer using heic-convert (WASM-based, no native codec needed).
 * heic-convert handles both single images and multi-image HEIC containers.
 */
async function heicToJpeg(buffer: Buffer): Promise<Buffer> {
  const heicConvert = (await import("heic-convert")).default
  const output = await heicConvert({
    buffer: new Uint8Array(buffer) as unknown as ArrayBuffer,
    format: "JPEG",
    quality: 0.92,
  })
  return Buffer.from(output)
}

/**
 * Resize to TARGET_PX on longest side, output JPEG.
 * Handles HEIC input transparently by pre-converting with heic-convert.
 */
export async function normalizeImage(buffer: Buffer, ext?: string): Promise<Buffer> {
  let src = buffer

  // HEIC/HEIF: sharp's bundled libvips lacks the HEVC codec — convert first
  if (ext && HEIC_EXTS.has(ext)) {
    try {
      src = await heicToJpeg(buffer)
    } catch (e) {
      throw new Error(`HEIC conversion failed: ${(e as Error).message}`)
    }
  }

  // ── Step 1: Auto-rotate via EXIF (handles phone camera orientation) ────────
  // LINE sometimes strips EXIF, but we try first. rotate() without args = EXIF.
  let rotated = await sharp(src).rotate().toBuffer()

  // ── Step 2: Detect landscape images and correct orientation ─────────────
  // Most Thai receipts/invoices are taller than wide (portrait).
  // If image is landscape (width > height), the phone was held sideways →
  // rotate 90° so text is upright for OCR.
  const imgMeta = await sharp(rotated).metadata()
  const w = imgMeta.width ?? 1
  const h = imgMeta.height ?? 1
  if (w > h * 1.1) {
    // Landscape → rotate 90° clockwise (Thai docs held phone landscape = rotated CW)
    rotated = await sharp(rotated).rotate(90).toBuffer()
    console.log(`[preprocess] Landscape detected (${w}×${h}) → rotated 90°`)
  }

  // ── Step 3: Detect thermal receipt vs color document ─────────────────────
  const stats = await sharp(rotated).stats()
  const isGrayscale = stats.channels.length >= 3 && (() => {
    const [r, g, b] = stats.channels
    return Math.abs(r.mean - g.mean) < 10 && Math.abs(g.mean - b.mean) < 10
  })()

  // ── Step 4: Enhancement pipeline ──────────────────────────────────────────
  let pipeline = sharp(rotated)

  if (isGrayscale) {
    // Thermal receipt (B&W paper): aggressive contrast + deblur
    pipeline = pipeline
      .grayscale()
      .normalize()
      .linear(1.4, -25)                                              // strong contrast
      .sharpen({ sigma: 2.0, m1: 1.5, m2: 5.0 })                   // unsharp mask
  } else {
    // Color document / photo: moderate enhancement
    pipeline = pipeline
      .normalize()
      .modulate({ saturation: 0.75 })                                // reduce noise
      .sharpen({ sigma: 1.5, m1: 0.8, m2: 4.0 })
  }

  return pipeline
    .resize(TARGET_PX, TARGET_PX * 2, { fit: "inside", withoutEnlargement: false })
    .jpeg({ quality: JPEG_QUALITY, progressive: true })
    .toBuffer()
}

/**
 * Convert PDF pages to JPEG buffers at a moderate density.
 * 120 DPI at 1200px is sufficient for Claude's vision — much faster than 200 DPI.
 */
export async function pdfToImages(buffer: Buffer): Promise<Buffer[]> {
  try {
    const { fromBuffer } = await import("pdf2pic")
    const convert = fromBuffer(buffer, {
      density: 180,    // was 120 — 180 DPI is minimum for reliable Thai text OCR on A4/A5
      format:  "jpeg",
      width:   1800,
      height:  2600,
    })
    const pages = await convert.bulk(-1, { responseType: "buffer" })
    return pages
      .filter(p => p.buffer)
      .map(p => p.buffer as Buffer)
  } catch {
    return [buffer]
  }
}

export async function prepareImages(filePath: string): Promise<Buffer[]> {
  const { buffer, mimeType } = await downloadFile(filePath)
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""

  if (mimeType === "application/pdf") {
    const pages = await pdfToImages(buffer)
    // PDF pages come out as JPEG from pdf2pic — no ext needed
    return Promise.all(pages.map(p => normalizeImage(p)))
  }

  return [await normalizeImage(buffer, ext)]
}
