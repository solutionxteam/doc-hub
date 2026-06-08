# Sport Groups on LINE — "à la KhunThong"

Group bill-splitting & tracking for recurring sport sessions (badminton,
basketball, football, …), built directly into the LINE OA chat + LIFF.

> **🧳 Trip Groups (กลุ่มทริป)** — a parallel feature for travel/tourism
> (`/tripgroup`, `/tripstatus`, `/trippay`, `/tripdone`, dashboard at
> `/liff/trip`) works **identically** to Sport Groups described below — same
> `split_bills`/`split_participants` tables, same even-split mechanics, same
> LIFF auth flow — just themed for trips (`category = 'trip'`,
> `trip_type`/`destination` columns instead of `sport_type`/`venue`; see
> `supabase/migrations/038_trip_groups.sql` and
> `api/src/services/line-trip.ts`). The Rich Menu now has dedicated highlighted
> cards for both "🏸 กลุ่มกีฬา" and "✈️ กลุ่มทริป". Everything below — chat
> commands, LIFF dashboard, auth flow, troubleshooting — applies equally to
> trip groups; just swap `sport`→`trip`, `/sportgroup`→`/tripgroup`,
> `/liff/sport`→`/liff/trip`, etc.

## How it works

A "sport group" is a `split_bills` row with `document_id = NULL` and
`category = 'sport'` (see `supabase/migrations/037_sport_groups.sql`). Unlike
the receipt-based `/split` flow (which divides up line items from a scanned
document), a sport group splits **one flat fee evenly** across however many
people have joined — exactly like KhunThong's court-fee groups.

```
organizer                          friends
   │  /sportgroup แบด 400 สนามบางนา   │
   ├─────────────────────────────────▶│ (creates split_bills, category=sport)
   │◀── flex card + LIFF join link ───┤
   │                                   │
   │        shares link in group chat  │
   ├──────────────────────────────────▶│ tap link → opens LIFF → auto-joins
   │                                   │ (POST /api/liff/join-split rebalances
   │                                   │  total ÷ headcount for everyone)
   │  /sportstatus rhdgroup            │
   ├─────────────────────────────────▶│ flex card: who paid ✅ / pending ⏳
   │  /sportpay rhdgroup               │
   │◀─ marks own share paid_at=now() ──┤
   │  /sportdone rhdgroup              │
   ├─────────────────────────────────▶│ closes group (status=finalized),
                                        final settle-up summary card
```

## Chat commands (`api/src/routes/line.ts` → `api/src/services/line-sport.ts`)

| Command | Who | What it does |
|---|---|---|
| `/sportgroup [กีฬา] [ค่าใช้จ่ายรวม] [สถานที่]` | anyone w/ linked account | Creates the group, auto-adds the caller, returns a flex card with a shareable LIFF join link. e.g. `/sportgroup แบด 400 สนามบางนา` |
| `/sportstatus [รหัสกลุ่ม]` | anyone | Shows per-person share + paid/pending status (8-char id prefix is enough) |
| `/sportpay [รหัสกลุ่ม]` | participant | Marks the caller's own share as paid (`split_participants.paid_at`) |
| `/sportdone [รหัสกลุ่ม]` | anyone | Finalizes the group (`status = 'finalized'`) and posts the settle-up summary |

`/sport` is kept as an alias of `/sportgroup` for backward compatibility with
the old rich menu / muscle memory.

## LIFF integration

There are now **two** LIFF surfaces for sport groups:

### 1. Join page — `web/src/app/liff/join/[token]/page.tsx`
- Link format: `https://liff.line.me/${LIFF_ID}/liff/join/{share_token}?type=split`
  (built by `joinUrl()` in `line-sport.ts`, mirrors `web/src/lib/liff.ts → makeLiffJoinUrl`)
- Runs **inside** the LINE app, calls `initLiff()` / `getLiffProfile()` to silently
  grab `userId` + `displayName`, then auto-joins via `POST /api/liff/join-split`.
- `web/src/app/api/liff/join-split/route.ts` — on join, if the bill's
  `category === 'sport'`, **recomputes everyone's even split** (`total ÷ headcount`)
  so shares stay correct as people trickle in.
- `web/src/app/api/liff/bill-info/route.ts` — feeds the join page's header card;
  returns `type: "sport"`, `venue`, `sport_type` so it shows the 🏸/⚽/🏀 emoji + venue.
