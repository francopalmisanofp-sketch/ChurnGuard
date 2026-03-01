# PRD — ChurnGuard
**Versione:** 1.0 | **Data:** 2026-03-01 | **Stato:** Draft

---

## 1. Vision e Obiettivi

**Tagline:** _"Recover failed payments on autopilot — pay only when it works."_

**Vision:** ChurnGuard diventa il layer di difesa contro l'involuntary churn per ogni SaaS su Stripe — una connessione da 5 minuti che recupera silenziosamente il 20-30% dei pagamenti falliti ogni mese, senza che il team del cliente debba fare nulla.

**Obiettivi MVP (6 mesi):**
- Recuperare ≥20% dei pagamenti falliti per ogni cliente attivo
- Raggiungere 50 clienti paganti entro il mese 6
- Churn mensile ChurnGuard stesso <5% (dimostrazione del prodotto sulla propria skin)
- MRR ChurnGuard: $5K–15K entro il mese 6

---

## 2. Target Utente

### Utente Primario: Il Founder/CTO di una SaaS B2B

| Attributo | Dettaglio |
|-----------|-----------|
| **Chi** | Founder, CTO, o Head of Growth di SaaS B2B |
| **Dimensione** | 100–10.000 subscriber attivi su Stripe |
| **MRR** | $5K–$200K MRR |
| **Stack** | Stripe Billing (subscriptions), qualsiasi backend |
| **Pain** | Sa che ha pagamenti falliti ogni mese ma non ha tempo/risorse per gestirli |
| **Awareness** | Conosce il problema ma non ha mai calcolato quanto MRR perde davvero |
| **Budget** | $50–$200/mese o % del recovered come alternativa a costo zero |

### Utente Secondario: Finance/Operations Manager

Accede al dashboard per monitorare i KPI di recovery e giustificare il ROI ai founder.

### Mercato Totale

- $129 miliardi di subscription revenue a rischio per pagamenti falliti nel 2025 (fonte: Recurly/Slicker)
- Churn involontario = 20-40% del churn totale SaaS
- TAM: migliaia di SaaS su Stripe nel range 100-10K subscriber

---

## 3. Problema e Soluzione

### Il Problema

Ogni SaaS su Stripe ha un ciclo di vita ricorrente: ogni mese, una quota di pagamenti fallisce (carta scaduta, fondi insufficienti, limite raggiunto). Stripe riprova automaticamente, ma:

1. Le email di Stripe sono generiche e non brandizzate → basso tasso di aggiornamento carta
2. I retry di Stripe non distinguono hard vs. soft decline ottimalmente per il segmento specifico
3. Il founder non ha visibilità in tempo reale su quanti $$ sta perdendo
4. Non esiste un workflow per catturare i "quasi recovered" — chi aggiorna la carta ma il retry manca il timing

**Risultato:** il 70-80% di chi avrebbe potuto salvare la subscription la perde per pura inerzia del processo.

### La Soluzione ChurnGuard

Un dunning engine AI-powered che si connette in 5 minuti tramite webhook Stripe, e poi:

1. **Intercetta** ogni `invoice.payment_failed` in tempo reale
2. **Classifica** il tipo di decline (soft/hard/SCA) per decidere la strategia
3. **Esegue** un retry schedule ottimizzato (Stripe Smart Retries + timing day-of-month)
4. **Genera** email di recovery personalizzate con Claude AI (nome, importo, piano, storico)
5. **Mostra** un dashboard ROI in tempo reale: MRR recuperato, recovery rate, valore annuo salvato

---

## 4. Funzionalità

### MUST HAVE — MVP

