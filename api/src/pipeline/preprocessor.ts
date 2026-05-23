import sharp from "sharp"
import { createClient } from "../lib/supabase"

const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "documents"

/**
 * Download file from Supabase Storage and return as Buffer
 */
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
 * Normalize image for OCR — resize + enhance contrast
 */
export async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(2480, null, { withoutEnlargement: true })
    .normalize()
    .sharpen()
    .png()
    .toBuffer()
}

/**
 * Convert PDF pages to image buffers using pdf2pic
 * Falls back to first-page if conversion fails
 */
export async function pdfToImages(buffer: Buffer): Promise<Buffer[]> {
  try {
    const { fromBuffer } = await import("pdf2pic")
    const convert = fromBuffer(buffer, {
      density:  200,
      format:   "png",
      width:    2480,
      height:   3508,
    })
    const pages = await convert.bulk(-1, { responseType: "buffer" })
    return pages
      .filter(p => p.buffer)
      .map(p => p.buffer as Buffer)
  } catch {
    // Fallback: treat as raw image
    return [buffer]
  }
}

/**
 * Main entry — returns array of PNG buffers (one per page)
 */
export async function prepareImages(filePath: string): Promise<Buffer[]> {
  const { buffer, mimeType } = await downloadFile(filePath)

  if (mimeType === "application/pdf") {
    const pages = await pdfToImages(buffer)
    return Promise.all(pages.map(normalizeImage))
  }

  return [await normalizeImage(buffer)]
}
