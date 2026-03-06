# CLAUDE.md

## Project Overview

**ChurnGuard** — B2B SaaS that recovers failed subscription payments via smart dunning sequences and AI-personalized recovery emails (Claude API).

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js App Router (TypeScript) |
| Database + Auth + Queues | Supabase (PostgreSQL + RLS + pgmq) |
| Payments (own billing) | Stripe |
| Email delivery | Resend |
| AI email generation | Anthropic SDK (`claude-sonnet-4-6`) |
| ORM | Drizzle ORM |
| Deployment | Vercel |

## Architecture

```
Customer Stripe → invoice.payment_failed webhook
                          ↓
             /api/webhooks/stripe?org=<slug> (verify signature, idempotent)
                          ↓
             failed_payments table (Supabase)
                          ↓
             dunning_jobs scheduled (soft/hard/sca schedules)
                          ↓
             Day 0 email sent immediately (best-effort, fallback to cron)
                          ↓
             /api/cron/process-dunning (hourly, remaining jobs)
             ├── soft decline → retry + email sequence (Day 0, 3, 7, 10)
             ├── hard decline → single email, no retry
             ├── Generate email via Claude API (fallback: static templates)
             └── Send via Resend
                          ↓
             Dashboard: MRR recovered, recovery rate, timeline
```

### Webhook Events Handled

- `invoice.payment_failed` → create failed_payment + schedule dunning jobs + send Day 0 email immediately
- `invoice.payment_succeeded` → cancel pending jobs, mark as recovered
- `customer.subscription.deleted` → cancel pending jobs, mark as hard_churn

## Database Schema

Source of truth: `src/db/schema.ts` (Drizzle ORM, 9 tables + 8 enums + relations).

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `organizations` | ChurnGuard customers (SaaS companies) | slug (unique), stripe_webhook_secret, plan, plan_status, logo_url, brand_color |
| `organization_members` | User-to-org mapping | user_id, role (`owner`/`admin`/`viewer`) |
| `failed_payments` | Subscriber payments in dunning | decline_type (`soft`/`hard`/`sca_required`), status, dunning_step |
| `dunning_jobs` | Scheduled retries and emails | job_type (`email`/`retry`), status, scheduled_at, retry_count |
| `recovery_metrics` | Aggregated per org/period | total_failed, total_recovered, recovery_rate, mrr_saved |
| `webhook_events` | Idempotency store | stripe_event_id (unique), processed |
| `payment_tokens` | Secure update-payment links | token (unique), failed_payment_id, expires_at, used_at |
| `notifications` | In-app alerts | type (`job_failed`/`payment_recovered`/`plan_past_due`/`plan_expiring`), read |
| `invitations` | Team member invites | email, role, token (unique), expires_at, accepted_at |

All tables use `uuid` PKs. Multi-tenancy via `organization_id` FK on every table.

## Key Architectural Patterns

- **Webhook idempotency**: store `stripe_event_id` in `webhook_events`, check before processing
- **Webhook signature**: verify with `stripe.webhooks.constructEvent` using per-org `stripe_webhook_secret`
- **Immediate Day 0 email**: webhook sends Day 0 email synchronously (best-effort); on failure, falls back to cron via retry backoff
- **Async processing**: webhook returns 200 immediately; remaining dunning jobs are processed hourly by cron (SKIP LOCKED)
- **Dunning retry backoff**: failed jobs retry up to 3x with 1h/4h/24h intervals; definitive failures create in-app notifications
- **Plan gate**: dunning jobs skip orgs with expired/canceled plans (7-day grace for past_due)
- **Starter plan limit**: 500 failed payments/month; warning at 400, hard stop at 500
- **Secure payment tokens**: email URLs use opaque UUID tokens (30-day expiry) via `src/lib/tokens/payment-tokens.ts` — never expose internal IDs
- **Multi-tenancy**: all data scoped by `organization_id`; org resolved from `?org=<slug>` query param on webhook
- **AI email fallback**: if `ANTHROPIC_API_KEY` missing or API fails, `getStaticTemplate()` is used
- **Auth flow**: middleware protects `/dashboard/*` routes; Server Actions use `requireAuth()` or `getAuthAndOrg()` from `src/lib/auth.ts`
  - `requireAuth()` — returns user or redirects to `/login`
  - `getOrganization(userId)` — returns org + role or null
  - `getAuthAndOrg()` — combines both in one call
