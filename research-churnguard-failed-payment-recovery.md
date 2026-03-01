# Research: ChurnGuard — Failed Payment Recovery Tool for SaaS
Data: 2026-03-01 | Progetto: ChurnGuard

## Skills consultate

- **churn-prevention**: Estratti pattern di dunning stack (Pre-dunning → Smart retry → Dunning emails → Grace period → Hard cancel), timing di retry (Day 0, 3, 7, 10), benchmark di recovery (soft decline 70%+, overall 50-60%), e framework metriche (dunning recovery rate target 50-60%). Incluso mapping decline-type → retry strategy e le distinzioni hard/soft decline.
- **stripe-integration**: Estratti webhook events critici (`invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`), pattern di gestione idempotente degli eventi webhook, struttura sicura degli endpoint con verifica della firma, e best practice per la gestione degli errori di pagamento.
- **billing-automation**: Estratti pattern di DunningManager con retry schedule configurabile, stati del ciclo di vita della subscription (trial → active → past_due → canceled), logica di retry con escalation delle email template, e best practice di audit trail per tutti gli eventi di billing.
- **email-sequence**: Estratti principi di email dunning (tono progressivo: friendly → helpful → urgency → final), struttura CTA (link diretto a payment update, no login richiesto), timing ottimale (immediato al giorno 0, poi progressivo), e regole di copy (plain text supera HTML per email di dunning).
- **pricing-strategy**: Estratti framework value-based pricing, modello Good-Better-Best per tier, opzioni di value metric (flat fee vs percentage of revenue), e principi di pricing psychology per SaaS B2B (anchor price, charm pricing per SMB, round pricing per premium).
- **startup-metrics-framework**: Estratti KPI critici per SaaS in seed stage (MRR growth 15-20% MoM, gross retention >85%, CAC/LTV baseline), NDR target (>100%), e metriche di efficienza che ChurnGuard deve misurare e presentare ai clienti.
- **resend-email**: Estratti pattern di integrazione email con Edge Function/API Route, template HTML responsive mobile-first con inline CSS, gestione rate limiting, retry con backoff esponenziale per errori temporanei, e regola di non esporre API key nel frontend.

---

## Domande analizzate

1. **Qual è la dimensione del mercato e la reale opportunità per ChurnGuard nel 2025-2026?**
2. **Chi sono i concorrenti diretti e come si differenzia ChurnGuard (architettura, pricing, posizionamento)?**
3. **Quale architettura tecnica è ottimale per un web app Next.js che intercetta webhook Stripe, gestisce retry e invia email di recovery?**
4. **Quale modello di pricing massimizza conversione e revenue per SaaS con 100-10.000 subscriber?**
5. **Quali sono le metriche chiave di performance che ChurnGuard deve tracciare e mostrare ai clienti per dimostrare il proprio ROI?**

---

## Risultati principali

Il mercato dei failed payment recovery è massiccio e in crescita: i pagamenti falliti minacciano $129 miliardi di revenue da subscription nel 2025, con il churn involontario che rappresenta il 20-40% del churn totale SaaS. ChurnGuard si posiziona in uno spazio con concorrenti validati (Stunning, Churnbuster, Gravy, Churnkey, FlexPay) ma con un differenziatore chiaro: costruito nativamente su Claude Code con AI per personalizzazione email e ottimizzazione retry. L'architettura tecnica ideale è Next.js App Router + Supabase + Stripe Webhooks + Resend, che è il pattern più adottato nel 2025 per SaaS B2B self-serve. Il pricing ibrido (flat fee per entry + percentage-of-recovered per growth) è il modello che riduce il rischio percepito dal cliente e allinea gli incentivi, con sweet spot tra $50-150/mese o 5-10% del recovered revenue.

---

## Confronto opzioni — Modelli di Pricing

| Criterio | Opzione A: Flat Fee Mensile | Opzione B: % del Recovered Revenue | Opzione C: Ibrido (Flat + % Recovery) |
|----------|----------------------------|--------------------------------------|----------------------------------------|
| **Descrizione** | $50-150/mese fisso, indipendente dai risultati | 5-15% di ogni pagamento recuperato, zero se non recupera | Base fee ($29-49/mese) + 5-8% solo sul recovered revenue oltre soglia |
| **Pro** | Prevedibile, no calcoli complessi, facile da budgetare per il cliente | Perfetto allineamento di incentivi, zero rischio per il cliente, facile pitch ("paghi solo se funziona") | Combina prevedibilità con alignment; abbassa barriera d'ingresso; genera revenue ricorrente garantita |
| **Contro** | Cliente paga anche se recovery è bassa; pressure alta sui risultati immediati; no pitch "risk-free" | Revenue volatile; difficile prevedere cash flow; cliente potrebbe contestare calcoli; meno prevedibile per la startup | Più complessa da spiegare; richiede tracking granulare per revenue share; più operativamente oneroso |
| **Complessità implementativa** | Bassa | Media (tracking per customer, webhook events per calcolo) | Alta (billing dual-component, reporting trasparente) |
| **Allineamento incentivi** | Basso | Alto | Alto |
| **Adozione mercato** | Stunning (flat MRR-based), Churnbuster ($30/mo entry) | Gravy, FlexPay, Vindicia Retain, Slicker | Meno comune ma emergente |
| **Compatibilità target (100-10K sub)** | Ottima per micro-SaaS (<500 sub) | Ottima per mid-market (1K-10K sub) | Ottima per tutto lo spettro target |