| ID | Funzionalità | Descrizione | Skill di riferimento |
|----|-------------|-------------|----------------------|
| M1 | **Stripe Webhook Integration** | Endpoint `/api/webhooks/stripe` con verifica firma, store idempotente su DB, risposta <5s + processing async | `stripe-integration` |
| M2 | **Decline Classification** | Classificazione automatica soft/hard/SCA da Stripe decline codes. Hard → chiedi nuova carta. Soft → retry + email sequence | `churn-prevention`, `billing-automation` |
| M3 | **Dunning Sequence Engine** | Job scheduler (Supabase pgmq) con retry a Day 0/3/7/10. Cancellazione automatica al pagamento riuscito | `billing-automation`, `churn-prevention` |
| M4 | **AI Email Generation** | Genera email plain-text con Claude API (`claude-sonnet-4-6`) contestualizzate per ogni subscriber. Fallback su template statico | `resend-email`, `churn-prevention` |
| M5 | **Email Delivery** | Invio via Resend da Server Action. 1 CTA per email, link diretto a update-card senza login. Retry exponential backoff | `resend-email`, `email-best-practices` |
| M6 | **Recovery Dashboard** | 3 KPI above-the-fold: MRR recuperato, Recovery rate %, Valore annuo salvato. Timeline per payment | `startup-metrics-framework` |
| M7 | **Onboarding Wizard** | Setup in 5 minuti: registrazione → inserimento webhook secret Stripe → test connection → configurazione email sender | `stripe-integration` |
| M8 | **Multi-tenancy + Auth** | Ogni organizzazione vede solo i propri dati. RLS su tutte le tabelle. Auth via Supabase Auth (email/password + magic link) | `supabase-rls`, `auth-implementation-patterns` |
| M9 | **ChurnGuard Own Billing** | Abbonamento Stripe per i piani ChurnGuard. Piano Starter ($49/mo) e Growth ($99/mo) | `stripe-integration`, `billing-automation` |

### SHOULD HAVE — v1.1

| ID | Funzionalità | Descrizione | Skill di riferimento |
|----|-------------|-------------|----------------------|
| S1 | **% Revenue Billing Model** | Pricing alternativo: 8% del recovered revenue. Tracking granulare per invoice recuperata. Auto-fatturazione mensile | `billing-automation`, `stripe-integration` |
| S2 | **Email Sequence Customization** | Dashboard per customizzare: timing (Day 0/3/7/10), oggetto email, tono (friendly/urgent). Preview email generate da AI | `email-best-practices` |
| S3 | **Day-of-Month Smart Retry** | Retry schedulato lo stesso giorno del mese dell'ultimo pagamento andato a buon fine (+15-20% recovery rate) | `churn-prevention`, `billing-automation` |
| S4 | **Win-back Campaign** | Quando `customer.subscription.deleted`: sequenza email win-back a 7/14/30 giorni con offerta speciale | `churn-prevention` |
| S5 | **Stripe Connect** | Integrazione via OAuth Stripe Connect per eliminare la necessità di webhook secret manuale | `stripe-integration` |
| S6 | **Cohort Analytics** | Recovery rate per cohort: primo fallimento vs. secondo vs. terzo. Trend mensile. Export CSV | `startup-metrics-framework` |
| S7 | **Slack / Email Alerts** | Notifiche in tempo reale al team cliente: "Pagamento di $299 recuperato!" | `resend-email` |
| S8 | **A/B Test Email** | Split test tra email AI-generata e template statica per misurare il differenziatore | — |

### NICE TO HAVE — v2.0

| ID | Funzionalità | Descrizione |
|----|-------------|-------------|
| N1 | **Multi-gateway support** | Paddle, LemonSqueezy, Chargebee oltre a Stripe |
| N2 | **Cancel flow** | Popup intercetta cancellazione volontaria con offerta save (come Churnkey) |
| N3 | **Customer health score** | Score predittivo di rischio churn basato su login frequency, feature usage, billing history |
| N4 | **SMS recovery** | SMS come canale aggiuntivo per recovery (Twilio) |
| N5 | **API pubblica** | Endpoint REST per integrazioni custom dei clienti enterprise |
| N6 | **White-label** | Dashboard rebrandable per agenzie |
| N7 | **Revenue Analytics** | NDR, LTV, expansion MRR in un unico dashboard per i clienti |

---

## 5. User Journey

### Journey 1 — Nuovo Cliente (Onboarding)

```
1. DISCOVERY
   Founder trova ChurnGuard su HN / Product Hunt / Stripe Marketplace
   → Landing page con calcolatore ROI interattivo ("Inserisci il tuo MRR → stima il recovery")

2. SIGNUP
   Email + password (Supabase Auth) OPPURE magic link
   → Seleziona piano: Starter $49/mo | Growth $99/mo | (opzione: 8% del recovered)
   → Checkout Stripe (propri dati billing)

3. ONBOARDING WIZARD (5 minuti)
   Step 1: "Connetti Stripe"
              → Copia il webhook secret da Stripe Dashboard
              → Incolla in ChurnGuard → Test automatico connessione
   Step 2: "Configura email sender"
              → Inserisce il proprio dominio per email (es. noreply@loro-saas.com)
              → ChurnGuard guida setup DNS DKIM/SPF via Resend
   Step 3: "Personalizza sequenza"
              → Rivede timing default (Day 0/3/7/10)
              → Anteprima email generate da AI con dati di esempio
   Step 4: "Vai live" ✓

4. PRIMA SETTIMANA
   → Riceve notifica email "Primo pagamento fallito intercettato"
   → Accede al dashboard per vedere il primo job in dunning
   → Dopo 3-5 giorni: notifica "Primo pagamento recuperato — $149 salvato!"
```

