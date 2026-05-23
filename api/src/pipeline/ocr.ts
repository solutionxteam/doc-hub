import { DocumentProcessorServiceClient } from "@google-cloud/documentai"

const PROJECT_ID  = process.env.GOOGLE_CLOUD_PROJECT   ?? ""
const LOCATION    = process.env.GOOGLE_DOC_AI_LOCATION ?? "us"
const PROCESSOR_ID = process.env.GOOGLE_DOC_AI_PROCESSOR_ID ?? ""

const PROCESSOR_NAME =
  `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`

let _client: DocumentProcessorServiceClient | null = null
function getClient() {
  if (!_client) _client = new DocumentProcessorServiceClient()
  return _client
}

export interface OcrPage {
  text:   string
  blocks: OcrBlock[]
}

export interface OcrBlock {
  text:       string
  confidence: number
  boundingBox?: number[]  // [x1,y1,x2,y2] normalised 0-1
}

/**
 * Run Google Document AI on a single PNG buffer.
 * Returns structured text blocks with confidence scores.
 */
export async function runOcr(imageBuffer: Buffer): Promise<OcrPage> {
  const client = getClient()

  const [result] = await client.processDocument({
    name: PROCESSOR_NAME,
    rawDocument: {
      content:  imageBuffer.toString("base64"),
      mimeType: "image/png",
    },
  })

  const doc = result.document
  if (!doc) throw new Error("Document AI returned empty document")

  const fullText = doc.text ?? ""

  // Extract blocks from paragraphs across all pages
  const blocks: OcrBlock[] = []

  for (const page of doc.pages ?? []) {
    for (const paragraph of page.paragraphs ?? []) {
      const layout    = paragraph.layout
      const text      = extractText(fullText, layout?.textAnchor)
      const confidence = layout?.confidence ?? 0

      if (!text.trim()) continue

      const verts = layout?.boundingPoly?.normalizedVertices ?? []
      const xs    = verts.map(v => v.x ?? 0)
      const ys    = verts.map(v => v.y ?? 0)
      const bbox  = xs.length
        ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
        : undefined

      blocks.push({ text: text.trim(), confidence, boundingBox: bbox })
    }
  }

  return { text: fullText.trim(), blocks }
}

/**
 * Run OCR over multiple page buffers and concatenate results.
 */
export async function runOcrMultiPage(pageBuffers: Buffer[]): Promise<OcrPage[]> {
  return Promise.all(pageBuffers.map(runOcr))
}

// ── helpers ───────────────────────────────────────────────────────────────────

type TextAnchor = {
  textSegments?: Array<{ startIndex?: string | number | null; endIndex?: string | number | null }>
} | null | undefined

function extractText(fullText: string, anchor: TextAnchor): string {
  if (!anchor?.textSegments?.length) return ""

  return anchor.textSegments
    .map(seg => {
      const start = Number(seg.startIndex ?? 0)
      const end   = Number(seg.endIndex   ?? 0)
      return fullText.slice(start, end)
    })
    .join("")
}