- Falls back gracefully to a plain web page (manual name entry) when opened
  outside the LINE app or `NEXT_PUBLIC_LIFF_ID` isn't configured.

### 2. Sport Groups Dashboard — `web/src/app/liff/sport/page.tsx` (NEW — "à la KhunThong")
A full mini-app opened **directly from the Rich Menu** (`🏸 กลุ่มกีฬา` card → `uri`
action → `https://liff.line.me/${LIFF_ID}/liff/sport`). No chat command needed —
LIFF auto-identifies the user via `liff.getProfile()`.

**Login flow (LINE-branded, never the Slippy web login):** the page runs its own
step-by-step `liff.init() → isInClient() → isLoggedIn() → getProfile()` state
machine (NOT the auto-redirecting `getLiffProfile()` helper) so it can show a
**custom green "เข้าสู่ระบบด้วย LINE" screen** before calling `liff.login()` —
the user taps an explicit button rather than being silently bounced to a bare
LINE OAuth page that looks confusingly similar to Slippy's own `/login`. Every
step's real error message is captured and surfaced (`authError` state) instead
of a generic "เปิดจากแอป LINE เท่านั้น" that hides the actual cause.

Three views in one page (`list → create → detail`):
- **List** — every sport group the user has joined/created, with live paid/headcount badges
- **Create** — pick a sport (chips or free text), enter total fee + optional venue →
  posts to `POST /api/liff/sport-groups`, auto-joins the creator, opens detail
- **Detail** — full participant list (✅/⏳ + share amounts), "จ่ายแล้ว/ยกเลิก" toggle
  for the caller's own row, "🙋 เข้าร่วมกลุ่มนี้" join button, "📤 แชร์ลิงก์ชวนเพื่อน"
  (uses `liff.shareTargetPicker` when available, falls back to clipboard), and
  "🔒 ปิดกลุ่ม / สรุปยอด" finalize button

Backing API routes (both require a linked `line_connections` row to **create**,
same constraint as the chat `/sportgroup` flow — browsing/joining/paying do not):
- `GET/POST /api/liff/sport-groups` — list user's groups / create a new one
- `GET/POST /api/liff/sport-groups/[id]` — group detail / actions
  (`action: "join" | "pay" | "unpay" | "finalize"`, each rebalances shares as needed)

`web/src/lib/liff.ts → makeLiffSportUrl()` builds the dashboard deep link; the
flex cards returned by `/sportgroup` and `/sportstatus` (in `line-sport.ts`)
also link to it via `dashboardUrl()`.

## Rich Menu

`api/src/scripts/setup-rich-menu.ts` — Row 2, Col 0 card is now **"กลุ่มกีฬา"**
(🏸, gradient `c3`, highlighted) and its tap-area is a `uri` action that opens
the **LIFF dashboard** directly (`SPORT_LIFF_URL = https://liff.line.me/${LIFF_ID}/liff/sport`)
— not a chat command, so users land straight in the KhunThong-style mini-app.
`/sportgroup` chat command remains as a power-user shortcut. Re-run after editing:

```bash
cd api && npm run setup:richmenu
```

This regenerates the 2500×1686 PNG and re-uploads via:
- `POST https://api.line.me/v2/bot/richmenu` (create, needs `LINE_CHANNEL_ACCESS_TOKEN`)
- `POST https://api-data.line.me/v2/bot/richmenu/{id}/content` (image upload)

---

## Testing

### 1. Local webhook testing (no real LINE messages needed)
The bot endpoint is `POST /line` in `api/src/routes/line.ts` (Fastify). It
verifies `x-line-signature` via HMAC-SHA256 with `LINE_CHANNEL_SECRET`. To test
locally without a live LINE account:

```bash
cd api
# Compute a valid signature for a fake event payload, then POST it:
node -e "
const crypto = require('crypto')
const body = JSON.stringify({ events: [{
  type: 'message', replyToken: 'test-token',
  source: { userId: 'Utestuser1234567890123456789012' },
  message: { type: 'text', id: '1', text: '/sportgroup แบด 400 สนามบางนา' }
}]})
const sig = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(body).digest('base64')
console.log('X-Line-Signature:', sig)
console.log(body)
"
# then curl -X POST http://localhost:PORT/line -H 'x-line-signature: <sig>' -H 'Content-Type: application/json' -d '<body>'
```

> Note: a real `line_connections` row (linked account) is required for most
> commands — seed one for your test `userId` + org first, or test `/connect`.