- **Lazy clients**: DB connection (`src/db/index.ts`) and Stripe client (`src/lib/stripe/client.ts`) are lazy-loaded via Proxy

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Login, signup (public routes)
│   ├── (dashboard)/         # Protected dashboard pages
│   ├── accept-invitation/   # Public GET route to accept invitation via token
│   ├── actions/             # Server Actions (auth, onboarding, payments, settings, team)
│   ├── api/
│   │   ├── webhooks/stripe/ # Stripe webhook endpoint (POST)
│   │   └── cron/process-dunning/ # Hourly cron job (GET, CRON_SECRET)
│   └── auth/callback/       # Supabase auth callback
├── components/
│   ├── dashboard/           # KPI cards, payments table, timeline, sidebar, header
│   ├── onboarding/          # 3-step setup wizard
│   └── ui/                  # shadcn/ui primitives
├── db/
│   ├── schema.ts            # Drizzle schema (source of truth)
│   └── index.ts             # Lazy DB connection via Proxy
├── lib/
│   ├── supabase/            # Browser, server, and admin (service role) clients
│   ├── stripe/              # Lazy Stripe client + decline classifier
│   ├── dunning/             # scheduler.ts (job creation) + processor.ts (job execution)
│   ├── email/               # generator.ts (AI), sender.ts (Resend), templates.ts (static)
│   ├── tokens/              # payment-tokens.ts (create, validate, invalidate)
│   ├── metrics/             # Recovery metrics aggregation
│   └── auth.ts              # requireAuth(), getOrganization(), getAuthAndOrg()
├── middleware.ts             # Route protection (dashboard/* requires auth)
└── types/index.ts            # Drizzle inferred types + shared interfaces
```

## Development Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build (must pass before commits)
npm run lint         # ESLint check
```

### Schema Migrations (Drizzle)

1. Edit `src/db/schema.ts`
2. `npx drizzle-kit generate` — generate migration SQL
3. `npx drizzle-kit push` — apply directly to DB (dev only)
4. `npx drizzle-kit migrate` — apply pending migrations (production)

## Key API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/webhooks/stripe?org=<slug>` | POST | Stripe signature (per-org) | Receives customer Stripe webhook events |
| `/api/webhooks/stripe-churnguard` | POST | Stripe signature (global) | ChurnGuard own billing webhook |
| `/api/cron/process-dunning` | GET | `Bearer CRON_SECRET` | Processes pending dunning jobs |

## Environment Variables

See `.env.example` for the full list. Key variables:
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `STRIPE_SECRET_KEY` — Stripe API key
- `ANTHROPIC_API_KEY` — optional; if missing, AI email generation falls back to static templates
- `CRON_SECRET` — protects the cron endpoint
- `STRIPE_CHURNGUARD_WEBHOOK_SECRET` — webhook secret for ChurnGuard billing events
- `STRIPE_STARTER_PRICE_ID` / `STRIPE_GROWTH_PRICE_ID` — Stripe Price IDs for plans
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Vercel KV for webhook rate limiting (optional; if missing, rate limiting is skipped)

## Conventions

- **Server Actions**: one file per domain in `src/app/actions/` (auth, onboarding, payments, settings, update-payment, team). Always `"use server"` at top. Validate input with Zod. Public actions (no auth) use token validation instead of `requireAuth()`.
- **Update-payment flow**: `getPaymentDetails()` → `createSetupIntent()` → `confirmAndRetryInvoice()` — all token-authenticated, no user session required
- **Billing**: `startCheckout()`, `openCustomerPortal()` in `billing.ts`. Uses `src/lib/stripe/churnguard-billing.ts` for Stripe Checkout + Customer Portal. Dedicated webhook at `/api/webhooks/stripe-churnguard` syncs plan state (`checkout.session.completed`, `subscription.updated/deleted`, `invoice.payment_failed/succeeded`).
- **Trial & Plan gate**: New orgs get 14-day trial (`planExpiresAt = created_at + 14d`). Plan gate in `(dashboard)/layout.tsx` redirects `canceled` → `/onboarding?step=plan`. Cron sweeps expired trials → `past_due` + `plan_expiring` notification. `skipToPlan()` in `onboarding.ts` lets trialing orgs skip checkout.
- **Team management**: `inviteMember()`, `revokeMember()`, `changeRole()`, `getMembers()`, `cancelInvitation()`, `getPendingInvitations()` in `team.ts`. Owner-only for mutations, Owner+Admin for reads. Accept-invitation at `/accept-invitation?token=`.
- **Rate limiting**: `checkRateLimit(key)` in `src/lib/rate-limit.ts`. Fixed-window counters on Vercel KV (1000 req/min, 10000 req/hour per org). Fail open if KV unavailable. Applied to both webhook endpoints.
- **Branding**: `uploadLogo()`, `updateBrandColor()`, `removeLogo()` in `settings.ts`. Logo stored in Supabase Storage bucket `logos` (public read, service-role write). Max 2MB, PNG/JPG/SVG only.
- **New webhook event**: add a `case` in the `switch` block in `src/app/api/webhooks/stripe/route.ts` and create a `handleX()` function in the same file.
- **UI components**: shadcn/ui primitives in `src/components/ui/`; domain components in `src/components/dashboard/` or `src/components/onboarding/`.
- **Imports**: use `@/` path alias (maps to `src/`).
- **Types**: Drizzle inferred types + shared interfaces in `src/types/index.ts`.
- **No test suite yet**.
