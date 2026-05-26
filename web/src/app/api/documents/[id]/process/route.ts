/**
 * Copyright © 2026 SolutionX Co., Ltd. (บริษัท โซลูชั่น เอ็กซ์ จำกัด)
 * All rights reserved.
 *
 * This software is proprietary and confidential.
 * Unauthorized copying, modification, distribution, or use of this software,
 * in whole or in part, is strictly prohibited without prior written permission.
 */

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const res = await fetch(`${process.env.API_BASE_URL}/documents/${id}/process`, {
    method:  "POST",
    headers: { "x-internal-key": process.env.INTERNAL_API_KEY! },
  })

  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