### 2. Live test on LINE (recommended end-to-end check)
1. Add the LINE OA as a friend (scan QR from LINE Developers Console → Messaging API).
2. `/connect CODE` — generate a code from Settings → LINE Bot in the web app, link your account.
3. `/sportgroup แบด 400 สนามบางนา` → should reply with a flex card + "ส่งลิงก์ชวนเพื่อนเข้ากลุ่ม" button.
4. Tap the join link **from a different LINE account** (or share to a group chat and have a friend tap it) → LIFF page should auto-identify and show "เข้าร่วมแล้ว! 🎉".
5. `/sportstatus <รหัสกลุ่ม>` (8-char id shown in the card) → confirm the per-head share updated (total ÷ new headcount) and shows "⏳" for unpaid members.
6. `/sportpay <รหัสกลุ่ม>` → re-run `/sportstatus`, confirm your row flips to "✅".
7. `/sportdone <รหัสกลุ่ม>` → confirm card header turns green "ปิดกลุ่ม — สรุปยอด" and `split_bills.status = 'finalized'`; further `/sportpay` on that group should be rejected ("กลุ่มนี้ปิดแล้วครับ").

### 3. Rich Menu + LIFF dashboard verification
- LINE app → OA chat → tap the chat-bar menu icon → tap "🏸 กลุ่มกีฬา" → should open
  the LIFF dashboard **inside LINE** (not redirect to a chat command).
- Dashboard should auto-identify you (greeting with your display name + avatar,
  no manual login) and show your existing groups, or an empty state with a
  "+ สร้างกลุ่ม" button.
- Try: create a group → detail view opens → "แชร์ลิงก์ชวนเพื่อน" (tests
  `liff.shareTargetPicker`) → "จ่ายแล้ว" toggle → "ปิดกลุ่ม / สรุปยอด".
- If the menu doesn't show your latest changes: LINE caches rich menus per-user;
  unlink/re-add the OA as friend, or wait — LINE refreshes within ~minutes to hours.
- If the dashboard shows "เปิดจากแอป LINE เท่านั้น": confirm the LIFF app's
  **Endpoint URL** in LINE Developers Console matches your deployed domain +
  `/liff` (LIFF strips the configured base path, so the actual route the browser
  loads is `/liff/sport`), and that `NEXT_PUBLIC_LIFF_ID` is set in the deployed env.