### Journey 2 — Utente Quotidiano (Monitoring)

```
Dashboard principale → 3 KPI card in alto
→ Lista pagamenti in dunning (status, importo, giorno sequenza, prossima azione)
→ Timeline per ogni pagamento (email inviate, retry eseguiti, esito)
→ Grafico MRR recuperato per mese (trend)
```

### Journey 3 — Subscriber del Cliente (End User)

```
Riceve email Day 0: "Il tuo pagamento di $49 non è andato a buon fine"
→ Tono amichevole, oggetto diretto, link diretto a update-card (tokenizzato, no login)
→ [Se non agisce] Riceve Day 3: link aggiornato, stesso link tokenizzato
→ [Se non agisce] Riceve Day 7: urgency copy "Il tuo accesso verrà sospeso il [data]"
→ [Se non agisce] Riceve Day 10: final warning
→ [Azione] Clicca link → Stripe-hosted payment page → aggiorna carta → retry immediato
→ Pagamento andato a buon fine → sequenza cancellata
```

### Journey 4 — Upgrade Piano

```
Settings → Billing
→ Vede MRR recovered del mese corrente
→ Se sul piano Starter con >$500/mo recovered → banner "Upgrade to Growth per accedere a..."
→ Click → Checkout Stripe → upgrade immediato, prorating automatico
```

---

## 6. Architettura e Schema DB

### Stack Tecnico

| Layer | Tecnologia |
|-------|-----------|
| Framework | Next.js 15 App Router (TypeScript) |
| Database + Auth + Queues | Supabase (PostgreSQL + RLS + pgmq) |
| ORM | Drizzle ORM (type-safe, migrations) |
| Payments | Stripe (propria billing ChurnGuard) |
| Email | Resend |
| AI | Anthropic SDK — `claude-sonnet-4-6` |
| Deployment | Vercel (serverless functions + cron) |
| UI | shadcn/ui + Tailwind CSS |

### Flusso Architetturale

```
[Stripe del Cliente]
       │ invoice.payment_failed
       ▼
[POST /api/webhooks/stripe]
  • Verifica firma (constructEvent)
  • Controlla idempotency (stripe_event_id in DB)
  • Risponde 200 immediatamente
       │
       ▼
[failed_payments TABLE]
  • Inserisce record con decline_type
       │
       ▼
[dunning_jobs QUEUE (pgmq)]
  • Enqueue: email Day 0 (immediato)
  • Enqueue: retry Day 3, email Day 3
  • Enqueue: email Day 7
  • Enqueue: email Day 10
       │
       ▼
[CRON ogni ora — /api/cron/process-dunning]
  • Fetch jobs scheduled_at <= now()
  • Per job tipo 'email':
      → Chiama Claude API per generare testo
      → Invia via Resend
      → Marca job executed
  • Per job tipo 'retry':
      → Chiama Stripe API retry invoice
      → Se success → cancella job rimanenti, update status='recovered'
      → Se fail → lascia proseguire la sequenza
       │
       ▼
[recovery_metrics — refresh ogni ora]
  • Aggregazione per dashboard

[invoice.payment_succeeded]
  → Cancella dunning_jobs pendenti
  → Update failed_payments status='recovered'
```

### Schema Database

