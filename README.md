# Slipify

AI-powered document ingestion SaaS for Thai accounting teams.  
Upload invoices, receipts, and tax documents — Slipify extracts the data and pushes it directly to FlowAccount, PEAK, or Express in seconds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, next-intl, next-themes |
| Backend API | Fastify 4, BullMQ, Redis |
| Database | Supabase (PostgreSQL + Auth + Storage + RLS) |
| AI | Anthropic Claude (claude-sonnet-4-5) |
| OCR | Google Document AI |
| Payments | Stripe |
| Mobile | Expo (React Native) |

---

## Monorepo Structure

```
doc-hub/
├── web/                  # Next.js frontend
├── api/                  # Fastify API + BullMQ workers
├── mobile/               # Expo React Native app
├── supabase/
│   ├── config.toml       # Local dev config
│   └── migrations/       # SQL migrations (001–004)
└── package.json          # Workspace root
```

---

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** or **npm** ≥ 9
- **Docker** (for Supabase local dev)
- **Supabase CLI** — `brew install supabase/tap/supabase`
- **Redis** — `brew install redis` or use Upstash

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-org/slipify.git
cd slipify/doc-hub
npm install
```

### 2. Environment variables

```bash
cp web/.env.example web/.env.local
cp api/.env.example api/.env
```

Fill in the required values (see sections below).

### 3. Start Supabase locally

```bash
supabase start          # starts DB, Auth, Storage, Studio
supabase db push        # applies all migrations from supabase/migrations/
```

Studio is available at **http://localhost:54323**  
API URL: **http://localhost:54321**

After `supabase start`, copy the output values into `web/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from output>
SUPABASE_SERVICE_KEY=<service role key from output>
```

### 4. Start Redis

```bash
redis-server
```

Or set `REDIS_URL=redis://localhost:6379` in `api/.env`.

### 5. Start development servers

```bash
# In three separate terminals:
npm run dev -w web      # Next.js on http://localhost:3000
npm run dev -w api      # Fastify on http://localhost:4000
npm run workers -w api  # BullMQ workers
```

---

## Environment Variables

### `web/.env.local`

| Key | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `NEXT_PUBLIC_STRIPE_PRICE_STARTER` | Stripe price ID for Starter plan |
| `NEXT_PUBLIC_STRIPE_PRICE_PRO` | Stripe price ID for Pro plan |
| `NEXT_PUBLIC_STRIPE_PRICE_ENTERPRISE` | Stripe price ID for Enterprise plan |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `API_BASE_URL` | Internal Fastify URL (e.g. `http://localhost:4000`) |
| `INTERNAL_API_KEY` | Shared secret between Next.js and Fastify |

### `api/.env`

| Key | Description |
|---|---|
| `PORT` | Fastify port (default `4000`) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (never expose to client) |
| `REDIS_URL` | Redis connection URL |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GOOGLE_DOC_AI_LOCATION` | Document AI location (default `us`) |
| `GOOGLE_DOC_AI_PROCESSOR_ID` | Document AI processor ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256 encryption |
| `INTERNAL_API_KEY` | Must match `web/.env.local` value |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `LINE_CHANNEL_SECRET` | Line Bot channel secret |
| `LINE_CHANNEL_ACCESS_TOKEN` | Line Bot channel access token |

---

## Google Document AI Setup

1. Create a project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable **Cloud Document AI API**
3. Create a **Form Parser** or **Document OCR** processor
4. Download a service account key JSON
5. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of that JSON file
6. Set `GOOGLE_DOC_AI_PROCESSOR_ID` to your processor's ID

---

## Stripe Setup

1. Create products + prices in [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a webhook endpoint pointing to `https://your-domain.com/api/webhooks/stripe`
3. Subscribe to: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

---

## Database Migrations

Migrations live in `supabase/migrations/` and are applied in order:

| File | Contents |
|---|---|
| `001_core_schema.sql` | Core tables, triggers, indexes |
| `002_rls_policies.sql` | Row Level Security policies |
| `003_stripe.sql` | Stripe events, billing, plans, quota enforcement |
| `004_views.sql` | Analytics views and tax report functions |

Apply to local dev:
```bash
supabase db push
```

Apply to production (using Supabase CLI linked to project):
```bash
supabase db push --linked
```

---

## Deployment

### Vercel (web)

```bash
cd web
vercel --prod
```

Set all `NEXT_PUBLIC_*` and server-side env vars in Vercel project settings.

### Railway / Fly.io (api + workers)

The `api/` Fastify server and `api/` workers are separate processes.  
Recommended: deploy as two services sharing the same Redis and Supabase credentials.

```bash
# API server
npm run start -w api

# Workers (separate dyno/container)
npm run workers -w api
```

---

## Line Bot Setup

1. Create a Line Developer account → Messaging API channel
2. Set webhook URL: `https://your-domain.com/api/webhooks/line`
3. Enable webhook and disable auto-reply
4. Copy **Channel Secret** and **Channel Access Token** to env vars
5. Users add your bot and send document images → auto-extracted!

---

## License

MIT © 2026 Slipify