---

## Confronto opzioni — Stack Tecnico

| Criterio | Opzione A: Next.js + Supabase + Resend | Opzione B: Next.js + PlanetScale + SendGrid | Opzione C: Next.js + Railway/Postgres + Customer.io |
|----------|----------------------------------------|---------------------------------------------|------------------------------------------------------|
| **Descrizione** | App Router, Supabase per DB+Auth+Queues, Resend per email transazionali | App Router, PlanetScale MySQL, SendGrid per email | App Router, Postgres self-hosted su Railway, Customer.io per sequenze comportamentali |
| **Pro** | Stack monolitico semplice, Supabase Queues per job dunning, RLS per multi-tenancy, ottima DX; Resend API developer-friendly con React Email | PlanetScale scala bene per volumi grandi, branching DB per migrations sicure; SendGrid dominante nell'industria | Customer.io nativo per sequenze email comportamentali e dunning avanzato con logica condizionale |
| **Contro** | Supabase vendor lock-in; Resend meno features per sequenze complesse rispetto a Customer.io | PlanetScale più costoso; SendGrid più complesso, meno developer-friendly nel 2025 | Customer.io aggiunge costo significativo ($100+/mese); Railway richiede più ops overhead |
| **Complessità** | Bassa | Media | Alta |
| **Costo infrastruttura (early)** | ~$25-50/mese | ~$80-150/mese | ~$150-250/mese |
| **Community/Ecosystem 2025** | Fortissima (pattern più usato nei SaaS boilerplate) | Media | Media |
| **Compatibilità con Claude Code** | Ottima (tutti i boilerplate Vercel usano questo stack) | Buona | Buona ma overkill per MVP |

---

## Confronto opzioni — Architettura Dunning Engine

| Criterio | Opzione A: Stripe Smart Retries Only | Opzione B: Custom Retry Logic + Dunning Emails | Opzione C: Hybrid (Stripe Smart Retries + Custom Email Layer) |
|----------|--------------------------------------|------------------------------------------------|---------------------------------------------------------------|
| **Descrizione** | Delega tutto a Stripe Smart Retries (ML-based, fino a 4 tentativi in 28 giorni); email di Stripe Billing | Retry schedule custom via cron/queue; email branded completamente personalizzate; logica condizionale su tipo di decline | Stripe Smart Retries per i retry; ChurnGuard gestisce email personalizzate, timing e logica di escalation |
| **Recovery rate atteso** | 15-25% (solo Stripe) | 30-50% (custom ottimizzato) | 35-55% (hybrid best-of-both) |
| **Pro** | Zero codice da scrivere; affidabile; free con Stripe Billing | Controllo totale; email brandizzate; personalizzazione AI; possibilità di testare timing | Approccio pragmatico: Stripe gestisce la parte complessa dei retry; ChurnGuard aggiunge valore sull'email layer e il reporting |
| **Contro** | No personalizzazione; email Stripe generiche; no differenziazione su hard vs soft decline nelle email | Complesso da costruire e mantenere; rischio di over-retry su hard declines | Dipendenza da Stripe per il retry core; meno controllo granulare |
| **Complessità** | Bassa | Alta | Media |
| **Raccomandazione** | Solo per MVP rapido | Per v2.0 | Per v1.0 produzione |

---

## Analisi concorrenti

| Competitor | Posizionamento | Pricing | Recovery Rate | Differenziatore |
|------------|---------------|---------|---------------|-----------------|
| **Stunning** | Stripe-native, self-serve, SMB | Flat fee MRR-based | 10-30x ROI dichiarato | Primo mover su Stripe dunning |
| **Churnbuster** | SaaS & memberships, feature-rich | $30/mo entry (fino a $10K MRR), poi MRR-based | Non specificato | Cancel flow + dunning combo |
| **Gravy** | Human-driven (agenti reali contattano clienti) | % del recovered | Alto per B2C subscription box | Tocco umano, non scalabile |
| **Churnkey** | Full retention suite (cancel flow + dunning) | SaaS mensile | Fino a 89% | AI-powered adaptive offers, suite completa |
| **FlexPay** | Enterprise, AI-driven | % del recovered | Fino a 70% | Multi-payment-method optimization |
| **Slicker** | AI-first, pay-for-success | % recovered (no flat fee) | 45-60% | AI engine, nessun rischio per cliente |
| **ChurnGuard** | **AI email personalization + Stripe webhook native, self-serve SaaS** | **Ibrido: flat $50-100/mo o % recovered** | **Target: 20-30%** | **Costruito con Claude Code, AI per email, dashboard ROI real-time** |

