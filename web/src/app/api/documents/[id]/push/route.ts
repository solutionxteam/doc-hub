import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body   = await req.json()

  const res = await fetch(`${process.env.API_BASE_URL}/documents/${id}/push`, {
    method:  "POST",
    headers: {
      "Content-Type":    "application/json",
      "x-internal-key":  process.env.INTERNAL_API_KEY!,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
