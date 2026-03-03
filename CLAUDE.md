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
             /api/cron/process-dunning (hourly)
             ├── soft decline → retry + email sequence (Day 0, 3, 7, 10)
             ├── hard decline → single email, no retry
             ├── Generate email via Claude API (fallback: static templates)
             └── Send via Resend
                          ↓
             Dashboard: MRR recovered, recovery rate, timeline
```

### Webhook Events Handled

- `invoice.payment_failed` → create failed_payment + schedule dunning jobs
- `invoice.payment_succeeded` → cancel pending jobs, mark as recovered
- `customer.subscription.deleted` → cancel pending jobs, mark as hard_churn

## Database Schema

Source of truth: `src/db/schema.ts` (Drizzle ORM, 6 tables + enums + relations).

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `organizations` | ChurnGuard customers (SaaS companies) | slug (unique), stripe_webhook_secret, plan |
| `organization_members` | User-to-org mapping | user_id, role (`owner`/`admin`/`viewer`) |
| `failed_payments` | Subscriber payments in dunning | decline_type (`soft`/`hard`/`sca_required`), status (`pending`/`in_dunning`/`recovered`/`hard_churn`/`cancelled`), dunning_step |
| `dunning_jobs` | Scheduled retries and emails | job_type (`email`/`retry`), status (`pending`/`executing`/`done`/`failed`/`cancelled`), scheduled_at |
| `recovery_metrics` | Aggregated per org/period | total_failed, total_recovered, recovery_rate, mrr_saved |
| `webhook_events` | Idempotency store | stripe_event_id (unique), processed |

All tables use `uuid` PKs. Multi-tenancy via `organization_id` FK on every table.

## Key Architectural Patterns

- **Webhook idempotency**: store `stripe_event_id` in `webhook_events`, check before processing
- **Webhook signature**: verify with `stripe.webhooks.constructEvent` using per-org `stripe_webhook_secret`
- **Async processing**: webhook returns 200 immediately; dunning jobs are processed hourly by cron
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
│   ├── actions/             # Server Actions (auth, onboarding, payments, settings)
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
| `/api/webhooks/stripe?org=<slug>` | POST | Stripe signature | Receives Stripe webhook events |
| `/api/cron/process-dunning` | GET | `Bearer CRON_SECRET` | Processes pending dunning jobs |

## Environment Variables

See `.env.example` for the full list. Key variables:
- `DATABASE_URL` — Supabase PostgreSQL connection string
- `STRIPE_SECRET_KEY` — Stripe API key
- `ANTHROPIC_API_KEY` — optional; if missing, AI email generation falls back to static templates
- `CRON_SECRET` — protects the cron endpoint

## Conventions

- **Server Actions**: one file per domain in `src/app/actions/` (auth, onboarding, payments, settings). Always `"use server"` at top. Validate input with Zod.
- **New webhook event**: add a `case` in the `switch` block in `src/app/api/webhooks/stripe/route.ts` and create a `handleX()` function in the same file.
- **UI components**: shadcn/ui primitives in `src/components/ui/`; domain components in `src/components/dashboard/` or `src/components/onboarding/`.
- **Imports**: use `@/` path alias (maps to `src/`).
- **Types**: Drizzle inferred types + shared interfaces in `src/types/index.ts`.
- **No test suite yet**.