---

## Raccomandazione

**Architettura: Next.js App Router + Supabase + Stripe Webhooks + Resend con approccio Hybrid Dunning Engine** perché:

1. **Velocità di sviluppo**: Il pattern Next.js + Supabase + Stripe è il più documentato, con boilerplate pronti (vercel/nextjs-subscription-payments, nextjs/saas-starter) che riducono il tempo di implementazione del 60-70%. Supabase Queues gestisce i job di dunning senza infrastruttura separata.
2. **Differenziazione tramite AI**: Usare Claude via Anthropic API per generare email di recovery personalizzate (basate su nome cliente, piano, storico pagamenti, motivo del fallimento) è il differenziatore chiave rispetto a Stunning e Churnbuster che usano template statici. Questo giustifica il pricing premium.
3. **Pricing ibrido come leva di conversione**: Offrire sia flat fee ($50-100/mese) sia % del recovered revenue (5-10%) permette di servire micro-SaaS (<500 sub, preferiscono prevedibilità) e mid-market (1K+ sub, preferiscono risk-free). Il modello % è il pitch commerciale più forte: "pagate solo quando funziona."

---

## Architettura tecnica dettagliata

```
Cliente SaaS → Stripe → Webhook Events
                          ↓
                 ChurnGuard /api/webhooks
                          ↓
               Supabase DB (failed_payments table)
                          ↓
               Supabase Queue (dunning_jobs)
                          ↓
               Job Processor (ogni ora)
               ├── Controlla tipo decline (soft/hard)
               ├── Applica retry schedule
               ├── Genera email con Claude API (personalizzata)
               └── Invia via Resend
                          ↓
               Dashboard real-time (ROI, recovery rate, MRR saved)
```

### Webhook events da intercettare:
- `invoice.payment_failed` → trigger immediato email Day 0
- `invoice.payment_succeeded` → cancella dunning sequence
- `customer.subscription.deleted` → marca come hard churn, avvia win-back
- `customer.updated` → aggiorna payment method, retry immediato

### Tabelle database (Supabase/PostgreSQL):
```sql
-- Clienti ChurnGuard (SaaS companies)
organizations (id, stripe_account_id, plan, settings)

-- Subscriber dei clienti in dunning
failed_payments (
  id, organization_id, stripe_customer_id,
  stripe_invoice_id, amount, currency,
  failure_reason, decline_type,  -- soft | hard | sca_required
  status,  -- pending | in_dunning | recovered | hard_churn
  created_at, recovered_at
)

-- Job di retry ed email schedulati
dunning_jobs (
  id, failed_payment_id, job_type,  -- retry | email
  scheduled_at, executed_at, result,
  email_subject, email_body_preview
)

-- Metriche aggregate per dashboard
recovery_metrics (
  organization_id, period, total_failed,
  total_recovered, recovery_rate, mrr_saved
)
```

---

## Best practices dalle skills

- **Dalla churn-prevention**: Distinguere sempre hard decline (non riprovare, chiedere nuovo metodo) da soft decline (riprovare 3-5 volte in 7-10 giorni). Il Day-of-month retry (riprovare lo stesso giorno del mese in cui il pagamento era andato a buon fine in precedenza) aumenta il recovery rate del 15-20%.
- **Dalla stripe-integration**: Processare ogni webhook idempotentemente verificando l'event ID prima di agire. Rispondere con 200 entro 5 secondi ed elaborare in background via queue per evitare timeout Stripe.
- **Dalla billing-automation**: Audit trail completo di ogni tentativo di retry e ogni email inviata. Il cliente SaaS deve vedere la timeline completa nel dashboard.
- **Dalla email-sequence**: Email di dunning in plain text performano meglio di quelle HTML-heavy. Soggetti diretti e specifici ("Il tuo pagamento di $49 non è andato a buon fine") battono quelli vague. Un solo CTA per email (link diretto a update-card, no login richiesto).
- **Dalla resend-email**: Mai esporre la Resend API key nel frontend. Tutte le email inviate da Next.js API Route/Server Action. Retry con backoff esponenziale su errori 429/500. Testare template su Gmail, Outlook, Apple Mail.
- **Dalla startup-metrics-framework**: Le metriche da mostrare nel dashboard ai clienti ChurnGuard: MRR recuperato (assoluto e %), recovery rate per cohort (primo fallimento vs. secondo vs. terzo), tempo medio a recupero, e confronto vs. benchmark industria.
- **Dalla pricing-strategy**: Per SaaS SMB usare charm pricing ($49/mo, $99/mo). Per il modello % usare round percentages (5%, 10%). Offrire sconto annuale del 20% per ridurre churn dei clienti ChurnGuard stessi.

