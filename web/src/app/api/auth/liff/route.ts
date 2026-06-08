/**
 * LIFF → Supabase session bridge
 *
 * Lets a user who is ALREADY signed into LINE inside the LIFF mini-app log
 * into Slippy with a single tap — no separate web login form, no password.
 * This powers the new mobile-optimized "เข้าสู่ระบบด้วยบัญชี LINE" screen at
 * `/liff/home` that every Rich Menu pillar card (Health/Wealth/Lifestyle/
 * Dashboard/Community/...) now routes through.
 *
 * Flow:
 *   1. Client calls `liff.getIDToken()` (already signed in — LIFF handled it)
 *   2. POST { idToken, next? } here
 *   3. We verify the ID token directly with LINE (`/oauth2/v2.1/verify`)
 *   4. Find-or-create the linked Supabase user (same logic as the OAuth
 *      callback at /api/auth/line/callback — keeps both flows consistent)
 *   5. Mint a Supabase magic-link session and return the action_link —
 *      the client redirects to it, landing on /auth/line-callback?next=...
 *      which sets cookies and forwards to the destination pillar page.
 */
import { NextRequest, NextResponse } from "next/server"
import { createAdminClient }         from "@/lib/supabase/admin"

const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"

function log(step: string, data?: any) {
  console.log(`[LIFF:auth-bridge] ${step}`, data ? JSON.stringify(data) : "")
}

export async function POST(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  let body: { idToken?: string; next?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }

  const { idToken } = body
  if (!idToken) return NextResponse.json({ error: "id_token_required" }, { status: 400 })

  // Only same-origin relative paths are honoured for `next` (avoid open redirects)
  const next = body.next && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : null

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID ?? process.env.LINE_CHANNEL_ID
  if (!channelId) {
    log("ERROR: LINE_LOGIN_CHANNEL_ID missing")
    return NextResponse.json({ error: "line_not_configured" }, { status: 500 })
  }

  try {
    // ── Step 1: Verify the LIFF ID token directly with LINE ───────────────
    log("verifying ID token...")
    const verifyRes = await fetch(LINE_VERIFY_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    new URLSearchParams({ id_token: idToken, client_id: channelId }),
    })
    const verified = await verifyRes.json()

    if (!verifyRes.ok || verified.aud !== channelId) {
      log("verify failed", { ok: verifyRes.ok, aud: verified.aud, error: verified.error })
      return NextResponse.json({ error: "line_verify_failed", detail: verified.error }, { status: 401 })
    }

    const lineUserId  = verified.sub  as string
    const displayName = verified.name as string | undefined ?? "ผู้ใช้ LINE"
    const avatarUrl   = verified.picture as string | undefined
    const lineEmail   = verified.email as string | undefined

    log("verified", { lineUserId: lineUserId.slice(0, 6), displayName, hasEmail: !!lineEmail })

    // ── Step 2: Find-or-create the linked Supabase user ───────────────────
    // (mirrors /api/auth/line/callback so both entry points stay consistent)
    const admin = createAdminClient()
    let   targetEmail: string

    let existingUser: any = null
    let page = 1
    while (!existingUser) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (!list?.users?.length) break
      existingUser = list.users.find((u: any) => u.user_metadata?.line_user_id === lineUserId)
      if (list.users.length < 1000) break
      page++
    }

    if (existingUser) {
      log("found existing user", { id: existingUser.id.slice(0, 8) })
      const hasPlaceholderEmail = (existingUser.email ?? "").includes("@noreply.slippy.app")
        || (existingUser.email ?? "").includes("@line.slippy.app")

      if (lineEmail && hasPlaceholderEmail) {
        await admin.auth.admin.updateUserById(existingUser.id, {
          email: lineEmail, email_confirm: true,
          user_metadata: { ...existingUser.user_metadata, avatar_url: avatarUrl },
        })
        targetEmail = lineEmail
      } else {
        targetEmail = existingUser.email!
        if (avatarUrl && existingUser.user_metadata?.avatar_url !== avatarUrl) {
          await admin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: { ...existingUser.user_metadata, avatar_url: avatarUrl },
          })
        }
      }
    } else {
      targetEmail = lineEmail ?? `line.${lineUserId.toLowerCase()}@noreply.slippy.app`
      log("creating new user", { email: targetEmail })

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: targetEmail, email_confirm: true,
        user_metadata: { full_name: displayName, avatar_url: avatarUrl, line_user_id: lineUserId, provider: "line" },
      })

      if (createErr) {
        if (createErr.message.includes("already been registered") || createErr.message.includes("duplicate")) {
          const { data: byEmail } = await admin.auth.admin.listUsers({ perPage: 1000 })
          const matched = byEmail?.users?.find((u: any) => u.email === targetEmail)
          if (!matched) return NextResponse.json({ error: "line_create" }, { status: 500 })
          await admin.auth.admin.updateUserById(matched.id, {
            user_metadata: { ...matched.user_metadata, line_user_id: lineUserId },
          })
        } else {
          return NextResponse.json({ error: "line_create", detail: createErr.message }, { status: 500 })
        }
      } else if (created?.user) {
        await admin.from("users").upsert(
          { id: created.user.id, email: targetEmail, full_name: displayName },
          { onConflict: "id" }
        )
      }
    }

    // ── Step 3: Mint a Supabase session (magic-link action_link) ──────────
    const redirectTo = next
      ? `${appUrl}/auth/line-callback?next=${encodeURIComponent(next)}`
      : `${appUrl}/auth/line-callback`

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink", email: targetEmail, options: { redirectTo },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      log("generateLink failed", linkErr?.message)
      return NextResponse.json({ error: "line_session", detail: linkErr?.message }, { status: 500 })
    }

    log("session minted ✓", { email: targetEmail, next })
    return NextResponse.json({ actionLink: linkData.properties.action_link })

  } catch (err: any) {
    log("unexpected error", err?.message)
    return NextResponse.json({ error: "unexpected", detail: err?.message }, { status: 500 })
  }
}
