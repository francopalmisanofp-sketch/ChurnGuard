# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ChurnGuard** is a B2B SaaS tool that recovers failed subscription payments for other SaaS companies. It detects failed Stripe charges, runs smart dunning sequences, and sends AI-personalized recovery emails via Claude API.

- **Target customers**: SaaS companies with 100–10,000 subscribers
- **Value proposition**: Recover 20–30% of failed payments; "pay only when it works"
- **Differentiator**: AI-generated recovery emails (Claude API) vs. static templates used by Stunning, Churnbuster, etc.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js App Router (TypeScript) |
| Database + Auth + Queues | Supabase (PostgreSQL + RLS + pgmq) |
| Payments (own billing) | Stripe |
| Email delivery | Resend |
| AI email generation | Anthropic SDK (`claude-sonnet-4-6`) |
| Deployment | Vercel |

## Architecture

```
Customer Stripe → invoice.payment_failed webhook
                          ↓
             /api/webhooks/stripe (verify signature, idempotent)
                          ↓
             failed_payments table (Supabase)
                          ↓
             dunning_jobs queue (Supabase pgmq)
                          ↓
             Job Processor (cron, every hour)
             ├── soft decline → retry + email sequence
             ├── hard decline → skip retry, request new card only
             ├── Generate email via Claude API (personalized)
             └── Send via Resend
                          ↓
             Dashboard: MRR recovered, recovery rate, timeline
```

### Webhook Events to Handle

- `invoice.payment_failed` → trigger Day 0 email, enqueue dunning sequence
- `invoice.payment_succeeded` → cancel active dunning sequence
- `customer.subscription.deleted` → mark hard churn, initiate win-back
- `customer.updated` → update payment method, trigger immediate retry

## Database Schema (Core Tables)

```sql
organizations       -- ChurnGuard customers (SaaS companies)
  id, stripe_account_id, plan, settings

failed_payments     -- subscriber payments in dunning
  id, organization_id, stripe_customer_id, stripe_invoice_id,
  amount, currency, failure_reason,
  decline_type,   -- 'soft' | 'hard' | 'sca_required'
  status,         -- 'pending' | 'in_dunning' | 'recovered' | 'hard_churn'
  created_at, recovered_at

dunning_jobs        -- scheduled retries and emails
  id, failed_payment_id, job_type,  -- 'retry' | 'email'
  scheduled_at, executed_at, result,
  email_subject, email_body_preview

recovery_metrics    -- aggregated for dashboard
  organization_id, period, total_failed,
  total_recovered, recovery_rate, mrr_saved
```

## Key Patterns & Rules

### Stripe Webhooks
- Always verify webhook signature with `stripe.webhooks.constructEvent`
- Respond `200` within 5 seconds; do all processing async via queue
- Check event ID for idempotency before acting (Stripe retries for up to 3 days)

### Dunning Logic
- **Soft declines** (insufficient funds, temporary): retry up to 4x over 10 days (Day 0, 3, 7, 10) + email sequence
- **Hard declines** (stolen card, do-not-honor): never retry; send single email requesting a new payment method
- **Day-of-month retry**: retry on same day-of-month as last successful payment (+15–20% recovery)
- **Email sequence tone**: friendly (Day 0) → helpful (Day 3) → urgency (Day 7) → final warning (Day 10)

### Email Rules
- Plain text emails outperform HTML-heavy for dunning
- One CTA per email: direct link to update card, no login required
- Direct subjects: "Your $49 payment failed" not "Action needed"
- Never expose Resend API key in client-side code; send from API Routes/Server Actions only
- Retry Resend calls with exponential backoff on 429/500

### AI Email Generation (Claude API)
- Input context: customer name, amount, plan name, attempt number, last successful payment date, decline type
- Output: plain text email with single CTA link
- Model: `claude-sonnet-4-6`
- Used for personalization; fall back to static template if API call fails

### Multi-tenancy
- Use Supabase Row Level Security (RLS) on all tables scoped to `organization_id`
- Each ChurnGuard customer connects their own Stripe account via Stripe Connect or webhook secret

## Pricing Model

- **Flat**: $49–99/month (predictable, targets micro-SaaS <500 subs)
- **Percentage**: 5–10% of recovered revenue (risk-free pitch, targets mid-market)
- Offer both at signup; collect data on first 50 customers before standardizing

## Dashboard KPIs (above the fold)

1. MRR recovered this month (absolute $)
2. Recovery rate % (vs. industry benchmark ~50–60% for soft declines)
3. Annual value saved (MRR recovered × 12)

## Development Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build (must pass before commits)
npm run start        # Start production server
npm run lint         # ESLint check
npx drizzle-kit generate   # Generate DB migrations from schema
npx drizzle-kit push       # Push schema directly to DB (development)
npx drizzle-kit migrate    # Apply pending migrations (production)
```

## Project Structure

```
src/
├── app/
│   ├── (auth)/           # Login, signup (public routes)
│   ├── (dashboard)/      # Protected dashboard pages
│   ├── actions/          # Server Actions (auth, onboarding, payments, settings)
│   ├── api/
│   │   ├── webhooks/stripe/  # Stripe webhook endpoint (POST)
│   │   └── cron/process-dunning/  # Hourly cron job (GET, requires CRON_SECRET)
│   └── auth/callback/    # Supabase auth callback
├── components/
│   ├── dashboard/        # KPI cards, payments table, timeline, sidebar, header
│   ├── onboarding/       # 3-step setup wizard
│   └── ui/               # shadcn/ui primitives
├── db/
│   ├── schema.ts         # Drizzle ORM schema (6 tables + enums + relations)
│   └── index.ts          # Lazy DB connection via Proxy
├── lib/
│   ├── supabase/         # Browser, server, and admin (service role) clients
│   ├── stripe/           # Lazy Stripe client + decline classifier
│   ├── dunning/          # Scheduler (job creation) + processor (job execution)
│   ├── email/            # AI generator (Claude API), Resend sender, static templates
│   ├── metrics/          # Recovery metrics aggregation
│   └── auth.ts           # requireAuth(), getOrganization(), getAuthAndOrg()
├── middleware.ts          # Route protection (dashboard/* requires auth)
└── types/index.ts         # Drizzle inferred types + shared interfaces
```

## Key API Routes

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/webhooks/stripe?org=<slug>` | POST | Stripe signature | Receives Stripe webhook events |
| `/api/cron/process-dunning` | GET | `Bearer CRON_SECRET` | Processes pending dunning jobs |

## Environment Variables

See `.env.example` for the full list. Key variables:
- `DATABASE_URL` — Supabase PostgreSQL connection string (lazy loaded)
- `STRIPE_SECRET_KEY` — Stripe API key (lazy loaded via Proxy)
- `ANTHROPIC_API_KEY` — Optional; if missing, AI generation falls back to static templates
- `CRON_SECRET` — Protects the cron endpoint from unauthorized calls

## Reference Files

- `research-churnguard-failed-payment-recovery.md` — full market research, competitor analysis, architecture trade-offs, and implementation roadmap
- `PRD_ChurnGuard.md` — complete product requirements document with features, schema, user journeys, and roadmap
