# Documento di Architettura Software
# ChurnGuard — MVP to Production-Ready

**Versione:** 1.0
**Data:** 2026-03-04
**Stato:** Approvato
**Autore:** Tech Lead Agent
**Riferimenti:**
- Requisiti BA: `docs/requirements/README.md` (v2.0)
- Schema JSON requisiti: `docs/requirements/requirements.json`
- Epic GitHub: #2

---

## Indice

1. [Executive Summary](#1-executive-summary)
2. [Contesto e principi guida](#2-contesto-e-principi-guida)
3. [Stack tecnologico](#3-stack-tecnologico)
4. [Architettura applicativa](#4-architettura-applicativa)
5. [Modello dati aggiornato](#5-modello-dati-aggiornato)
6. [Flussi principali](#6-flussi-principali)
7. [Sicurezza](#7-sicurezza)
8. [Integrazioni](#8-integrazioni)
9. [Requisiti non funzionali e strategie](#9-requisiti-non-funzionali-e-strategie)
10. [Piano operativo](#10-piano-operativo)
11. [Decisioni architetturali (ADR)](#11-decisioni-architetturali-adr)
12. [Rischi e mitigazioni](#12-rischi-e-mitigazioni)
13. [Changelog](#13-changelog)

---

## 1. Executive Summary

ChurnGuard è un MVP funzionante che recupera pagamenti Stripe falliti tramite sequenze di dunning automatizzate con email AI-personalizzate. Il core engine opera correttamente ma presenta tre gap critici per il passaggio a production:

1. **Affidabilità engine:** job falliti muoiono silenziosamente, race condition nel cron, nessun retry automatico
2. **Sicurezza subscriber:** il link nelle email espone l'ID interno del pagamento, nessuna scadenza
3. **Monetizzazione:** i piani Starter/Growth sono hardcoded, nessun billing reale operativo

Questo documento descrive l'architettura del sistema dopo le 21 modifiche pianificate (12 Must, 6 Should, 3 Could), con enfasi sulle decisioni tecniche e le loro motivazioni.

**Pattern architetturale:** Monolite modulare (Next.js App Router) — invariato rispetto all'MVP.
**Approccio:** Delivery-oriented. Nessuna riscrittura, solo estensioni mirate al codebase esistente.

---

## 2. Contesto e principi guida

### 2.1 Vincoli di progetto

| Vincolo | Dettaglio |
|---------|-----------|
| Framework | Next.js App Router (TypeScript) — invariato |
| Database | Supabase (PostgreSQL + RLS + Realtime) — invariato |
| ORM | Drizzle ORM — tutte le nuove tabelle usano schema Drizzle |
| Pagamenti | Stripe — nessun altro gateway in scope |
| Email | Resend — invariato |
| AI | Anthropic SDK `claude-sonnet-4-6` — invariato, con fallback template |
| Deployment | Vercel — cron via Vercel Cron Jobs |
| Rate limiting | Vercel KV — da aggiungere |
| Grafici | Recharts — preferito nei vincoli |
| Testing | Vitest — preferito nei vincoli |
| Upload logo | Supabase Storage |
| Payment Element | @stripe/react-stripe-js |

### 2.2 Principi guida

1. **No riscritture:** estendere il codebase esistente, non rimpiazzarlo
2. **Fail open su dipendenze esterne:** se Vercel KV o servizi esterni falliscono, il flusso core (webhook/cron) continua
3. **Idempotenza ovunque:** ogni operazione di scrittura deve essere sicura da eseguire più volte
4. **Sicurezza multi-tenant a livello DB:** RLS Supabase, non solo logica applicativa
5. **Separazione di responsabilità:** un endpoint per i webhook dei clienti, uno separato per il billing ChurnGuard

---

## 3. Stack tecnologico

### 3.1 Stack completo (MVP + aggiunte)

| Layer | Tecnologia | Versione | Stato |
|-------|------------|----------|-------|
| Framework | Next.js App Router | 15.x | Esistente |
| Linguaggio | TypeScript | 5.x | Esistente |
| Database | Supabase (PostgreSQL 15) | — | Esistente |
| ORM | Drizzle ORM | — | Esistente |
| Auth | Supabase Auth | — | Esistente |
| Realtime | Supabase Realtime | — | **Da attivare** |
| Storage | Supabase Storage | — | **Da configurare** |
| Pagamenti clienti | Stripe (per-org webhook) | v20 | Esistente |
| Pagamenti interni | Stripe (ChurnGuard billing) | v20 | **Da implementare** |
| Payment Element | @stripe/react-stripe-js | — | **Da aggiungere** |
| Email | Resend | — | Esistente |
| AI email | Anthropic SDK (claude-sonnet-4-6) | — | Esistente |
| Deployment | Vercel | — | Esistente |
| Cron | Vercel Cron Jobs | — | Esistente |
| Rate limiting | Vercel KV | — | **Da aggiungere** |
| Grafici | Recharts | — | **Da aggiungere** |
| Testing | Vitest + @vitest/coverage-v8 | — | **Da aggiungere** |
| UI components | shadcn/ui + Tailwind CSS | — | Esistente |

### 3.2 Nuove variabili d'ambiente

```bash
# Stripe billing ChurnGuard
STRIPE_CHURNGUARD_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_GROWTH_PRICE_ID=price_...

# Stripe Payment Element (pubblico)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...

# Vercel KV (rate limiting)
KV_URL=...
KV_REST_API_URL=...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
```

---

## 4. Architettura applicativa

### 4.1 Diagramma di contesto

```
SUBSCRIBER (utente finale della SaaS cliente)
    |
    | HTTPS — nessuna auth
    v
/update-payment/[token]
    ├── Server: valida token, restituisce branding + importo
    ├── Client: Stripe Payment Element (iframe PCI-DSS)
    └── Server Action: conferma carta, ritenta invoice


OWNER / ADMIN / VIEWER (utenti ChurnGuard)
    |
    | HTTPS — Supabase Auth (JWT)
    v
/dashboard/* (Next.js App Router — protected)
    ├── Server Components: dati da Supabase (service role)
    ├── Client Components: Recharts, Supabase Realtime
    └── Server Actions: settings, billing, team management


STRIPE (piattaforma cliente)
    |
    | POST — Stripe signature per-org
    v
/api/webhooks/stripe?org=<slug>
    ├── Vercel KV: rate limit (1000 req/min per slug)
    ├── Verifica firma webhook per-org
    ├── Idempotenza via webhook_events
    ├── Verifica limite piano Starter (500 failed/mese)
    └── Handlers: payment_failed | payment_succeeded | subscription_deleted


STRIPE (billing ChurnGuard)
    |
    | POST — Stripe signature globale ChurnGuard
    v
/api/webhooks/stripe-churnguard   [NUOVO]
    └── Handlers: checkout.completed | subscription.updated | invoice.payment_failed


VERCEL CRON (ogni ora)
    |
    v
/api/cron/process-dunning
    ├── Acquisizione atomica job: UPDATE ... SKIP LOCKED
    ├── Gate piano: skip org con plan_status bloccato
    ├── processEmailJob → AI email (fallback: template) → Resend
    ├── processRetryJob → stripe.invoices.pay()
    ├── handleJobFailure → retry backoff (1h/4h/24h) o alert definitivo
    └── refreshMetrics → recovery_metrics aggiornate
```

### 4.2 Struttura directory aggiornata

```
src/
├── app/
│   ├── (auth)/                    # Login, signup (public) — invariato
│   ├── (dashboard)/               # Protected dashboard — esteso
│   ├── actions/
│   │   ├── auth.ts                # Esistente
│   │   ├── onboarding.ts          # Esteso (trial, step piano)
│   │   ├── payments.ts            # Esistente
│   │   ├── settings.ts            # Esteso (logo, brand color)
│   │   ├── billing.ts             # NUOVO: startCheckout, openCustomerPortal
│   │   ├── team.ts                # NUOVO: inviteMember, revokeMember, changeRole
│   │   ├── notifications.ts       # NUOVO: getUnreadCount, markAsRead
│   │   └── update-payment.ts      # NUOVO: getPaymentDetails, createSetupIntent, confirmAndRetryInvoice
│   ├── api/
│   │   ├── webhooks/
│   │   │   ├── stripe/            # Webhook per-org clienti — esteso
│   │   │   └── stripe-churnguard/ # NUOVO: billing interno ChurnGuard
│   │   └── cron/process-dunning/  # Refactored: SKIP LOCKED + retry backoff
│   ├── auth/callback/             # Invariato
│   └── update-payment/[token]/    # NUOVO: pagina pubblica subscriber
│       └── success/
├── components/
│   ├── dashboard/
│   │   ├── MrrTrendChart.tsx      # NUOVO: Recharts
│   │   ├── DeclineBreakdownTable.tsx # NUOVO
│   │   ├── NotificationBell.tsx   # NUOVO: Supabase Realtime
│   │   ├── NotificationPanel.tsx  # NUOVO
│   │   ├── TeamSection.tsx        # NUOVO
│   │   ├── MembersList.tsx        # NUOVO
│   │   ├── InviteMemberForm.tsx   # NUOVO
│   │   ├── PendingInvitations.tsx # NUOVO
│   │   └── [esistenti]            # KPI cards, payments table, sidebar, header
│   ├── onboarding/
│   │   └── [PlanStep aggiunto]    # Step 4 wizard
│   └── ui/                        # shadcn/ui — invariato
├── db/
│   └── schema.ts                  # AGGIORNATO: nuove tabelle e colonne
├── lib/
│   ├── supabase/                  # Invariato
│   ├── stripe/
│   │   ├── client.ts              # Invariato
│   │   ├── decline-classifier.ts  # Invariato
│   │   └── churnguard-billing.ts  # NUOVO: createCheckoutSession, createPortalSession
│   ├── dunning/
│   │   ├── scheduler.ts           # Invariato
│   │   └── processor.ts           # REFACTORED: SKIP LOCKED, retry backoff, plan gate
│   ├── email/                     # Invariato (generator, sender, templates)
│   ├── tokens/
│   │   └── payment-tokens.ts      # NUOVO: createPaymentToken, validatePaymentToken
│   ├── metrics/                   # Invariato
│   ├── rate-limit.ts              # NUOVO: Vercel KV sliding window
│   └── auth.ts                    # Invariato
├── middleware.ts                   # AGGIORNATO: verifica plan_status
└── types/index.ts                  # AGGIORNATO: nuovi tipi
```

---

## 5. Modello dati aggiornato

### 5.1 Tabelle modificate

#### `dunning_jobs` — aggiunta colonna

```sql
ALTER TABLE dunning_jobs
  ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL;
```

Drizzle: aggiungere `retryCount: integer("retry_count").default(0).notNull()`

#### `organizations` — aggiunte colonne

```sql
ALTER TABLE organizations
  ADD COLUMN logo_url TEXT,
  ADD COLUMN brand_color TEXT DEFAULT '#000000',
  ADD COLUMN stripe_customer_id_churnguard TEXT,
  ADD COLUMN stripe_subscription_id_churnguard TEXT,
  ADD COLUMN plan_status TEXT DEFAULT 'trialing' NOT NULL
    CHECK (plan_status IN ('active', 'past_due', 'canceled', 'trialing')),
  ADD COLUMN plan_expires_at TIMESTAMPTZ;
```

### 5.2 Nuove tabelle

#### `payment_tokens` (FR-005)

```sql
CREATE TABLE payment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  failed_payment_id UUID NOT NULL REFERENCES failed_payments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX token_lookup_idx ON payment_tokens(token);
```

**Scadenza:** 30 giorni dalla creazione.
**Invalidazione:** `used_at` viene impostato dopo pagamento riuscito. Il token rimane valido per errori di sistema (il subscriber può riprovare).

#### `notifications` (FR-003)

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('job_failed', 'payment_recovered', 'plan_past_due', 'plan_expiring')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN DEFAULT false NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX notifications_org_unread_idx
  ON notifications(organization_id, read, created_at DESC);
```

**Metadata per tipo:**
- `job_failed`: `{ job_id, payment_id, error }`
- `payment_recovered`: `{ payment_id, amount, currency }`
- `plan_past_due` / `plan_expiring`: `{ plan, expires_at }`

#### `invitations` (FR-015)

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_role NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX invitation_token_idx ON invitations(token);
```

**Scadenza invito:** 7 giorni dalla creazione.

### 5.3 Schema completo (9 tabelle)

```
organizations ──< organization_members
      |
      ├──< failed_payments ──< dunning_jobs
      |         |
      |         └──< payment_tokens
      |
      ├──< recovery_metrics
      ├──< webhook_events
      ├──< notifications
      └──< invitations
```

### 5.4 Migrazioni necessarie (ordine di esecuzione)

1. `add_retry_count_to_dunning_jobs.sql`
2. `add_branding_and_billing_to_organizations.sql`
3. `create_payment_tokens.sql`
4. `create_notifications.sql`
5. `create_invitations.sql`
6. `add_rls_policies.sql`

---

## 6. Flussi principali

### 6.1 Flusso: pagamento fallito → email Day 0 immediata

```
[Stripe] invoice.payment_failed
    │
    ▼
POST /api/webhooks/stripe?org=<slug>
    │
    ├─ [1] Vercel KV: rate limit check (fail open)
    ├─ [2] Verifica firma Stripe per-org
    ├─ [3] Check idempotenza (webhook_events)
    ├─ [4] Verifica limite piano Starter (500/mese)
    │       └─ Se limite raggiunto: 200 + notifica, STOP
    │
    ├─ [5] Crea failed_payment
    ├─ [6] scheduleDunningJobs() → crea 5 job (soft) / 1 (hard) / 2 (SCA)
    │
    ├─ [7] Esegue job Day 0 (email) in modo sincrono:
    │       ├─ generateDunningEmail() → Claude API (fallback: template)
    │       ├─ createPaymentToken() → inserisce in payment_tokens
    │       ├─ sendEmail() → Resend
    │       ├─ Marca job Day 0 come 'done'
    │       └─ Se fallisce: job rimane 'pending', cron lo riprende (fallback)
    │
    └─ [8] Risponde 200 a Stripe
```

**Latenza:** < 10 secondi totali, < 5 minuti dall'evento (NFR-003 soddisfatto).

### 6.2 Flusso: cron orario — processing job

```
GET /api/cron/process-dunning (ogni ora, auth: CRON_SECRET)
    │
    ├─ [1] Acquisizione atomica job:
    │       UPDATE dunning_jobs SET status='executing'
    │       WHERE id IN (
    │         SELECT id FROM dunning_jobs
    │         WHERE status='pending' AND scheduled_at <= NOW()
    │         ORDER BY scheduled_at ASC
    │         LIMIT 100
    │         FOR UPDATE SKIP LOCKED  ← previene doppia esecuzione
    │       ) RETURNING *
    │
    ├─ [2] Per ogni job — verifica plan_status dell'org:
    │       active → processa
    │       trialing (non scaduto) → processa
    │       past_due + dentro grace period (7gg) → processa
    │       past_due + fuori grace period → SKIP
    │       canceled → SKIP
    │
    ├─ [3] processEmailJob():
    │       ├─ generateDunningEmail() → AI o template
    │       ├─ createPaymentToken() → token per URL
    │       ├─ sendEmail() → Resend
    │       ├─ Successo: status='done', dunningStep++
    │       └─ Fallimento:
    │           retry_count < 3 → retry_count++, scheduled_at = now + backoff, status='pending'
    │           retry_count = 3 → status='failed', alert email + notifica in-app
    │
    ├─ [4] processRetryJob():
    │       ├─ stripe.invoices.pay(invoiceId)
    │       ├─ Pagato: cancella job pending, status='recovered', notifica payment_recovered
    │       └─ Fallisce: stesso retry backoff di sopra
    │
    └─ [5] refreshMetrics() → aggiorna recovery_metrics per ogni org
```

**Protezione race condition:** `SKIP LOCKED` garantisce che job già acquisiti da un'istanza non vengano processati da un'altra istanza concorrente.

### 6.3 Flusso: subscriber aggiorna carta

```
[Email subscriber] click link → /update-payment/[token]
    │
    ├─ [1] Server Component: getPaymentDetails(token)
    │       ├─ Token invalido/scaduto → render "Link scaduto"
    │       └─ Token valido → render pagina con branding + importo
    │
    ├─ [2] Client Component monta Stripe Payment Element:
    │       createSetupIntent(token) → stripe.setupIntents.create()
    │       → clientSecret → <Elements stripePromise clientSecret>
    │
    ├─ [3] Subscriber inserisce carta e conferma
    │
    ├─ [4] stripe.confirmSetup() → SetupIntent completed
    │
    ├─ [5] confirmAndRetryInvoice(token, setupIntentId):
    │       ├─ Aggiorna default_payment_method del customer
    │       ├─ stripe.invoices.pay(invoiceId)
    │       ├─ Successo: cancella job, recovered, invalidatePaymentToken()
    │       ├─ Carta rifiutata: errore inline, token valido (riprova)
    │       └─ Errore sistema: log, token valido, messaggio generico
    │
    └─ [6] Redirect a /update-payment/[token]/success
```

### 6.4 Flusso: billing ChurnGuard — attivazione piano

```
[Owner] click "Inizia con Starter" nell'onboarding
    │
    ├─ [1] Server Action startCheckout('starter')
    │       → stripe.checkout.sessions.create({ price: STARTER_PRICE_ID, metadata: { org_id } })
    │       → redirect a URL Stripe Checkout
    │
    ├─ [2] Stripe Checkout completato
    │       → POST /api/webhooks/stripe-churnguard
    │         checkout.session.completed handler:
    │           aggiorna: plan='starter', plan_status='active',
    │                    stripe_customer_id_churnguard, stripe_subscription_id_churnguard,
    │                    plan_expires_at, onboarding_completed=true
    │
    └─ [3] Redirect a /dashboard (success_url del checkout)
```

---

## 7. Sicurezza

### 7.1 Multi-tenancy: Row Level Security

Tutte le 9 tabelle hanno RLS attiva. Le policy seguono il pattern:

```sql
-- Esempio: failed_payments
CREATE POLICY "org_isolation" ON failed_payments
  FOR ALL
  USING (organization_id = get_user_organization_id());

-- Helper con SECURITY DEFINER (evita lookup ricorsivi)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT organization_id
  FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
```

Service role (usato da cron e webhook via admin client Supabase) bypassa RLS.

### 7.2 Token update-payment

- **Formato:** UUID v4 generato con `crypto.randomUUID()` — 128 bit di entropia
- **Scadenza:** 30 giorni dalla creazione
- **Opacità:** il token non contiene né deriva dall'ID interno del pagamento
- **Invalidazione:** `used_at` impostato dopo pagamento riuscito
- **RLS:** tabella `payment_tokens` accessibile solo da service role (scrittura) e query pubblica validata server-side

### 7.3 Webhook security

**Clienti:** firma Stripe per-org (`stripe_webhook_secret` in `organizations`). Ogni cliente ha la propria chiave.
**ChurnGuard billing:** firma Stripe globale (`STRIPE_CHURNGUARD_WEBHOOK_SECRET`). Un solo segreto.

### 7.4 Autorizzazione RBAC

| Operazione | Owner | Admin | Viewer |
|-----------|-------|-------|--------|
| Dashboard (read) | ✓ | ✓ | ✓ |
| Settings org | ✓ | ✓ | ✗ |
| Settings billing | ✓ | ✗ | ✗ |
| Invita membri | ✓ | ✗ | ✗ |
| Revoca/cambia ruolo | ✓ | ✗ | ✗ |
| Vedi lista membri | ✓ | ✓ | ✗ |
| Upload logo | ✓ | ✓ | ✗ |

### 7.5 Rate limiting webhook

Algoritmo sliding window su Vercel KV:
- **Finestra minuto:** 1.000 req/min per slug
- **Finestra ora:** 10.000 req/ora per slug
- **Comportamento oltre soglia:** HTTP 429 con header `Retry-After`
- **Fail open:** se KV irraggiungibile, webhook processato con log warning

---

## 8. Integrazioni

### 8.1 Stripe — webhook clienti

| Campo | Valore |
|-------|--------|
| Endpoint | `/api/webhooks/stripe?org=<slug>` |
| Autenticazione | Firma HMAC-SHA256 per-org |
| Eventi | `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted` |
| Direzione | Stripe → ChurnGuard (inbound) |
| Idempotenza | `webhook_events.stripe_event_id` (unique index) |
| Timeout Vercel | 30 secondi (`maxDuration = 30`) |
| Retry Stripe | Se risposta non 2xx, Stripe riprova con backoff — gestito dall'idempotenza |

### 8.2 Stripe — billing ChurnGuard

| Campo | Valore |
|-------|--------|
| Endpoint | `/api/webhooks/stripe-churnguard` |
| Autenticazione | Firma HMAC-SHA256 globale (`STRIPE_CHURNGUARD_WEBHOOK_SECRET`) |
| Eventi | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded` |
| Direzione | Stripe → ChurnGuard (inbound) |

### 8.3 Stripe — Payment Element (subscriber)

| Campo | Valore |
|-------|--------|
| Componente | `@stripe/react-stripe-js` (`<Elements>`, `<PaymentElement>`) |
| Tipo Intent | SetupIntent (aggiornamento carta) |
| PCI compliance | Stripe iframe gestisce tutti i dati carta — ChurnGuard non tocca numeri di carta |
| 3DS/SCA | Gestito automaticamente dal Payment Element |

### 8.4 Resend — email dunning e inviti

| Campo | Valore |
|-------|--------|
| Uso | Email dunning subscriber, email invito team, alert interni |
| From address | `noreply@${org.resendDomain}` o `noreply@churnguard.com` |
| Alert interni | `alerts@churnguard.com` al 4° fallimento job |

### 8.5 Supabase Realtime — notifiche

| Campo | Valore |
|-------|--------|
| Canale | `postgres_changes` su tabella `notifications` |
| Filter | `organization_id=eq.${orgId}` |
| Trigger | INSERT di nuovo record in `notifications` |
| Latenza attesa | < 5 secondi dall'INSERT |
| Fallback | Polling ogni 60 secondi se Realtime non disponibile |

### 8.6 Supabase Storage — logo clienti

| Campo | Valore |
|-------|--------|
| Bucket | `logos` |
| Visibilità | Pubblica in lettura (URL accessibile senza auth dalla pagina update-payment) |
| Formato | `${org.id}/${timestamp}-logo.{ext}` |
| Tipi accettati | PNG, JPG, SVG |
| Dimensione max | 2MB |

---

## 9. Requisiti non funzionali e strategie

| NFR | Target | Strategia di implementazione |
|-----|--------|------------------------------|
| NFR-001 — Webhook response | < 200ms (p99) | Risponde 200 prima di processare; processing asincrono nel cron |
| NFR-002 — Dashboard load | < 2s (LCP p95 su LTE) | Server Components, query ottimizzate, recovery_metrics pre-aggregato (FR-021) |
| NFR-003 — Email Day 0 | < 5 min dal fallimento | ADR-002: Day 0 eseguita sincrona nel webhook handler |
| NFR-004 — Zero job persi | 0 job failed definitivi per errori recuperabili | Retry backoff 1h/4h/24h (FR-001) |
| NFR-005 — Idempotenza webhook | 0 duplicati per stesso stripe_event_id | Unique index su `webhook_events.stripe_event_id` — già implementato |
| NFR-006 — Isolamento multi-tenant | 0 data leak tra org | RLS Supabase su tutte le 9 tabelle (FR-012) |
| NFR-007 — Token opachi | UUID v4, scadenza 30gg, 0 esposizione ID interno | Sistema payment_tokens (FR-005, BE-004) |
| NFR-008 — Rate limiting | 1000 req/min per org | Vercel KV sliding window (FR-013, BE-010) |
| NFR-009 — Segreti nei log | 0 occorrenze | Convenzione esistente; verificare con audit tool |
| NFR-010 — Scalabilità | 500 org, 250k failed_payments | Index query, recovery_metrics aggregato, RLS con index |
| NFR-011 — GDPR | Dati subscriber solo per dunning | DPA da predisporre (fuori scope tecnico) |
| NFR-012 — Onboarding | < 10 minuti | Wizard 4 step, trial senza checkout obbligatorio |

---

## 10. Piano operativo

### 10.1 Macro-fasi e milestone

| ID | Milestone | Descrizione | Issue |
|----|-----------|-------------|-------|
| M1 | Fondamenta DB e Sicurezza | Schema migrato, RLS attiva, token system | #3 |
| M2 | Dunning Engine Hardening | SKIP LOCKED, retry backoff, plan gate, Day 0 immediata | #4, #5 |
| M3 | Subscriber Experience | Token sicuri, update-payment page, branding | #6, #7, #8, #14 |
| M4 | Billing Operativo | Piani reali, onboarding step, Customer Portal | #9, #10, #18 |
| M5 | Dashboard e Settings | Grafici, notifiche realtime, settings avanzate, team | #11–#17, #19 |
| M6 | Production-Ready | Test, rate limiting, hardening finale | #12, #13 |

### 10.2 Grafo delle dipendenze

```
M1 (BE-001 #3)
  ├──▶ M2 (BE-002 #4, BE-003 #5)
  │         └──▶ M3 (BE-004 #6, BE-005 #7, BE-006 #8, FE-001 #14)
  │                   └──▶ M5 (BE-009 #11, FE-002 #15, FE-003 #16,
  │                             FE-004 #17, FE-006 #19)
  │                               └──▶ M6 (BE-010 #12, BE-011 #13)
  └──▶ M4 (BE-007 #9, BE-008 #10, FE-005 #18)
             └──▶ M5
```

### 10.3 Mappa issue completa

```
Epic:   #2  — [EPIC] ChurnGuard — MVP to Production-Ready

Backend:
  #3   BE-001 — Migrazioni schema e RLS Supabase          (M1)
  #4   BE-002 — Dunning processor hardening               (M2)
  #5   BE-003 — Email Day 0 immediata webhook handler     (M2)
  #6   BE-004 — Sistema token sicuri update-payment       (M3)
  #7   BE-005 — Update-payment Server Actions backend     (M3)
  #8   BE-006 — Branding: upload logo e brand color       (M3)
  #9   BE-007 — Billing ChurnGuard: Stripe Checkout       (M4)
  #10  BE-008 — Onboarding step piano + gate middleware   (M4)
  #11  BE-009 — Team management: inviti e revoca          (M5)
  #12  BE-010 — Rate limiting webhook Vercel KV           (M6)
  #13  BE-011 — Unit test e integration test Vitest       (M6)

Frontend:
  #14  FE-001 — Pagina pubblica /update-payment/[token]   (M3)
  #15  FE-002 — Dashboard: grafico MRR e breakdown        (M5)
  #16  FE-003 — Notifiche realtime e badge sidebar        (M5)
  #17  FE-004 — Settings page: dati reali, branding       (M5)
  #18  FE-005 — Onboarding: step selezione piano          (M4)
  #19  FE-006 — Team management UI                        (M5)
```

---

## 11. Decisioni architetturali (ADR)

### ADR-001 — SKIP LOCKED per acquisizione job atomica

**Stato:** Approvata
**Contesto:** Il cron processor in MVP usa SELECT + UPDATE separati per acquisire i job. Se due istanze Vercel eseguono il cron in contemporanea (edge case possibile), entrambe leggono gli stessi job e li processano due volte (doppio invio email, doppio retry Stripe).
**Decisione:** Usare `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *` per acquisire job in modo atomico. `SKIP LOCKED` fa sì che istanze concorrenti saltino i job già acquisiti invece di aspettare il lock.
**Alternative considerate:**
- `SELECT FOR UPDATE`: aspetta il lock → possibili deadlock, nessuna garanzia su ordering
- Advisory lock globale `pg_try_advisory_lock()`: blocca l'intero cron, non solo i job — troppo aggressivo
- Idempotency key per job: richiede logica applicativa aggiuntiva
**Conseguenze:** Refactor chirurgico del processor. La logica di business invariata. Drizzle ORM supporta `.for('update', { skipLocked: true })`.

---

### ADR-002 — Email Day 0 sincrona nel webhook handler

**Stato:** Approvata
**Contesto:** NFR-003 richiede email Day 0 entro 5 minuti. Il cron orario non garantisce questo. Opzioni: (A) cron ogni 5 minuti, (B) Day 0 sincrona nel webhook, (C) queue separata.
**Decisione:** Opzione B — eseguire il job Day 0 direttamente nel webhook handler `handlePaymentFailed()`, in modo sincrono, prima della risposta 200 a Stripe. Il webhook ha `maxDuration = 30s` (Vercel), sufficiente per Claude API + Resend (tipicamente 3-8s). Se fallisce, il job rimane `pending` per il cron (fallback automatico).
**Alternative considerate:**
- Cron ogni 5 minuti: aumenta costo Vercel, complica monitoring, non serve per job Day 3/7/10
- Supabase pg_cron o pgmq: infrastruttura aggiuntiva, complessità non giustificata per ora
**Conseguenze:** Piccola modifica al webhook handler. I job Day 3/7/10 continuano sul cron orario.

---

### ADR-003 — Endpoint separato per billing interno ChurnGuard

**Stato:** Approvata
**Contesto:** Gli eventi Stripe per il billing ChurnGuard (checkout, subscription aggiornata) non sono associati a nessuna org-cliente specifica. Non possono arrivare all'endpoint `?org=<slug>`.
**Decisione:** Nuovo endpoint `/api/webhooks/stripe-churnguard` con firma webhook separata (`STRIPE_CHURNGUARD_WEBHOOK_SECRET`). Logica e responsabilità completamente separate dall'endpoint webhook clienti.
**Alternative considerate:**
- Stesso endpoint con discriminazione: aumenta complessità, mixing di responsabilità
- Supabase Edge Function: infrastruttura aggiuntiva senza beneficio
**Conseguenze:** Una nuova route API. Due webhook separati in Stripe Dashboard.

---

### ADR-004 — Tabella `invitations` per team management

**Stato:** Approvata
**Contesto:** FR-015 richiede inviti via email con associazione all'org al momento del login. Supabase Auth magic link può portare metadata ma non in modo affidabile per il flusso di signup (nuovo utente senza account).
**Decisione:** Tabella `invitations` con token UUID, email, organization_id, role, expires_at. Il callback Auth legge il token (passato come query param) e crea il record `organization_members`.
**Alternative considerate:**
- Metadata nel JWT Supabase: non persistente per nuovi utenti, perso al signup
- OTP Supabase con metadata: non supportato per signup email arbitrarie
**Conseguenze:** Tabella aggiuntiva `invitations` (già in BE-001). Callback `/accept-invitation` route pubblica.

---

### ADR-005 — Trial 14 giorni con limite 10 failed_payments

**Stato:** Approvata (decisione Founder richiesta per conferma)
**Contesto:** FR-020 richiede trial prima del piano pagante. La durata non era specificata nei requisiti.
**Decisione:** 14 giorni di trial con limite di 10 `failed_payments` processabili. Segue la logica grace period di FR-008 alla scadenza (7 giorni `past_due`, poi blocco).
**Motivazione:** 14 giorni è lo standard industria B2B SaaS. Il limite di 10 failed_payments previene abuso del trial per processare volumi reali gratuitamente.
**Conseguenze:** Logica trial nel cron e nel middleware. Contatore mensile anche per trial.

---

### ADR-006 — Hard limit 500 failed_payments/mese per piano Starter

**Stato:** Approvata (decisione Founder richiesta per conferma)
**Contesto:** Il BA aveva lasciato aperto se il limite Starter dovesse essere enforced o solo warning.
**Decisione:** Hard limit enforced nel webhook handler `handlePaymentFailed()`. Warning in-app all'80% (400 failed_payments), blocco al 100% (500). Il webhook risponde 200 a Stripe anche al blocco (non causare retry Stripe).
**Motivazione:** Prevedibilità dei costi operativi (Claude API + Resend). Il cliente è avvisato in anticipo tramite badge nel dashboard.
**Conseguenze:** Conteggio mensile nel webhook handler. Notifiche in-app aggiuntive.

---

## 12. Rischi e mitigazioni

| ID | Rischio | Probabilità | Impatto | Mitigazione | Owner |
|----|---------|-------------|---------|-------------|-------|
| R-001 | Race condition cron doppia esecuzione | Bassa | Alto | ADR-001: SKIP LOCKED (BE-002) | Dev |
| R-002 | NFR-003 violato (email Day 0 > 5 min) | Alta (senza fix) | Alto | ADR-002: Day 0 sincrona in webhook (BE-003) | Dev |
| R-003 | Stripe Payment Element: SCA/3DS non gestito | Media | Alto | Usare SetupIntent con `off_session`; testare carte test SCA Stripe | Dev |
| R-004 | Supabase Realtime: limite connessioni su piano Free | Media | Medio | Verificare piano prima di implementare FE-003; fallback polling 60s | Founder |
| R-005 | Vercel KV latenza > 10ms aggiunta al webhook | Bassa | Medio | Fail open; misurare con Vercel Analytics in staging | Dev |
| R-006 | Stripe Customer Portal non configurato prima del go-live | Media | Medio | Configurare e testare in staging durante M4 | Founder |
| R-007 | Invito team: email già membro di altra org | Media | Basso | Un utente Supabase Auth può essere in più org; gestire nel callback | Dev |
| R-008 | RLS impatta performance query dashboard | Bassa | Medio | EXPLAIN ANALYZE verificato in BE-001; indici su `organization_id` già presenti | Dev |
| R-009 | Piano scaduto blocca org senza notifica al cliente | Media | Alto | Notifiche a 7gg, 3gg, 1gg dalla scadenza (FR-008) | Dev |
| R-010 | `maxDuration = 30s` insufficiente per Day 0 sincrona | Bassa | Medio | Timeout Claude API impostato a 10s; fallback template se timeout | Dev |

---

## 13. Changelog

| Versione | Data | Autore | Modifiche |
|----------|------|--------|-----------|
| 1.0 | 2026-03-04 | Tech Lead Agent | Prima versione — architettura production-ready completa |