---

## Prossimi passi suggeriti

1. **Setup boilerplate**: Partire da `github.com/nextjs/saas-starter` (Next.js + Postgres + Stripe + shadcn/ui) come base, aggiungendo Supabase per Auth e Queues. Implementare prima il webhook endpoint `/api/webhooks/stripe` con verifica firma e store su DB.
2. **MVP dunning engine**: Implementare il retry schedule minimo (Day 0 email, Day 3 retry + email, Day 7 email urgenza, Day 10 final warning) usando Supabase Queues per scheduling. Usare Stripe Smart Retries per la parte di retry pagamento, ChurnGuard gestisce solo l'email layer.
3. **AI email personalization**: Integrare Anthropic SDK per generare email di recovery personalizzate. Input: nome cliente, importo, piano, numero di tentativo, ultimo pagamento andato a buon fine. Output: email in plain text con un CTA. Testare A/B contro template statici per validare il differenziatore AI.
4. **Dashboard ROI**: Costruire il dashboard primario con tre KPI in above-the-fold: "MRR recuperato questo mese", "Recovery rate %", "Valore annuo salvato". Questo è il proof-of-value che giustifica il pricing e riduce il churn dei clienti ChurnGuard.
5. **Go-to-market**: Targetizzare community Stripe (forum, Discord), Hacker News Show HN, e directory come Product Hunt. Il pitch è semplice: "Installa in 5 minuti, connetti il tuo Stripe, recupera il 20-30% dei pagamenti falliti." Offrire primo mese free o free fino a $10K MRR (come Churnbuster).
6. **Pricing validation**: Testare entrambi i modelli (flat $79/mese vs. 8% del recovered) su segmenti distinti per i primi 50 clienti. Il modello % è più difficile da implementare ma ha un pitch superiore. Decidere dopo 60 giorni di dati reali.

---

## Fonti

- [Stripe Smart Retries Documentation](https://docs.stripe.com/billing/revenue-recovery/smart-retries)
- [Failed Payment Recovery 2025: Stripe Smart Retries & Dunning](https://www.quantledger.app/blog/how-to-recover-failed-payments-stripe)
- [Smart Retries vs Rules-Based Dunning 2025 — Slicker](https://www.slickerhq.com/blog/smart-retries-vs-rules-based-dunning-2025-stripe-recurly-slicker-ai-benchmarks)
- [Churnkey: State of Retention 2025](https://churnkey.co/reports/state-of-retention-2025)
- [Churnkey: Involuntary Churn Benchmarks](https://churnkey.co/blog/involuntary-churn-benchmarks/)
- [Slicker: The $129B Problem — Recurly 2025 Involuntary Churn Forecast](https://www.slickerhq.com/blog/129-billion-problem-recurly-2025-involuntary-churn-forecast-ai-recovery-engines)
- [Slicker: Pay-for-Success Pricing Explained](https://www.slickerhq.com/blog/pay-for-success-pricing-slicker-vs-traditional-payment-recovery-fees-2025)
- [Churnbuster: Best Dunning Management Software 2026](https://churnbuster.io/articles/best-dunning-management-software)
- [Stunning: Failed Payment Recovery for Stripe](https://stunning.co/)
- [Gravy vs Churnbuster](https://churnbuster.io/versus/gravy-recover)
- [Vercel Next.js SaaS Starter](https://github.com/nextjs/saas-starter)
- [Next.js Subscription Payments (Vercel)](https://github.com/vercel/nextjs-subscription-payments)
- [Supabase: Handling Stripe Webhooks](https://supabase.com/docs/guides/functions/examples/stripe-webhooks)
- [Resend: Send emails with Next.js](https://resend.com/docs/send-with-nextjs)
- [Hookdeck vs Supabase Queues](https://hookdeck.com/blog/hookdeck-vs-supabase-queues)
- [B2B SaaS Churn Rate Benchmarks 2025](https://www.vitally.io/post/saas-churn-benchmarks)
- [Stripe Webhooks: Handling Payment Events](https://docs.stripe.com/webhooks/handling-payment-events)
- [Inngest + Resend: Transactional emails in Next.js](https://github.com/joelhooks/inngest-resend-example)
- [Slicker: Reduce Involuntary Churn Stripe SaaS 2025 Playbook](https://www.slickerhq.com/blog/reduce-involuntary-churn-stripe-saas-2025-playbook)
- [Baremetrics: Recover Failed Payments](https://baremetrics.com/blog/recover-failed-payments-save-lost-revenue)
