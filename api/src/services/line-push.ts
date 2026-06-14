/**
 * line-push.ts — small shared helper for server-initiated LINE pushes
 * (i.e. messages NOT sent in direct response to a webhook event/replyToken).
 *
 * Used by:
 *   - routes/sport-notify.ts  (LIFF pay/finalize actions → push update to group)
 *   - services/medication-reminder.ts (already has its own copy — left as-is)
 *   - future sport-group reminder cron
 */

const LINE_API = "https://api.line.me/v2/bot"

export async function pushMsg(to: string, messages: object[]): Promise<void> {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!t) throw new Error("[LINE:push] LINE_CHANNEL_ACCESS_TOKEN is empty")
  if (!to) throw new Error("[LINE:push] missing 'to' (group/room/user id)")

  const res = await fetch(`${LINE_API}/message/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body:    JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`[LINE:push] HTTP ${res.status}: ${body.slice(0, 300)}`)
  }
}
