/**
 * POST /api/documents/validate
 * Fast pre-screen: check if an image looks like a financial document before
 * queuing full OCR (which costs more tokens and time).
 *
 * Uses Claude Haiku (cheapest, fastest) with a single vision call.
 * Cost: ~$0.0001 per image (25× cheaper than full extraction).
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient }             from "@/lib/supabase/server"
import Anthropic                    from "@anthropic-ai/sdk"

const client = new Anthropic()

// Prompt is intentionally short to minimise input tokens
const SYSTEM = `You are a document classifier. Analyze the image and determine if it is a financial document such as:
- Receipt (ใบเสร็จ)
- Invoice / Tax invoice (ใบแจ้งหนี้ / ใบกำกับภาษี)
- Bill or statement (บิล)
- Bank slip / transfer slip (สลิปโอนเงิน)
- Credit card slip
- Any other official financial document

Respond with ONLY a JSON object: {"isDocument": true/false, "reason": "brief reason in Thai max 20 words"}`

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json() as { imageBase64: string; mediaType?: string }
    const { imageBase64, mediaType = "image/jpeg" } = body

    if (!imageBase64) {
      return NextResponse.json({ error: "imageBase64 required" }, { status: 400 })
    }

    // Validate with Claude Haiku (cheapest vision model)
    const response = await client.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 60,           // very short response needed
      system:     SYSTEM,
      messages: [{
        role:    "user",
        content: [{
          type:       "image",
          source: {
            type:       "base64",
            media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data:       imageBase64,
          },
        }],
      }],
    })

    const text = (response.content[0] as { text: string }).text.trim()

    // Parse JSON response
    let result: { isDocument: boolean; reason: string }
    try {
      // Strip markdown code blocks if present
      const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()
      result = JSON.parse(cleaned)
    } catch {
      // Fallback: if parsing fails, check for keywords
      const lower = text.toLowerCase()
      result = {
        isDocument: lower.includes("true") || lower.includes("yes"),
        reason:     text.slice(0, 50),
      }
    }

    return NextResponse.json({
      isDocument: Boolean(result.isDocument),
      reason:     result.reason ?? "",
    })

  } catch (err: any) {
    console.error("[validate] error:", err.message)
    // On API error, allow through (don't block uploads due to validation failure)
    return NextResponse.json({ isDocument: true, reason: "validation_skipped" })
  }
}