```sql
-- Organizzazioni ChurnGuard (SaaS clienti)
CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  stripe_webhook_secret TEXT,          -- segreto webhook Stripe del cliente
  stripe_account_id     TEXT,          -- per Stripe Connect (v1.1)
  resend_domain         TEXT,          -- dominio email configurato
  plan            TEXT DEFAULT 'starter',  -- starter | growth | percentage
  plan_percentage DECIMAL(4,2),        -- % per piano percentage (es: 8.00)
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Utenti (membri del team del cliente)
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT DEFAULT 'owner',  -- owner | admin | viewer
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Pagamenti falliti in dunning
CREATE TABLE failed_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_event_id       TEXT UNIQUE NOT NULL,     -- idempotency key
  stripe_customer_id    TEXT NOT NULL,
  stripe_invoice_id     TEXT NOT NULL,
  stripe_subscription_id TEXT,
  customer_email        TEXT NOT NULL,
  customer_name         TEXT,
  amount                INTEGER NOT NULL,          -- in centesimi
  currency              TEXT DEFAULT 'usd',
  failure_reason        TEXT,                      -- Stripe decline code
  decline_type          TEXT NOT NULL,             -- soft | hard | sca_required
  status                TEXT DEFAULT 'in_dunning', -- pending | in_dunning | recovered | hard_churn | cancelled
  dunning_step          INTEGER DEFAULT 0,         -- 0=Day0, 1=Day3, 2=Day7, 3=Day10
  last_payment_date     DATE,                      -- per day-of-month retry (v1.1)
  recovered_at          TIMESTAMPTZ,
  recovered_amount      INTEGER,                   -- per piano percentage billing
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Job schedulati (email e retry)
CREATE TABLE dunning_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  failed_payment_id UUID REFERENCES failed_payments(id) ON DELETE CASCADE,
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE,
  job_type          TEXT NOT NULL,      -- email | retry
  scheduled_at      TIMESTAMPTZ NOT NULL,
  executed_at       TIMESTAMPTZ,
  status            TEXT DEFAULT 'pending',  -- pending | executing | done | failed | cancelled
  attempt_number    INTEGER DEFAULT 0,
  result            JSONB,              -- { success: bool, error?: string, email_id?: string }
  email_subject     TEXT,
  email_body_preview TEXT,             -- primi 200 char per audit trail
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- Metriche aggregate per dashboard (refresh ogni ora via cron)
CREATE TABLE recovery_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  period          DATE NOT NULL,        -- primo giorno del mese
  total_failed    INTEGER DEFAULT 0,
  total_recovered INTEGER DEFAULT 0,
  recovery_rate   DECIMAL(5,2),        -- percentuale
  mrr_saved       INTEGER DEFAULT 0,   -- in centesimi
  amount_recovered_for_billing INTEGER DEFAULT 0,  -- per piano percentage
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, period)
);

-- Audit log eventi webhook
CREATE TABLE webhook_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type      TEXT NOT NULL,
  processed       BOOLEAN DEFAULT false,
  payload         JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies (tutte le tabelle scoped a organization_id)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dunning_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_metrics ENABLE ROW LEVEL SECURITY;

-- Helper function (SECURITY DEFINER per evitare loop RLS)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;
```

### Ruoli e Permessi

| Ruolo | Accesso |
|-------|---------|
| **owner** | Full access: settings, billing, tutti i dati |
| **admin** | Dashboard + settings (no billing) |
| **viewer** | Read-only dashboard |

---

## 7. Integrazioni Esterne

| Servizio | Uso | Note |
|---------|-----|------|
| **Stripe** | Ricezione webhook eventi pagamento; propria billing ChurnGuard | Verifica firma `stripe.webhooks.constructEvent`; idempotency per event_id |
| **Resend** | Invio email di recovery; email transazionali (magic link, notifiche) | Mai API key nel frontend; solo Server Actions/API Routes; retry exponential backoff su 429/500 |
| **Anthropic API** | Generazione email personalizzate con `claude-sonnet-4-6` | Fallback su template statico se API non disponibile; prompt include: nome, importo, piano, tentativo n., tipo decline |
| **Supabase** | DB, Auth, pgmq queue, RLS | Row Level Security su tutte le tabelle; pgmq per job scheduling dunning |
| **Vercel** | Hosting + serverless functions + cron jobs | Cron `/api/cron/process-dunning` ogni ora |

---

## 8. Requisiti Non Funzionali

### Performance
- Webhook endpoint risponde in <200ms (store + queue, processing asincrono)
- Dashboard carica in <2s su LTE (dati aggregati pre-computati in `recovery_metrics`)
- Email inviata entro 5 minuti dal fallimento del pagamento (Day 0)

### Sicurezza
- Verifica firma webhook Stripe su ogni request
- Tutti i segreti in env variables, mai nel codice
- Link update-card tokenizzati (UUID one-time token con scadenza 30 giorni)
- HTTPS obbligatorio; CSP headers
- Rate limiting su `/api/webhooks/stripe`: max 1000 req/min per org

### Affidabilità
- Idempotency su tutti gli eventi Stripe (duplicate webhook delivery)
- Dunning jobs con retry automatico in caso di errore (max 3 tentativi, backoff 1h/4h/24h)
- Alert se cron job fallisce (notifica email al team ChurnGuard)
- Audit trail completo: ogni email inviata, ogni retry eseguito, ogni cancellazione

