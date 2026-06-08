/**
 * LINE Login — Step 2: Handle callback from LINE
 */
import { NextRequest, NextResponse } from "next/server"
import { cookies }            from "next/headers"
import { createAdminClient }  from "@/lib/supabase/admin"
import { createServerClient, type CookieOptions } from "@supabase/ssr"

const LINE_TOKEN_URL   = "https://api.line.me/oauth2/v2.1/token"
const LINE_PROFILE_URL = "https://api.line.me/v2/profile"
const LINE_USERINFO_URL = "https://api.line.me/oauth2/v2.1/userinfo"

function log(step: string, data?: any) {
  console.log(`[LINE:callback] ${step}`, data ? JSON.stringify(data) : "")
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const cookieStore = await cookies()
  const savedState  = cookieStore.get("line_oauth_state")?.value
  const next        = cookieStore.get("line_oauth_next")?.value ?? "/dashboard"
  const platform    = cookieStore.get("line_oauth_platform")?.value ?? "web"
  const isIOS       = platform === "ios"

  // Clear state cookies
  cookieStore.delete("line_oauth_state")
  cookieStore.delete("line_oauth_next")
  cookieStore.delete("line_oauth_platform")

  // Where to land once Supabase has minted a session for this LINE login.
  // Native (iOS) opens this whole flow inside an ASWebAuthenticationSession
  // listening for the `slippy://` scheme — redirecting the magic-link tokens
  // there lets the app capture the session directly (mirrors how Google/
  // Facebook OAuth completes via `slippy://auth/callback`). Web keeps using
  // the client-side hash-reader page since middleware can't read fragments.
  const sessionRedirectTarget = isIOS ? "slippy://auth/callback" : `${appUrl}/auth/line-callback`
  const errorRedirect = (code: string, detail?: string) => {
    const qs = new URLSearchParams({ error: code, ...(detail ? { detail } : {}) })
    const base = isIOS ? "slippy://auth/callback" : `${appUrl}/login`
    return NextResponse.redirect(`${base}?${qs.toString()}`)
  }

  log("received", { code: code?.slice(0,8), state: state?.slice(0,8), savedState: savedState?.slice(0,8), error })

  if (error) {
    log("LINE returned error", error)
    return errorRedirect("line_cancelled", String(error))
  }

  // CSRF check
  if (!state || !savedState || state !== savedState) {
    log("state mismatch", { state: state?.slice(0,8), savedState: savedState?.slice(0,8) })
    // Allow in dev without state (e.g. direct URL test)
    if (process.env.NODE_ENV === "production") {
      return errorRedirect("line_state_mismatch")
    }
    log("⚠️ state mismatch ignored in dev mode")
  }

  if (!code) {
    return errorRedirect("line_no_code")
  }

  const channelId     = process.env.LINE_LOGIN_CHANNEL_ID
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET

  if (!channelId || !channelSecret) {
    log("ERROR: LINE env vars missing")
    return errorRedirect("line_not_configured")
  }

  const redirectUri = `${appUrl}/api/auth/line/callback`

  try {
    // ── Step 1: Exchange code → access token ────────────────────
    log("exchanging code for token...")
    const tokenRes = await fetch(LINE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        client_id:     channelId,
        client_secret: channelSecret,
      }),
    })

    const tokenBody = await tokenRes.json()
    log("token response", { ok: tokenRes.ok, status: tokenRes.status, keys: Object.keys(tokenBody) })

    if (!tokenRes.ok) {
      log("token exchange failed", tokenBody)
      return errorRedirect("line_token", String(tokenBody.error))
    }

    const accessToken: string = tokenBody.access_token

    // ── Step 2: Fetch LINE profile + extract email ─────────────
    log("fetching LINE profile...")
    const profileRes = await fetch(LINE_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!profileRes.ok) {
      log("profile fetch failed", { status: profileRes.status })
      return errorRedirect("line_profile")
    }

    const profile = await profileRes.json()

    const lineUserId  = profile.userId      as string
    const displayName = profile.displayName as string
    const avatarUrl   = profile.pictureUrl  as string | undefined

    // ── Extract email: try 3 sources in priority order ──────────
    // 1. id_token JWT payload (most reliable — included when email scope granted)
    // 2. userinfo endpoint
    // 3. none → placeholder
    let lineEmail: string | undefined

    // Source 1: decode id_token (base64 JWT, no verification needed for email claim)
    const idToken: string | undefined = tokenBody.id_token
    if (idToken) {
      try {
        const [, payloadB64] = idToken.split(".")
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"))
        lineEmail = payload.email as string | undefined
        log("id_token email", { email: lineEmail ?? "none" })
      } catch (e) {
        log("id_token decode failed", String(e))
      }
    }

    // Source 2: userinfo endpoint (fallback)
    if (!lineEmail) {
      const userinfoRes = await fetch(LINE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (userinfoRes.ok) {
        const userinfo = await userinfoRes.json()
        lineEmail = userinfo.email as string | undefined
        log("userinfo email", { email: lineEmail ?? "none" })
      }
    }

    log("LINE user", { lineUserId: lineUserId.slice(0,6), displayName, hasEmail: !!lineEmail, email: lineEmail })

    // ── Step 3: Find or create Supabase user ────────────────────
    const admin = createAdminClient()
    let   targetEmail: string
    let   isNewUser = false

    // Search by line_user_id in metadata (paginate to be safe)
    log("searching for existing user...")
    let   existingUser: any = null
    let   page = 1
    while (!existingUser) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (!list?.users?.length) break
      existingUser = list.users.find(
        u => u.user_metadata?.line_user_id === lineUserId
      )
      if (list.users.length < 1000) break
      page++
    }

    if (existingUser) {
      log("found existing user", { id: existingUser.id.slice(0,8) })

      const hasPlaceholderEmail = (existingUser.email ?? "").includes("@noreply.slippy.app")
        || (existingUser.email ?? "").includes("@line.slippy.app")

      // If LINE now provides a real email and user had a placeholder → upgrade it
      if (lineEmail && hasPlaceholderEmail) {
        log("upgrading placeholder email to real LINE email", lineEmail)
        await admin.auth.admin.updateUserById(existingUser.id, {
          email:         lineEmail,
          email_confirm: true,
          user_metadata: { ...existingUser.user_metadata, avatar_url: avatarUrl },
        })
        targetEmail = lineEmail
      } else {
        targetEmail = existingUser.email!
        // Update avatar if changed
        if (avatarUrl && existingUser.user_metadata?.avatar_url !== avatarUrl) {
          await admin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: { ...existingUser.user_metadata, avatar_url: avatarUrl },
          })
        }
      }
    } else {
      // Create new user
      isNewUser     = true
      // LINE doesn't always provide email — use a placeholder that's clearly
      // not a real email. Domain "noreply.slippy.app" signals internal-only.
      targetEmail   = lineEmail ?? `line.${lineUserId.toLowerCase()}@noreply.slippy.app`
      log("creating new user", { email: targetEmail })

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email:          targetEmail,
        email_confirm:  true,
        user_metadata:  { full_name: displayName, avatar_url: avatarUrl, line_user_id: lineUserId, provider: "line" },
      })

      if (createErr) {
        log("createUser error", createErr.message)
        // Email already exists — link LINE to existing account
        if (createErr.message.includes("already been registered") || createErr.message.includes("duplicate")) {
          const { data: byEmail } = await admin.auth.admin.listUsers({ perPage: 1000 })
          const matched = byEmail?.users?.find(u => u.email === targetEmail)
          if (!matched) return errorRedirect("line_create")
          await admin.auth.admin.updateUserById(matched.id, {
            user_metadata: { ...matched.user_metadata, line_user_id: lineUserId },
          })
          log("linked LINE to existing account", matched.id.slice(0,8))
          isNewUser = false
        } else {
          return errorRedirect("line_create", createErr.message)
        }
      } else {
        log("created user", created?.user?.id?.slice(0,8))
        // Sync to public users table
        if (created?.user) {
          await admin.from("users").upsert(
            { id: created.user.id, email: targetEmail, full_name: displayName },
            { onConflict: "id" }
          )
        }
      }
    }

    // ── Step 4: Create session via generateLink ────────────────
    // Supabase returns tokens as hash fragment (#access_token=...) so we redirect
    // to a CLIENT-SIDE page (/auth/line-callback) that can read the hash,
    // call supabase.auth.onAuthStateChange(), set cookies, then navigate to dashboard.
    // (Server-side middleware cannot read hash fragments)
    log("generating sign-in link for", targetEmail, { redirectTo: sessionRedirectTarget })
    // NOTE: `sessionRedirectTarget` (either the web hash-reader page or, for
    // iOS, the `slippy://auth/callback` custom scheme) must be present in
    // Supabase Dashboard → Authentication → URL Configuration → Redirect URLs,
    // otherwise `generateLink` will silently fall back / Supabase will refuse
    // to append the session tokens to it.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type:    "magiclink",
      email:   targetEmail,
      options: { redirectTo: sessionRedirectTarget },
    })

    if (linkErr || !linkData?.properties?.action_link) {
      log("generateLink failed", linkErr?.message)
      return errorRedirect("line_session", linkErr?.message ?? "no_link")
    }

    log("redirecting to action_link")
    return NextResponse.redirect(linkData.properties.action_link)

  } catch (err: any) {
    log("unexpected error", err.message)
    return errorRedirect("line_unexpected", err.message)
  }
}