### 4. Database checks (Supabase SQL editor / `execute_sql` MCP)
```sql
-- See active sport groups
select id, title, sport_type, venue, total_amount, status, share_token
from split_bills where category = 'sport' order by created_at desc limit 10;

-- See per-person shares & paid status for one group
select sp.name, sp.amount, sp.paid_at, sp.line_user_id
from split_participants sp
where sp.split_bill_id = '<group-uuid>';
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Bot doesn't reply at all | Webhook URL not set / signature mismatch | LINE Developers Console → Messaging API → confirm Webhook URL points to `https://<api-domain>/line` and "Use webhook" is ON. Check `LINE_CHANNEL_SECRET` matches the channel. |
| `400 Invalid signature` in logs | Wrong `LINE_CHANNEL_SECRET`, or body re-serialized before HMAC (must use raw bytes) | Confirm Fastify `rawBody: true` on the route (already configured) and the env var matches the **Messaging API channel** (not the Login channel). |
| "กรุณาเชื่อมบัญชีก่อนครับ" on every command | No `line_connections` row for this `lineUserId` | Run `/connect CODE` first — generate the code from the web app Settings → LINE Bot. |
| `/sportgroup` replies with usage help instead of creating | Missing args — needs at least `[กีฬา]` | `/sportgroup แบด 400` (fee & venue optional but recommended) |
| Join link opens a blank/broken page outside LINE | `NEXT_PUBLIC_LIFF_ID` not configured, or LIFF endpoint URL mismatch | LINE Developers Console → Messaging API channel → LIFF tab → confirm endpoint is `https://slippy.ai/liff` and `NEXT_PUBLIC_LIFF_ID` is set in the deployed env (not just `.env.local`). |
| Friend taps link but doesn't auto-join (asks for name) | LIFF `init()` failed or opened in external browser, not inside LINE | Must be opened **from inside the LINE app** (tap the link in a chat) for `liff.isInClient()` to be true and silently fetch the profile; opening in Safari/Chrome falls back to manual name entry. |
| Per-head share looks wrong after people join | Rebalance didn't run | `/sportstatus` always recomputes (`rebalance()` in `line-sport.ts`) before rendering — re-run it. If still wrong, check `split_bills.total_amount` and count rows in `split_participants` for that `split_bill_id`. |
| `/sportpay` says "กลุ่มนี้ปิดแล้วครับ" | Group already finalized via `/sportdone` | Expected — finalized groups are read-only. Create a new group for the next session. |
| Duplicate participant rows / wrong headcount | User joined via link AND ran `/sportpay` before joining | `handleSportPay` upserts by `(split_bill_id, line_user_id)` — should not duplicate. If it does, check the `UNIQUE (group_id, line_user_id)`-style constraints exist (mirrors `022_line_split_bill.sql`'s `idx_split_parts_line`). |
| Rich menu shows old labels/commands | LINE-side cache | Re-run `npm run setup:richmenu`, then have users unfriend/re-add the OA, or wait for LINE's client cache to refresh. |
| `generateLink`/push errors in logs | `LINE_CHANNEL_ACCESS_TOKEN` missing/expired | Messaging API channel → re-issue long-lived channel access token, update env var in deployment (Vercel/host), redeploy. |
| Tapping "🏸 กลุ่มกีฬา" redirects to Slippy's own `/login` page (web auth) | `web/src/middleware.ts` was redirecting **every** unauthenticated request — `/liff/*` and `/api/liff/*` weren't in the public allowlist, so the Supabase-session check fired before LIFF could run | Fixed: `isPublic` now includes `pathname.startsWith("/liff/")` and `pathname.startsWith("/api/liff/")`. LIFF pages authenticate via the LINE profile (`liff.getProfile()`), never via Supabase session — they must stay outside the auth gate. |
| Dashboard shows a bare/confusing LINE OAuth screen, then errors after granting consent | The page used `getLiffProfile()`, which calls `liff.login()` automatically the instant `isLoggedIn()` is false — an abrupt redirect that looks like it could be Slippy's web login, and any thrown error after the redirect-back was swallowed into a generic "เปิดจากแอป LINE เท่านั้น" | Rewritten as an explicit step-by-step state machine (`checking → outsideLine / needLogin / ready / authError`). `needLogin` now shows our **own LINE-green branded screen** ("เข้าสู่ระบบด้วย LINE") with a button the user taps deliberately; `authError` surfaces the *real* SDK error message (from `liff.init`/`login`/`getProfile`) so it's actually debuggable, plus a "↻ ลองเชื่อมต่อใหม่" retry. |
| `authError` shows "เริ่มต้น LIFF ไม่สำเร็จ: ..." | Usually a LIFF ID / endpoint URL mismatch | LINE Developers Console → channel → LIFF tab → confirm the LIFF app's **Endpoint URL** resolves correctly when `/liff/sport` is appended (e.g. endpoint `https://slippy.ai` + path `/liff/sport` → `https://slippy.ai/liff/sport`, which must match the actual Next.js route `web/src/app/liff/sport/page.tsx`). |

## Key files
- `api/src/services/line-sport.ts` — sport-group commands, flex cards (incl. `dashboardUrl()` links), even-split logic
- `api/src/routes/line.ts` — webhook + command routing (`/sportgroup`, `/sportstatus`, `/sportpay`, `/sportdone`)
- `api/src/services/line-flex.ts` — `commandMenuCard()` "กลุ่มกีฬา" bubble incl. "เปิดแดชบอร์ดกีฬา" LIFF link
- `api/src/scripts/setup-rich-menu.ts` — Rich Menu layout/upload incl. `SPORT_LIFF_URL` tap-area (run `npm run setup:richmenu`)
- `web/src/lib/liff.ts` — LIFF init/profile/join-link/`makeLiffSportUrl()` helpers
- `web/src/app/liff/join/[token]/page.tsx` — LIFF join UI (single-bill join flow)
- `web/src/app/liff/sport/page.tsx` — **NEW** Sport Groups Dashboard (list/create/detail mini-app)
- `web/src/app/api/liff/join-split/route.ts` — join + even-split rebalance
- `web/src/app/api/liff/bill-info/route.ts` — bill header info for the join page
- `web/src/app/api/liff/sport-groups/route.ts` — **NEW** list groups (GET) / create group (POST)
- `web/src/app/api/liff/sport-groups/[id]/route.ts` — **NEW** group detail (GET) / actions: join, pay, unpay, finalize (POST)
- `supabase/migrations/037_sport_groups.sql` — `category`/`sport_type`/`venue` columns on `split_bills`
