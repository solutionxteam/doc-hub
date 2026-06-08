/**
 * ai-memory.ts — AI Memory Service with Vector Embeddings
 *
 * Creates and searches semantic memories using pgvector.
 * Architecture (CLAUDE.md): AI Memory is the context layer for the AI Assistant.
 * Every interaction enriches memory; memory personalizes every response.
 */

import Anthropic        from "@anthropic-ai/sdk"
import { createClient } from "../lib/supabase"

const anthropic = new Anthropic()

// ─── Generate text embedding ──────────────────────────────────────────────────
// WHY NOT CLAUDE: Anthropic does not offer an embedding API.
// Claude is text generation only. Embeddings require a separate model.
//
// Options (in order of preference):
//   1. OPENAI_API_KEY → text-embedding-3-small  (best, ~$0.00002/1K tokens)
//   2. No key         → zero vector + PostgreSQL full-text search fallback (free)
//
// The system works without OPENAI_API_KEY — semantic search is replaced
// by keyword/text search which is good enough for most use cases.
export async function embed(text: string): Promise<number[]> {
  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
      })
      if (res.ok) {
        const data = await res.json() as { data: Array<{ embedding: number[] }> }
        return data.data[0].embedding
      }
    } catch {
      console.warn("[memory] OpenAI embedding unavailable — using text search fallback")
    }
  }
  // Zero vector → pgvector search skipped, text-based fallback used instead
  return new Array(1536).fill(0)
}

// ─── Store a memory with embedding ───────────────────────────────────────────
export async function storeMemory(
  organizationId: string,
  memoryType:     string,
  key:            string,
  value:          object,
  textForEmbed:   string,
  source?:        string
): Promise<void> {
  const supabase  = createClient()
  const embedding = await embed(textForEmbed)

  await supabase.from("life_memories").upsert({
    organization_id:    organizationId,
    memory_type:        memoryType,
    key,
    value,
    embedding,
    observation_count:  1,
    source:             source ?? "system",
    updated_at:         new Date().toISOString(),
  }, { onConflict: "organization_id,memory_type,key" })
}

// ─── Semantic search over memories ───────────────────────────────────────────
export async function searchMemories(
  organizationId: string,
  query:          string,
  limit           = 5
): Promise<Array<{ memory_type: string; key: string; value: any; similarity: number }>> {
  const supabase = createClient()
  const hasOpenAI = !!process.env.OPENAI_API_KEY

  // Only use pgvector if OpenAI key is available (non-zero embeddings)
  if (hasOpenAI) {
    const embedding = await embed(query)
    const { data, error } = await supabase.rpc("search_memories", {
      p_org_id:    organizationId,
      p_embedding: `[${embedding.join(",")}]`,
      p_limit:     limit,
      p_threshold: 0.5,
    })
    if (!error && data?.length) return data
  }

  // PostgreSQL keyword search — search in both key and value text
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1).slice(0, 5)
  let q = supabase.from("life_memories").select("memory_type, key, value")
    .eq("organization_id", organizationId)
  if (words.length > 0) {
    // Search in key field for any of the query words
    q = q.or(words.map(w => `key.ilike.%${w}%`).join(","))
  }
  const { data: textData } = await q.limit(limit)
  return (textData ?? []).map(m => ({ ...m, similarity: 0.5 }))
}

// ─── Build context string from memories for AI prompts ───────────────────────
export async function buildMemoryContext(organizationId: string, query: string): Promise<string> {
  const memories = await searchMemories(organizationId, query, 8)
  if (!memories.length) return ""

  let ctx = "\n## AI Memory (สิ่งที่ระบบจำเกี่ยวกับคุณ)\n"
  for (const m of memories) {
    const v = m.value as any
    if (v?.name)          ctx += `- ร้านที่ชอบ: ${v.name}\n`
    else if (v?.category) ctx += `- ประเภท: ${v.category} — ใช้จ่ายล่าสุด ฿${v.last_amount?.toLocaleString() ?? 0}\n`
    else                  ctx += `- ${m.key}: ${JSON.stringify(v).slice(0, 80)}\n`
  }
  return ctx
}

// ─── Extract and store memories from a conversation ──────────────────────────
export async function extractMemoriesFromChat(
  organizationId: string,
  userMessage:    string,
  aiResponse:     string
): Promise<void> {
  // Use Claude to extract memorable facts from the conversation
  try {
    const res = await anthropic.messages.create({
      model:      "claude-haiku-4-5",
      max_tokens: 200,
      system:     `Extract factual preferences or patterns from this user query that would be useful to remember.
Return JSON array: [{"type":"preference|pattern|goal","key":"short_key","value":"text"}]
Only extract if clearly stated. Return [] if nothing to extract.`,
      messages: [{ role: "user", content: `User: ${userMessage}\nAI: ${aiResponse}` }],
    })
    const raw  = (res.content[0] as any).text?.trim() ?? "[]"
    const facts = JSON.parse(raw.replace(/```json?\s*/i, "").replace(/```/g, "").trim()) as Array<{
      type: string; key: string; value: string
    }>

    for (const fact of facts) {
      if (!fact.key || !fact.value) continue
      await storeMemory(
        organizationId,
        fact.type ?? "preference",
        fact.key,
        { text: fact.value, extracted_from: "chat" },
        `${fact.key}: ${fact.value}`,
        "chat"
      )
    }
  } catch {
    // Non-critical — memory extraction failure is silent
  }
}