### Scalabilità
- Multi-tenant by design (RLS su organization_id)
- pgmq gestisce code concorrenti per organizzazioni diverse
- Stateless API routes → scalabilità orizzontale su Vercel

### Compliance
- GDPR: dati subscriber dei clienti trattati come data processor; DPA disponibile
- CAN-SPAM: link unsubscribe nelle email (anche se transazionali, best practice)
- Stripe: rispetto delle policy sull'uso dei dati di pagamento

---

## 9. Competitor e Differenziazione

| Competitor | Pricing | Recovery Rate | Debolezza | ChurnGuard vs. |
|------------|---------|---------------|-----------|----------------|
| **Stunning** | Flat MRR-based | 10-30x ROI (dichiarato) | Email statiche, no AI | AI personalization + pricing flessibile |
| **Churnbuster** | $30/mo entry → MRR-based | Non specificato | No AI, UI datata | AI email + dashboard moderno |
| **Churnkey** | SaaS mensile | Fino a 89% | Suite complessa, caro | Self-serve semplice, focus su recovery |
| **Gravy** | % recovered | Alto (B2C) | Agenti umani, non scalabile | Automated AI, costo inferiore |
| **FlexPay** | % recovered | Fino a 70% | Enterprise only | SMB-friendly, setup 5 minuti |
| **Slicker** | % recovered | 45-60% | Nuovo player, no track record | Stabilità + piano flat disponibile |

**Differenziatori ChurnGuard:**
1. **AI email personalization nativa** (Claude API) — nessun competitor lo posiziona esplicitamente
2. **Setup in 5 minuti** — webhook secret, no OAuth complesso (semplificato rispetto a Stripe Connect)
3. **Doppio modello di pricing** — flat per chi vuole prevedibilità, % per chi vuole zero rischio
4. **Dashboard ROI real-time** — il cliente vede esattamente quanti $ ha recuperato ChurnGuard

---

## 10. Metriche di Successo (KPI)

### KPI di Prodotto (per i clienti ChurnGuard)

| Metrica | Target MVP | Come si misura |
|---------|-----------|----------------|
| Recovery rate (soft declines) | ≥50% | `total_recovered / total_failed` per decline_type=soft |
| Recovery rate (overall) | ≥25% | `total_recovered / total_failed` totale |
| Time to first recovery | <5 giorni | `recovered_at - created_at` mediana |
| Email open rate (dunning) | ≥40% | Resend webhook events |
| Email click-through rate | ≥15% | Resend click tracking |
| Day 0 email recovery rate | ≥30% | Recovery entro 24h dal Day 0 email |

### KPI di Business ChurnGuard

| Metrica | Target M6 | Note |
|---------|----------|------|
| MRR ChurnGuard | $5K–15K | 50–150 clienti × $49–$99/mo |
| Clienti attivi | 50 | Obiettivo conservativo |
| Churn mensile clienti | <5% | Il prodotto deve dimostrare valore rapidamente |
| Activation rate (setup completo) | >70% | % utenti che completano onboarding wizard |
| NPS | >50 | Survey a 30 giorni dall'attivazione |
| CAC | <$50 | Self-serve, community-driven |
| LTV/CAC | >5x | Con $99/mo e churn <5%, LTV ~$1.980 |

---

## 11. Roadmap e Stima Tempi

### Fase 1 — Foundation (Settimane 1-3)
- [ ] Setup Next.js + Supabase + Drizzle ORM
- [ ] Schema DB + migrazioni + RLS policies
- [ ] Stripe webhook endpoint (verifica firma, idempotency, store)
- [ ] Auth (Supabase Auth, magic link, ruoli)
- [ ] Onboarding wizard base (Step 1: connetti Stripe)

### Fase 2 — Dunning Engine (Settimane 4-6)
- [ ] Dunning scheduler (pgmq jobs per Day 0/3/7/10)
- [ ] Decline classification (soft/hard/SCA da Stripe codes)
- [ ] Email generation con Claude API (prompt engineering)
- [ ] Email delivery via Resend (template, CTA tokenizzato)
- [ ] Cancellazione automatica su `invoice.payment_succeeded`
- [ ] Cron job processor (`/api/cron/process-dunning`)

### Fase 3 — Dashboard e Billing (Settimane 7-9)
- [ ] Dashboard KPI (MRR recovered, recovery rate, valore annuo)
- [ ] Timeline per payment (email inviate, retry, esito)
- [ ] Proprio billing Stripe (piani Starter/Growth)
- [ ] Onboarding wizard completo (Step 2: email sender, Step 3: preview sequenza)

