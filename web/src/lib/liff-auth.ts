import { NextRequest, NextResponse } from "next/server.js"

export const VERIFIED_LINE_USER_HEADER = "x-slippy-verified-line-user-id"

interface LineProfileResponse {
  userId?: string
  displayName?: string
  pictureUrl?: string
  statusMessage?: string
}

export function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization")
  if (!authorization?.startsWith("Bearer ")) return null
  return authorization.slice("Bearer ".length).trim() || null
}

export async function verifyLineAccessToken(accessToken: string): Promise<LineProfileResponse | null> {
  const response = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  })

  if (!response.ok) return null

  const profile = await response.json() as LineProfileResponse
  return profile.userId ? profile : null
}

export function getVerifiedLineUserId(
  request: NextRequest,
  claimedLineUserId?: string | null,
): string | null {
  const verifiedLineUserId = request.headers.get(VERIFIED_LINE_USER_HEADER)
  if (!verifiedLineUserId) return null
  if (claimedLineUserId && claimedLineUserId !== verifiedLineUserId) return null
  return verifiedLineUserId
}

export function liffUnauthorized(message = "LIFF authentication required") {
  return NextResponse.json({ error: message }, { status: 401 })
}

export async function verifyClaimedLineUser(
  request: NextRequest,
  claimedLineUserId?: string | null,
): Promise<string | null> {
  if (!claimedLineUserId) return null

  const verifiedHeader = getVerifiedLineUserId(request, claimedLineUserId)
  if (verifiedHeader) return verifiedHeader

  const accessToken = getBearerToken(request)
  if (!accessToken) return null

  const profile = await verifyLineAccessToken(accessToken).catch(() => null)
  return profile?.userId === claimedLineUserId ? profile.userId : null
}
