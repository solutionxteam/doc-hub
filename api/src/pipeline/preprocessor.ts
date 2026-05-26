import sharp from "sharp"
import { createClient } from "../lib/supabase"

const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "documents"

// Claude reads text perfectly at 1024px — no need for 2480px.
// JPEG is ~5× smaller than PNG at equivalent quality, reducing API payload and tokens.
const TARGET_PX      = 1024
const JPEG_QUALITY   = 88

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

  return sharp(src)
    .resize(TARGET_PX, TARGET_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
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
      density: 120,
      format:  "jpeg",
      width:   1200,
      height:  1700,
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