### Fase 4 — Polish e Go-Live (Settimane 10-12)
- [ ] Landing page con ROI calculator
- [ ] Email notifiche (recovery alert, weekly digest)
- [ ] Documentazione onboarding
- [ ] Test E2E webhook → dunning → recovery
- [ ] Launch su Product Hunt / HN / Stripe community

### Fase 5 — v1.1 (Mesi 4-6)
- [ ] Pricing % del recovered (S1)
- [ ] Email sequence customization (S2)
- [ ] Day-of-month smart retry (S3)
- [ ] Win-back campaign (S4)
- [ ] Cohort analytics (S6)

---

## 12. Skills e Agenti Rilevanti

| Area di sviluppo | Skill da consultare | Path |
|-----------------|--------------------|----|
| Webhook Stripe, payment events, retry API | `stripe-integration` | `~/.claude/skills/stripe-integration/` |
| Dunning engine, retry schedule, subscription lifecycle | `billing-automation` | `~/.claude/skills/billing-automation/` |
| Recovery strategy, email sequence, decline classification | `churn-prevention` | `~/.claude/skills/churn-prevention/` |
| Schema DB, query optimization, connection management | `supabase-postgres-best-practices` | `~/.claude/skills/supabase-postgres-best-practices/` |
| RLS policies, multi-tenancy, SECURITY DEFINER | `supabase-rls` | `~/.claude/skills/supabase-rls/` |
| Auth, JWT, RBAC, session management | `auth-implementation-patterns` | `~/.claude/skills/auth-implementation-patterns/` |
| Email delivery, template, rate limiting, tracking | `resend-email` | `~/.claude/skills/resend-email/` |
| Deliverability, SPF/DKIM/DMARC, compliance | `email-best-practices` | `~/.claude/skills/email-best-practices/` |
| REST API design, error handling, pagination | `api-design-principles` | `~/.claude/skills/api-design-principles/` |
| Type-safe queries, migrations | `drizzle-orm-patterns` | `~/.claude/skills/drizzle-orm-patterns/` |
| App Router, layouts, middleware, Server Actions | `nextjs-app-router-patterns` | `~/.claude/skills/nextjs-app-router-patterns/` |
| CI/CD, env management, cron su Vercel | `deploy-vercel` | `~/.claude/skills/deploy-vercel/` |
| Test pagamenti, webhook simulation | `e2e-testing-patterns` | `~/.claude/skills/e2e-testing-patterns/` |
| Test unitari API routes | `javascript-testing-patterns` | `~/.claude/skills/javascript-testing-patterns/` |
| Pricing tiers, value metric, psychology | `pricing-strategy` | `~/.claude/skills/pricing-strategy/` |
| KPI SaaS, MRR, NDR, metriche retention | `startup-metrics-framework` | `~/.claude/skills/startup-metrics-framework/` |

---

## 13. Raccomandazione Piattaforma

### Piattaforma: **Web App → Lovable**

ChurnGuard è un tool B2B con:
- Dashboard dati complessi (grafici, tabelle, timeline)
- Onboarding wizard multi-step
- Integrazione webhook/API
- Billing proprio (Stripe)
- Nessuna necessità di accesso nativo al dispositivo mobile

**→ Web app è la scelta corretta. Mobile app non necessaria per MVP.**

**Lovable** è la piattaforma ottimale perché:
1. Genera Next.js App Router (esatto stack scelto per ChurnGuard)
2. Supporta integrazione Supabase nativa
3. shadcn/ui + Tailwind CSS (UI moderna out-of-the-box)
4. Ideale per dashboard B2B con dati strutturati

### Comando Successivo

```
/prd-lovable
```

**⚠️ IMPORTANTE:** Usare `/prd-lovable` per spezzettare questo PRD in prompt JSON ottimizzati per Lovable. Non usare `/create` direttamente — il PRD va prima convertito in istruzioni strutturate per la piattaforma.

### Skills da tenere aperte durante lo sviluppo su Lovable

1. `stripe-integration` — per il webhook endpoint e billing
2. `supabase-rls` — per RLS policies multi-tenant
3. `churn-prevention` — per la logica del dunning engine
4. `resend-email` — per l'integrazione email
5. `billing-automation` — per lo scheduler dei job

---

_PRD generato il 2026-03-01 | ChurnGuard v1.0_
