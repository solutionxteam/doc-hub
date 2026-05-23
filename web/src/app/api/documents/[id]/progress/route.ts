import { NextRequest } from "next/server"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Proxy SSE from API server
  const upstream = await fetch(`${process.env.API_BASE_URL}/documents/${id}/progress`, {
    headers: { "x-internal-key": process.env.INTERNAL_API_KEY! },
  })

  return new Response(upstream.body, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  })
}
