# Documento Requisiti: ChurnGuard MVP → Production-Ready

**Progetto:** ChurnGuard
**Versione:** 2.0
**Data:** 2026-03-04
**Stato:** Validato
**Autore:** Business Analyst (discovery con il team ChurnGuard)
**Fonte:** Intervista strutturata + analisi codebase MVP

---

## Indice

1. [Executive Summary](#1-executive-summary)
2. [Contesto e Obiettivi](#2-contesto-e-obiettivi)
3. [Gap Analysis MVP → Production](#3-gap-analysis-mvp--production)
4. [Stakeholder e Utenti](#4-stakeholder-e-utenti)
5. [Requisiti Funzionali](#5-requisiti-funzionali)
6. [Requisiti Non Funzionali](#6-requisiti-non-funzionali)
7. [Casi d'Uso Principali](#7-casi-duso-principali)
8. [Eccezioni e Edge Case](#8-eccezioni-e-edge-case)
9. [Modello Dati — Modifiche e Aggiunte](#9-modello-dati--modifiche-e-aggiunte)
10. [Vincoli Tecnologici](#10-vincoli-tecnologici)
11. [Priorità MoSCoW e Roadmap](#11-priorità-moscow-e-roadmap)
12. [Glossario](#12-glossario)

---

## 1. Executive Summary

ChurnGuard è un MVP funzionante che intercetta pagamenti falliti Stripe, li classifica e avvia sequenze di dunning automatizzate con email AI-personalizzate. Il core engine gira, ma mancano i livelli di affidabilità, sicurezza e monetizzazione necessari per operare in produzione con clienti paganti reali.

L'intervista di discovery ha identificato **tre priorità assolute** per il passaggio MVP → production-ready:

1. **Affidabilità del dunning engine** — retry automatici con backoff, alert su fallimenti, robustezza end-to-end
2. **Pagina di aggiornamento carta funzionante** — il link nelle email attualmente non porta da nessuna parte
3. **Billing ChurnGuard operativo** — i piani Starter/Growth devono essere reali, non hardcoded

Le funzionalità discusse producono **21 requisiti funzionali** (12 Must, 5 Should, 4 Could) e **8 requisiti non funzionali**.

---

## 2. Contesto e Obiettivi

### 2.1 Problema da risolvere nella fase attuale

L'MVP dimostra il concetto ma non è deployabile per clienti reali per questi motivi:

- Un job email che fallisce (Resend down, Claude API timeout) muore silenziosamente senza retry
- Il link nelle email di dunning punta a `/update-payment/[id]` che restituisce 404
- I clienti ChurnGuard non vengono addebitati — il billing è hardcoded e non funzionale
- La sicurezza multi-tenant è solo applicativa — nessuna RLS policy nel DB
- Il dashboard mostra dati del mese corrente senza storico, trend o notifiche

### 2.2 Obiettivi della fase production-ready

| Obiettivo | Metrica di successo |
|-----------|---------------------|
| Zero job persi per errori transitori | 0 job in stato `failed` definitivo per cause recuperabili (Resend/Claude down) |
| Subscriber possono aggiornare la carta | Click-to-payment < 3 step, tasso conversione link ≥ 15% |
| Clienti ChurnGuard vengono addebitati | 100% dei clienti attivi su piano Stripe reale |
| Sicurezza multi-tenant garantita a DB level | RLS attiva su tutte le tabelle, zero data leak tra org |
| Dashboard utile per decisioni | Trend 6 mesi + breakdown per decline type + notifiche real-time |

---

## 3. Gap Analysis MVP → Production

### 3.1 Tabella Gap

| Area | Stato MVP | Gap | Priorità |
|------|-----------|-----|----------|
| **Retry job falliti** | Nessun retry — job fallisce definitivamente | Manca logica retry con backoff + `retry_count` su `dunning_jobs` | Must |
| **Alert su job falliti** | Nessun alert — fallimento silenzioso | Manca email interna ChurnGuard + notifica in-app al cliente | Must |
| **Pagina update-payment** | URL nell'email porta a 404 | Manca l'intera route `/update-payment/[id]` + token management | Must |
| **Token sicuri per update-payment** | Token non implementato — URL usa `payment.id` raw | Manca tabella `payment_tokens` con scadenza 30gg | Must |
| **Billing ChurnGuard** | Badge "Starter" hardcoded, nessun addebito reale | Manca integrazione Stripe per piani Starter/Growth + Checkout | Must |
| **Grace period su piano scaduto** | Nessuna logica — engine gira sempre | Manca check piano attivo nel processor + grace period 7gg | Must |
| **RLS policies DB** | Sicurezza solo applicativa | Manca configurazione RLS Supabase su tutte le tabelle | Must |
| **Rate limiting webhook** | Nessun rate limit | Manca implementazione con Vercel KV | Must |
| **Branding cliente** | Solo `org.name` nell'email | Mancano campi `logo_url`, `brand_color` + UI upload nelle settings | Must |
| **Grafico trend mensile** | Solo KPI mese corrente | Manca query storica + componente grafico (Recharts/Chart.js) | Should |
| **Breakdown per decline type** | Nessun breakdown | Manca aggregazione per `decline_type` nel dashboard | Should |
| **Notifiche in-app real-time** | Nessuna notifica | Manca sistema notifiche (polling o Supabase Realtime) | Should |
| **Team management** | Nessuna UI | Manca invite/revoke membri nelle settings | Should |
| **Settings page dati reali** | Dati hardcoded | Deve leggere piano reale da Stripe + mostrare dati org reali | Should |
| **Unit test** | Zero copertura | Mancano test per decline classifier, scheduler, email generator | Could |
| **Integration test webhook** | Zero copertura | Manca test del flusso webhook → DB | Could |
| **Metriche aggregate usate** | `recovery_metrics` calcolate ma non usate nel dashboard | Dashboard usa query dirette invece della tabella aggregata | Could |
| **Cleanup webhook_events** | Tabella cresce senza limite | Retention policy (non prioritario per ora) | Won't |
| **Sequence customization** | Timing fisso hardcoded | Personalizzazione Day 0/3/7/10 nelle settings | Won't |
| **Piano percentage** | Non implementato | 8% del recovered — escluso da questo scope | Won't |
| **E2E testing** | Zero copertura | Test flusso completo webhook → dunning → recovery | Won't |

---

## 4. Stakeholder e Utenti

### 4.1 Stakeholder

| Ruolo | Responsabilità nel progetto |
|-------|----------------------------|
| **Founder ChurnGuard** | Decisioni di prodotto, priorità, go/no-go |
| **Team ChurnGuard (dev)** | Sviluppo, riceve alert interni su fallimenti critici |

### 4.2 Utenti del sistema

| Ruolo | Descrizione | Permessi |
|-------|-------------|----------|
| **Owner** | Founder/CTO della SaaS cliente | Full access: settings, billing, tutti i dati |
| **Admin** | Team operativo della SaaS cliente | Dashboard + settings (no billing) |
| **Viewer** | Finance/ops manager | Read-only dashboard |
| **Subscriber (end user)** | Cliente finale della SaaS cliente | Solo pagina update-payment (no auth richiesta) |

### 4.3 Volumi attesi

- Clienti ChurnGuard al go-live: 10-50 organizzazioni
- Pagamenti falliti per org/mese: 10-500
- Job dunning attivi simultanei: fino a 5.000
- Subscriber che accedono alla pagina update-payment: proporzionale ai pagamenti falliti

---

## 5. Requisiti Funzionali

### FR-001 — Retry automatico job falliti con backoff
**Priorità:** Must
**Area:** Dunning Engine — Affidabilità

**Descrizione:**
Quando un dunning job (email o retry Stripe) fallisce, il sistema deve ritentarlo automaticamente con una strategia di backoff esponenziale. Il job non viene eliminato ma ri-schedulato aggiornando `scheduled_at` e incrementando `retry_count`. Il cron orario lo riprende naturalmente.

**Comportamento dettagliato:**
- Tentativo 1 fallito → `scheduled_at = now + 1h`, `retry_count = 1`, `status = pending`
- Tentativo 2 fallito → `scheduled_at = now + 4h`, `retry_count = 2`, `status = pending`
- Tentativo 3 fallito → `scheduled_at = now + 24h`, `retry_count = 3`, `status = pending`
- Tentativo 4 fallito → `status = failed` definitivo, trigger alert (vedi FR-002)

**Modifiche al DB:**
Aggiungere colonna `retry_count INTEGER DEFAULT 0 NOT NULL` a `dunning_jobs`.

**Criteri di accettazione:**
- DATO un job email che fallisce per timeout Claude API, QUANDO il cron gira all'ora successiva, ALLORA il job viene ritentato (non è in stato `failed`)
- DATO un job che ha già `retry_count = 3`, QUANDO fallisce di nuovo, ALLORA lo status diventa `failed` definitivo e viene emesso un alert
- DATO un job ri-schedulato, QUANDO il suo `scheduled_at` è nel futuro, ALLORA il cron non lo processa finché non è scaduto il backoff

---

### FR-002 — Alert su job definitivamente falliti
**Priorità:** Must
**Area:** Dunning Engine — Affidabilità

**Descrizione:**
Quando un job raggiunge `retry_count = 3` e fallisce un'ultima volta, il sistema deve emettere due alert:
1. Email interna al team ChurnGuard (`alerts@churnguard.com`) con dettagli del job e dell'organizzazione
2. Notifica in-app visibile nel dashboard del cliente (banner o badge nella sidebar)

**Contenuto email interna:**
- Organization name e slug
- Job ID, tipo (email/retry), payment ID
- Customer email coinvolta
- Importo del pagamento
- Errore specifico dell'ultimo tentativo

**Contenuto notifica in-app:**
- Messaggio: "Un job di dunning non è stato completato per [customer_email] — importo [amount]. Contatta il supporto."
- Link al payment detail della transazione coinvolta

**Criteri di accettazione:**
- DATO un job con `retry_count = 3` che fallisce, QUANDO il processor lo marca `failed`, ALLORA viene inviata un'email a `alerts@churnguard.com` entro 5 minuti
- DATO lo stesso evento, ALLORA la notifica in-app appare nel dashboard del cliente al prossimo accesso (o in real-time se implementate le notifiche Supabase Realtime)
- DATO un job che fallisce ai tentativi 1, 2 o 3, ALLORA nessun alert viene emesso (solo ri-scheduling)

---

### FR-003 — Tabella notifiche in-app
**Priorità:** Must (prerequisito per FR-002 e FR-009)
**Area:** Infrastruttura notifiche

**Descrizione:**
Aggiungere tabella `notifications` al DB per memorizzare le notifiche in-app destinate agli utenti di una organizzazione.

**Schema:**
```
notifications
  id              UUID PK
  organization_id UUID FK organizations
  type            TEXT  -- 'job_failed' | 'payment_recovered' | 'plan_expired'
  title           TEXT
  body            TEXT
  read            BOOLEAN DEFAULT false
  metadata        JSONB  -- { job_id, payment_id, amount, customer_email }
  created_at      TIMESTAMPTZ
```

**Criteri di accettazione:**
- Le notifiche sono scoped per `organization_id` (RLS applicata)
- Un endpoint o Server Action permette di marcare una notifica come letta
- Il badge nella sidebar mostra il conteggio notifiche non lette

---

### FR-004 — Pagina pubblica aggiornamento carta
**Priorità:** Must
**Area:** Subscriber Experience

**Descrizione:**
Implementare la route pubblica `/update-payment/[token]` accessibile senza autenticazione. La pagina mostra il branding del cliente (nome, logo, colore primario), l'importo dovuto e uno Stripe Payment Element embedded per aggiornare il metodo di pagamento senza lasciare la pagina.

**Flusso:**
1. Subscriber riceve email con link `/update-payment/[token]`
2. Il sistema valida il token (esiste, non scaduto, non già usato)
3. La pagina carica: logo cliente, nome cliente, importo in lingua chiara, Stripe Payment Element
4. Subscriber inserisce nuova carta e conferma
5. Il sistema: aggiorna il payment method su Stripe, ritenta immediatamente l'invoice, marca il token come usato
6. Se il retry ha successo → pagina di conferma ("Grazie, il tuo accesso è stato ripristinato")
7. Se il retry fallisce → messaggio di errore con istruzioni per contattare il supporto

**Criteri di accettazione:**
- DATO un token valido, QUANDO il subscriber accede alla pagina, ALLORA vede il branding del cliente e l'importo corretto
- DATO un token scaduto (>30 giorni), QUANDO accede alla pagina, ALLORA vede un messaggio "Link scaduto" con invito a contattare il supporto
- DATO un token già usato, ALLORA stessa pagina di errore
- DATO che il subscriber aggiorna la carta con successo, ALLORA Stripe viene aggiornato e l'invoice viene rirtentata entro 60 secondi
- La pagina funziona senza JavaScript disabilitato (graceful degradation)

---

### FR-005 — Sistema token sicuri per update-payment
**Priorità:** Must
**Area:** Sicurezza subscriber

**Descrizione:**
I link nelle email non devono esporre l'ID interno del pagamento. Ogni email genera un token opaco (UUID v4) memorizzato nella tabella `payment_tokens` con scadenza 30 giorni.

**Schema:**
```
payment_tokens
  id              UUID PK
  token           TEXT UNIQUE NOT NULL  -- UUID v4 opaco
  failed_payment_id UUID FK failed_payments
  organization_id UUID FK organizations
  expires_at      TIMESTAMPTZ NOT NULL  -- created_at + 30 giorni
  used_at         TIMESTAMPTZ           -- null se non ancora usato
  created_at      TIMESTAMPTZ
```

**Regole:**
- Un token per email inviata (ogni job email crea un nuovo token)
- Il token precedente rimane valido finché non scade — il subscriber può usare sia il link del Day 0 che quello del Day 3
- Dopo l'uso (`used_at` valorizzato), il token non è più valido per ulteriori aggiornamenti carta
- Token non è mai esposto nei log applicativi

**Criteri di accettazione:**
- DATO un job email completato con successo, ALLORA un record `payment_tokens` viene creato con `expires_at = now + 30 giorni`
- DATO lo stesso pagamento che riceve email multiple, ALLORA ogni email ha il proprio token distinto
- DATO un token con `expires_at < now`, ALLORA la pagina update-payment lo rifiuta

---

### FR-006 — Branding cliente nella pagina update-payment
**Priorità:** Must
**Area:** Subscriber Experience / Personalizzazione

**Descrizione:**
La pagina `/update-payment/[token]` mostra il brand del cliente ChurnGuard, non il brand ChurnGuard. Il cliente può configurare logo e colore primario nelle settings.

**Campi da aggiungere a `organizations`:**
- `logo_url TEXT` — URL del logo caricato (storage Supabase o CDN)
- `brand_color TEXT` — colore esadecimale (es. `#3B82F6`), default `#000000`

**UI nelle Settings:**
- Upload logo (formati accettati: PNG, JPG, SVG — max 2MB)
- Color picker per il colore primario con preview in tempo reale
- Preview della pagina update-payment con i dati inseriti

**Criteri di accettazione:**
- DATO un cliente che ha configurato logo e brand color, QUANDO un subscriber accede alla pagina update-payment, ALLORA vede il logo del cliente e il colore primario corretto
- DATO un cliente senza logo configurato, ALLORA la pagina mostra solo il nome dell'azienda
- Il logo viene servito tramite CDN con caching appropriato

---

### FR-007 — Billing ChurnGuard: piani Starter e Growth
**Priorità:** Must
**Area:** Monetizzazione

**Descrizione:**
Implementare il billing reale di ChurnGuard tramite Stripe. Al momento del signup (o al completamento dell'onboarding), il cliente sceglie tra piano Starter ($49/mo) e Growth ($99/mo) e completa un Stripe Checkout. Il piano attivo viene memorizzato nel DB e mostrato nelle settings con dati reali.

**Piani:**

| Piano | Prezzo | Limiti |
|-------|--------|--------|
| Starter | $49/mo | Fino a 500 pagamenti falliti/mese tracciati |
| Growth | $99/mo | Pagamenti illimitati + analytics avanzate (cohort, breakdown) |

**Flusso signup:**
1. Utente completa onboarding wizard
2. Viene reindirizzato a pagina di selezione piano
3. Click su piano → Stripe Checkout (hosted)
4. Stripe conferma → webhook `invoice.payment_succeeded` per ChurnGuard stesso → attivazione piano
5. Redirect a dashboard con piano attivo

**Campi da aggiungere/modificare a `organizations`:**
- `stripe_customer_id_churnguard TEXT` — customer ID di ChurnGuard su Stripe (distinto da `stripe_account_id` del cliente)
- `stripe_subscription_id_churnguard TEXT` — subscription ID del piano ChurnGuard
- `plan_status TEXT` — `active | past_due | canceled | trialing`
- `plan_expires_at TIMESTAMPTZ` — data scadenza/rinnovo piano
- `plan` (esistente) — aggiornato automaticamente dai webhook

**Criteri di accettazione:**
- DATO un nuovo cliente che completa il Checkout Stripe, ALLORA `plan`, `plan_status`, `stripe_customer_id_churnguard` e `stripe_subscription_id_churnguard` vengono aggiornati nel DB
- DATO un cliente in settings, ALLORA vede il piano reale (non hardcoded), la data di rinnovo e un bottone "Upgrade" se è su Starter
- DATO un upgrade da Starter a Growth, ALLORA Stripe gestisce il prorating automaticamente

---

### FR-008 — Grace period e blocco engine su piano scaduto
**Priorità:** Must
**Area:** Monetizzazione / Affidabilità

**Descrizione:**
Se il pagamento del piano ChurnGuard fallisce, il cliente entra in un grace period di 7 giorni durante il quale il dunning engine continua a girare. Dopo 7 giorni senza rinnovo, il processor blocca tutti i nuovi job per quella organizzazione.

**Logica nel processor:**
- Prima di processare i job di un'organizzazione, verifica `plan_status` e `plan_expires_at`
- Se `plan_status = 'past_due'` e `plan_expires_at < now - 7 giorni` → salta tutti i job dell'org con log warning
- Se `plan_status = 'canceled'` → salta tutti i job dell'org
- Se `plan_status = 'active'` o `trialing` → processa normalmente

**Notifiche:**
- Al giorno 0 del past_due → notifica in-app all'owner: "Il tuo pagamento ChurnGuard non è andato a buon fine. Aggiorna il metodo di pagamento entro 7 giorni."
- Al giorno 6 → reminder: "Il tuo dunning engine si bloccherà domani."
- Al giorno 7 → blocco + notifica: "Il dunning engine è in pausa. Rinnova per riattivarlo."

**Criteri di accettazione:**
- DATO un'org con `plan_status = 'past_due'` da 6 giorni, QUANDO il cron gira, ALLORA i job vengono processati normalmente
- DATO un'org con `plan_status = 'past_due'` da 8 giorni, QUANDO il cron gira, ALLORA nessun job viene processato e viene loggato un warning
- DATO che il cliente rinnova il piano, ALLORA il processor riprende a girare entro 1h

---

### FR-009 — Notifiche in-app real-time
**Priorità:** Should
**Area:** Dashboard / UX

**Descrizione:**
Il dashboard mostra notifiche in tempo reale (o quasi) per eventi importanti: pagamento recuperato, job fallito definitivamente, piano in scadenza. Implementazione tramite Supabase Realtime sulla tabella `notifications`.

**Tipi di notifica:**

| Tipo | Trigger | Messaggio esempio |
|------|---------|-------------------|
| `payment_recovered` | `invoice.payment_succeeded` webhook | "Pagamento di $299 recuperato da John Smith" |
| `job_failed` | Job arriva a `retry_count = 3` e fallisce | "Impossibile inviare email a user@example.com dopo 3 tentativi" |
| `plan_past_due` | Webhook billing ChurnGuard | "Il tuo pagamento ChurnGuard non è andato a buon fine" |
| `plan_expiring` | 6 giorni dopo `past_due` | "Il dunning engine si bloccherà domani" |

**UI:**
- Badge con conteggio non letti nella sidebar
- Dropdown o panel notifiche accessibile dall'header
- Click su notifica → link alla pagina rilevante (payment detail, settings/billing)
- "Marca tutte come lette"

**Criteri di accettazione:**
- DATO un pagamento recuperato via webhook, QUANDO il subscriber dell'org è loggato nel dashboard, ALLORA la notifica appare entro 30 secondi senza ricaricare la pagina
- DATO una notifica non letta, ALLORA il badge nella sidebar mostra il numero corretto
- DATO che il cliente clicca su una notifica di tipo `payment_recovered`, ALLORA viene portato al detail di quel pagamento

---

### FR-010 — Grafico trend mensile MRR recovered
**Priorità:** Should
**Area:** Dashboard / Analytics

**Descrizione:**
Aggiungere al dashboard un grafico a barre o linee che mostra il MRR recovered e il recovery rate per gli ultimi 6 mesi. I dati vengono letti dalla tabella `recovery_metrics` (già popolata dal cron).

**Dati visualizzati per mese:**
- MRR recovered (in $)
- Recovery rate (%)
- Totale pagamenti falliti
- Totale recuperati

**Criteri di accettazione:**
- DATO un'organizzazione con storico di almeno 2 mesi, QUANDO accede al dashboard, ALLORA vede il grafico con i dati storici
- DATO un'organizzazione nuova (meno di 1 mese), ALLORA il grafico mostra solo il mese corrente senza errori
- Il grafico è responsivo e leggibile su mobile

---

### FR-011 — Breakdown per tipo di decline nel dashboard
**Priorità:** Should
**Area:** Dashboard / Analytics

**Descrizione:**
Aggiungere una sezione nel dashboard che mostra il breakdown dei pagamenti falliti per `decline_type` (soft/hard/SCA) con il relativo recovery rate per ciascuna categoria.

**Dati visualizzati:**

| Tipo | Falliti | Recuperati | Recovery Rate |
|------|---------|------------|---------------|
| Soft | N | N | X% |
| Hard | N | N | X% |
| SCA  | N | N | X% |

**Periodo:** mese corrente (coerente con gli altri KPI).

**Criteri di accettazione:**
- DATO un'org con pagamenti di tutti e tre i tipi, ALLORA vede il breakdown completo
- DATO un'org con solo soft declines, ALLORA mostra solo la riga soft senza errori sulle righe mancanti

---

### FR-012 — RLS policies Supabase su tutte le tabelle
**Priorità:** Must
**Area:** Sicurezza / Multi-tenancy

**Descrizione:**
Configurare Row Level Security in Supabase su tutte le tabelle che contengono dati scoped per organizzazione. La sicurezza deve essere garantita a livello DB, non solo applicativo.

**Tabelle da proteggere:**
- `failed_payments` — solo org dell'utente autenticato
- `dunning_jobs` — solo org dell'utente autenticato
- `recovery_metrics` — solo org dell'utente autenticato
- `webhook_events` — solo org dell'utente autenticato
- `notifications` — solo org dell'utente autenticato
- `payment_tokens` — accesso solo tramite service role (non autenticazione utente)
- `organizations` — l'utente vede solo la propria org
- `organization_members` — l'utente vede solo i membri della propria org

**Pattern RLS da usare:**
```sql
-- Helper function (SECURITY DEFINER per evitare loop)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS UUID LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Policy esempio per failed_payments
CREATE POLICY "org_isolation" ON failed_payments
  FOR ALL USING (organization_id = get_user_organization_id());
```

**Note:**
- Le Server Actions usano il Supabase admin client (service role) → bypass RLS per operazioni di sistema (cron, webhook handler)
- Le query dal frontend/dashboard usano il client autenticato → RLS applicata automaticamente

**Criteri di accettazione:**
- DATO due organizzazioni A e B, QUANDO un utente di A tenta di leggere i `failed_payments` di B (anche manipolando la query), ALLORA Supabase restituisce 0 risultati
- DATO il webhook handler (service role), ALLORA può scrivere su qualsiasi organizzazione
- Le RLS non impattano le performance delle query principali del dashboard (verificato con EXPLAIN ANALYZE)

---

### FR-013 — Rate limiting webhook con Vercel KV
**Priorità:** Must
**Area:** Sicurezza / Affidabilità

**Descrizione:**
Implementare rate limiting distribuito sull'endpoint `/api/webhooks/stripe` usando Vercel KV. Il limite è per organizzazione (slug), non per IP, perché i webhook arrivano sempre da IP Stripe.

**Limiti:**
- Max 1.000 request/minuto per organizzazione
- Max 10.000 request/ora per organizzazione
- Se il limite viene superato → risposta `429 Too Many Requests` (Stripe ri-proverà automaticamente)

**Implementazione:**
- Chiave KV: `webhook_rate:{org_slug}:{window}` dove window è il minuto/ora corrente
- Sliding window o fixed window (fixed window è accettabile per questo use case)
- Nessun impatto sulle performance del path normale (KV lookup < 5ms)

**Criteri di accettazione:**
- DATO un'org che invia 1.001 webhook nello stesso minuto, ALLORA la 1.001esima richiesta riceve `429`
- DATO un'org nei limiti, ALLORA il webhook viene processato normalmente senza overhead percepibile
- DATO un'org che raggiunge il limite, ALLORA dopo 1 minuto il contatore si azzera e accetta nuove richieste

---

### FR-014 — Settings page con dati reali
**Priorità:** Should
**Area:** UI / Settings

**Descrizione:**
La settings page attuale mostra dati hardcoded (badge "Starter", "$49/month" statici). Deve essere aggiornata per leggere e mostrare dati reali dall'DB e da Stripe.

**Sezioni da aggiornare:**

**Organization:**
- Campo `name` pre-compilato con il valore attuale dal DB
- Campo `resendDomain` pre-compilato con il valore attuale
- Nuovo: upload logo (FR-006)
- Nuovo: color picker brand color (FR-006)
- Preview pagina update-payment

**Stripe Integration:**
- Status reale della connessione (verifica che `stripe_webhook_secret` sia configurato)
- Mostra l'endpoint URL webhook per l'organizzazione (copiabile)
- Bottone "Test connessione" che invia un evento Stripe di test

**Billing:**
- Piano reale (letto da `organizations.plan` + `plan_status`)
- Data prossimo rinnovo (da `plan_expires_at`)
- Importo del piano
- Bottone "Upgrade to Growth" se su Starter
- Bottone "Manage Subscription" → Stripe Customer Portal

**Criteri di accettazione:**
- DATO un cliente su piano Starter, ALLORA vede "Starter — $49/month — Rinnovo il [data]"
- DATO un cliente che clicca "Upgrade to Growth", ALLORA viene portato a Stripe Checkout con piano Growth pre-selezionato
- DATO un cliente che clicca "Manage Subscription", ALLORA viene portato al Stripe Customer Portal

---

### FR-015 — Team management nelle settings
**Priorità:** Should
**Area:** UI / Settings / Multi-tenancy

**Descrizione:**
Permettere all'owner (e agli admin) di invitare nuovi membri del team e revocare l'accesso a quelli esistenti.

**Funzionalità:**
- Lista membri attuali con ruolo e data aggiunta
- Invita membro: inserisci email + seleziona ruolo (admin/viewer) → invia email invito tramite Supabase Auth
- Revoca accesso: rimuovi il record da `organization_members`
- Cambia ruolo: modifica `role` di un membro esistente

**Permessi:**
- Solo owner può gestire i membri (invitare, revocare, cambiare ruolo)
- Admin può visualizzare la lista ma non modificarla
- Viewer non vede la sezione team

**Criteri di accettazione:**
- DATO un owner che invita un nuovo membro, ALLORA il membro riceve un'email con magic link e al login viene associato all'organizzazione con il ruolo assegnato
- DATO un owner che revoca l'accesso a un viewer, ALLORA al prossimo tentativo di accesso al dashboard il viewer viene reindirizzato al login
- DATO un admin loggato nella settings, ALLORA vede la lista membri ma non i bottoni di gestione

---

### FR-016 — Unit test funzioni critiche
**Priorità:** Could
**Area:** Testing / Qualità

**Descrizione:**
Implementare unit test con Jest (o Vitest) per le tre funzioni più critiche del dunning engine.

**Funzioni da testare:**

1. `classifyDecline(code, message)` in `src/lib/stripe/decline-classifier.ts`
   - Test: ogni decline code Stripe mappa al tipo corretto (soft/hard/SCA)
   - Test: codice sconosciuto → default a `soft`
   - Test: `null` input → default a `soft`

2. `scheduleDunningJobs(payment)` in `src/lib/dunning/scheduler.ts`
   - Test: soft decline → 5 job creati (4 email + 1 retry) con timing corretto
   - Test: hard decline → 1 job creato (1 email Day 0)
   - Test: SCA → 2 job creati (2 email)
   - Test: `scheduled_at` corretto per ogni `dayOffset`

3. `getStaticTemplate(ctx)` in `src/lib/email/templates.ts`
   - Test: ogni combinazione attempt/decline type restituisce template corretto
   - Test: amount formattato correttamente in USD
   - Test: `customerName` opzionale non causa errori

**Criteri di accettazione:**
- Tutti i test passano con `npm test`
- Coverage ≥ 80% sulle tre funzioni
- I test non fanno chiamate HTTP reali (mock di Stripe/Claude/Resend)

---

### FR-017 — Integration test webhook handler
**Priorità:** Could
**Area:** Testing / Qualità

**Descrizione:**
Implementare integration test per il webhook handler che verificano l'intero flusso dal ricevimento dell'evento Stripe alla scrittura nel DB.

**Scenari da testare:**

1. `invoice.payment_failed` con soft decline
   - Input: evento Stripe simulato con firma valida
   - Expected: record in `failed_payments` + 5 job in `dunning_jobs`

2. `invoice.payment_failed` con hard decline
   - Expected: record in `failed_payments` + 1 job in `dunning_jobs`

3. `invoice.payment_succeeded` dopo un fallimento
   - Expected: `failed_payments.status = 'recovered'` + tutti i job `cancelled`

4. Evento duplicato (stesso `stripe_event_id`)
   - Expected: risposta `{ received: true, duplicate: true }`, nessun record duplicato

5. Firma Stripe non valida
   - Expected: risposta `400`

**Setup:** DB di test isolato (Supabase local via Docker o test schema separato).

**Criteri di accettazione:**
- Tutti i test passano in CI
- I test usano un DB di test, non il DB di produzione
- Il webhook secret usato nei test è una variabile d'ambiente di test

---

### FR-018 — Stripe Customer Portal per self-service billing
**Priorità:** Should
**Area:** Billing / UX

**Descrizione:**
Integrare Stripe Customer Portal per permettere ai clienti ChurnGuard di gestire autonomamente il proprio abbonamento (upgrade, downgrade, aggiornamento carta di pagamento ChurnGuard, download fatture) senza dover contattare il supporto.

**Implementazione:**
- Server Action `createPortalSession()` che usa `stripe.billingPortal.sessions.create()`
- Redirect al portal Stripe e ritorno alla settings page al termine
- Configurare nel Stripe Dashboard le azioni permesse nel portal (upgrade a Growth, cancellazione, aggiornamento carta)

**Criteri di accettazione:**
- DATO un cliente che clicca "Manage Subscription" nelle settings, ALLORA viene reindirizzato al Stripe Customer Portal con la sua sessione già autenticata
- DATO che il cliente modifica il piano nel portal, ALLORA il webhook di Stripe aggiorna `organizations.plan` e `plan_status` nel DB
- DATO che il cliente scarica una fattura nel portal, ALLORA può farlo senza assistenza

---

### FR-019 — Pagina di conferma post-aggiornamento carta
**Priorità:** Must
**Area:** Subscriber Experience

**Descrizione:**
Dopo che il subscriber aggiorna la carta nella pagina `/update-payment/[token]`, deve vedere chiaramente l'esito dell'operazione.

**Scenari:**

1. **Successo** (Stripe conferma il pagamento):
   - Messaggio: "Grazie! Il tuo pagamento è stato elaborato con successo. Il tuo accesso a [Company Name] è stato ripristinato."
   - Nessun link di navigazione (pagina standalone, il subscriber non ha un account ChurnGuard)

2. **Errore carta** (Stripe rifiuta la nuova carta):
   - Messaggio: "La carta inserita non è stata accettata. Prova con un altro metodo di pagamento."
   - Il Payment Element rimane visibile per riprovare

3. **Errore sistema** (timeout, errore interno):
   - Messaggio: "Si è verificato un problema tecnico. Per favore contatta [company support email] per assistenza."

**Criteri di accettazione:**
- DATO un pagamento andato a buon fine, ALLORA il subscriber vede la pagina di successo e il dunning engine cancella i job rimanenti
- DATO una carta rifiutata, ALLORA il subscriber può riprovare senza ricaricare la pagina
- DATO un errore di sistema, ALLORA il token rimane valido per un nuovo tentativo

---

### FR-020 — Onboarding: selezione piano prima del go-live
**Priorità:** Must
**Area:** Onboarding / Billing

**Descrizione:**
Il wizard di onboarding attuale ha 3 step e porta direttamente al dashboard senza passare per la selezione del piano. Aggiungere uno step (o una pagina separata post-onboarding) per la selezione del piano Starter/Growth e completamento del Checkout Stripe prima di attivare il dunning engine.

**Nuovo flusso onboarding:**
1. Step 1: Connetti Stripe (webhook secret) — invariato
2. Step 2: Configura email (dominio) — invariato
3. Step 3: Scegli piano (Starter $49 / Growth $99) → Stripe Checkout
4. Step 4 (ex Step 3): Go Live — solo dopo conferma pagamento

**Gestione pagamento non completato:**
- Se l'utente abbandona il Checkout Stripe, rimane nello step 3
- Il dunning engine non viene attivato finché `plan_status != 'active'`

**Criteri di accettazione:**
- DATO un nuovo utente che completa il Checkout Stripe, ALLORA `onboarding_completed` viene impostato a `true` e il dunning engine è attivo
- DATO un utente che abbandona il Checkout, ALLORA al login successivo torna allo step di selezione piano
- DATO un utente con `onboarding_completed = false` e `plan_status != 'active'`, ALLORA viene reindirizzato all'onboarding, non al dashboard

---

### FR-021 — Uso tabella recovery_metrics nel dashboard
**Priorità:** Could
**Area:** Performance / Dashboard

**Descrizione:**
Il dashboard attualmente esegue query dirette su `failed_payments` ad ogni caricamento. La tabella `recovery_metrics` viene aggiornata ogni ora dal cron ma non viene letta. Cambiare il dashboard per leggere da `recovery_metrics` (più veloce, pre-aggregato) e usare le query dirette solo per i dati real-time del giorno corrente.

**Criteri di accettazione:**
- DATO un'org con 10.000 pagamenti storici, ALLORA il dashboard carica in < 1 secondo
- I KPI del mese corrente continuano a mostrare dati aggiornati (al massimo 1h di ritardo è accettabile)

---

## 6. Requisiti Non Funzionali

| ID | Categoria | Requisito | Metrica |
|----|-----------|-----------|---------|
| NFR-001 | Performance | Webhook endpoint risponde in < 200ms | 99° percentile su Vercel Analytics |
| NFR-002 | Performance | Dashboard carica in < 2s | LCP su connessione LTE, 95° percentile |
| NFR-003 | Performance | Email Day 0 inviata entro 5 minuti dal fallimento | `dunning_jobs.executed_at - failed_payments.created_at` mediana |
| NFR-004 | Affidabilità | Zero job persi per errori transitori recuperabili | 0 job `failed` definitivo per errori Resend/Claude con servizio tornato online |
| NFR-005 | Affidabilità | Idempotenza garantita su tutti gli eventi Stripe | 0 duplicati in `failed_payments` per stesso `stripe_event_id` |
| NFR-006 | Sicurezza | Isolamento dati multi-tenant a livello DB | RLS Supabase attiva, 0 data leak verificabili via penetration test manuale |
| NFR-007 | Sicurezza | Token update-payment opachi e con scadenza | Token UUID v4, scadenza 30gg, 0 esposizione ID interno |
| NFR-008 | Sicurezza | Rate limiting webhook distribuito | Max 1.000 req/min per org, risposta 429 oltre soglia |
| NFR-009 | Sicurezza | Segreti mai nel codice o nei log | 0 occorrenze di chiavi API in git history o output log |
| NFR-010 | Scalabilità | Sistema funzionante fino a 500 organizzazioni attive | Nessuna degradazione performance con 500 org e 250.000 `failed_payments` |
| NFR-011 | Compliance | GDPR: dati subscriber trattati come data processor | DPA disponibile, dati non usati per scopi diversi dal dunning |
| NFR-012 | Usabilità | Onboarding completabile in < 10 minuti da un founder tecnico | Misurato con test utente su campione di 5 persone |

---

## 7. Casi d'Uso Principali

### UC-01: Pagamento fallito → Recovery completo

```
ATTORI: Sistema Stripe (cliente), ChurnGuard Engine, Subscriber (end user)

PRECONDIZIONI: Organizzazione attiva con piano ChurnGuard pagato, webhook configurato

FLUSSO PRINCIPALE:
1. Stripe del cliente emette invoice.payment_failed
2. ChurnGuard riceve il webhook, verifica firma, controlla idempotency
3. Classifica il decline (soft/hard/SCA)
4. Inserisce record in failed_payments
5. Schedula i job dunning appropriati
6. Cron ora successiva: processa job email Day 0
7. Genera token opaco, salva in payment_tokens
8. Genera email AI-personalizzata con Claude API
9. Invia email via Resend con link /update-payment/[token]
10. Subscriber riceve email, clicca link
11. Pagina update-payment carica con branding cliente
12. Subscriber inserisce nuova carta → Stripe Payment Element
13. ChurnGuard ritenta invoice → successo
14. Webhook invoice.payment_succeeded arriva a ChurnGuard
15. Tutti i job pendenti cancellati, status = 'recovered'
16. Notifica in-app "Pagamento di $X recuperato" appare nel dashboard

FLUSSO ALTERNATIVO (email fallisce):
6a. Job email va in errore (Resend down)
6b. retry_count incrementato, scheduled_at = now + 1h, status = pending
6c. Cron ora successiva riprova
6d. Se retry_count = 3 e fallisce ancora: alert email + notifica in-app

POSTCONDIZIONI: failed_payments.status = 'recovered', tutti i dunning_jobs = 'done' o 'cancelled'
```

---

### UC-02: Subscriber accede a link scaduto

```
ATTORI: Subscriber (end user)

PRECONDIZIONI: Token nella tabella payment_tokens con expires_at < now

FLUSSO:
1. Subscriber clicca link da email vecchia (> 30 giorni)
2. Sistema valida token → expires_at scaduto
3. Pagina mostra: "Questo link è scaduto. Per assistenza contatta [support email]."
4. Nessuna azione possibile dalla pagina

POSTCONDIZIONI: Nessuna modifica al DB
```

---

### UC-03: Cliente ChurnGuard non paga il proprio piano

```
ATTORI: Stripe (ChurnGuard billing), ChurnGuard Engine, Owner organizzazione

PRECONDIZIONI: Organizzazione con piano attivo

FLUSSO:
1. Stripe emette invoice.payment_failed per ChurnGuard (non per il cliente)
2. Webhook aggiorna organizations.plan_status = 'past_due'
3. Notifica in-app all'owner: "Aggiorna il tuo metodo di pagamento entro 7 giorni"
4. Engine continua a girare normalmente per 7 giorni
5. Al giorno 6: reminder notifica in-app
6. Al giorno 7: plan_status controlla blocca il processor per questa org
7. Tutti i job vengono saltati con log warning
8. Owner clicca su notifica → Stripe Customer Portal → aggiorna carta
9. Stripe emette invoice.payment_succeeded → plan_status = 'active'
10. Al prossimo giro del cron, i job tornano a essere processati

POSTCONDIZIONI: Nessun job perso (solo ritardato), org torna operativa al rinnovo
```

---

### UC-04: Invito nuovo membro del team

```
ATTORI: Owner organizzazione

PRECONDIZIONI: Owner loggato nelle settings

FLUSSO:
1. Owner va in Settings → Team
2. Inserisce email del nuovo membro, seleziona ruolo (admin o viewer)
3. ChurnGuard invia magic link via Supabase Auth
4. Nuovo membro clicca link nell'email → viene autenticato
5. Al primo login, viene associato all'organizzazione con il ruolo assegnato
6. Il nuovo membro vede il dashboard dell'organizzazione

FLUSSO ALTERNATIVO (email già usata):
3a. L'email è già registrata su ChurnGuard con un'altra organizzazione
3b. Messaggio di errore: "Questo utente è già associato a un'altra organizzazione"

POSTCONDIZIONI: Nuovo record in organization_members con ruolo corretto
```

---

## 8. Eccezioni e Edge Case

### 8.1 Dunning Engine

| Scenario | Comportamento atteso |
|----------|---------------------|
| Claude API irraggiungibile (timeout) | Fallback immediato a template statico — nessun retry necessario per questo specifico errore |
| Resend risponde 429 (rate limit) | Job va in errore → retry con backoff (trattato come errore normale) |
| Invoice Stripe già pagata al momento del retry | Stripe restituisce errore "invoice already paid" → processRetryJob lo tratta come successo, aggiorna status a `recovered` |
| Subscriber cancella la subscription DURANTE il dunning (prima che il pagamento sia recuperato) | `customer.subscription.deleted` arriva → tutti i job cancellati, status = `hard_churn` |
| Stesso pagamento fallisce più volte in rapida successione | Idempotency su `stripe_event_id` previene duplicati in `failed_payments` |
| Cron job viene invocato due volte in contemporanea (Vercel edge) | Il campo `status = 'executing'` sul job previene doppia esecuzione (race condition parzialmente mitigata — da valutare con SELECT FOR UPDATE o advisory lock) |
| Organizzazione eliminata mentre job sono in pending | `ON DELETE CASCADE` su `dunning_jobs.organization_id` elimina automaticamente i job |

### 8.2 Pagina Update-Payment

| Scenario | Comportamento atteso |
|----------|---------------------|
| Subscriber usa il link del Day 0 dopo aver già aggiornato la carta con il link del Day 3 | Il token del Day 0 è ancora valido (non `used_at`) ma il pagamento è già `recovered` → pagina mostra "Il tuo pagamento è già stato recuperato, grazie!" |
| Stripe Payment Element fallisce per problemi di rete | Errore inline nel Payment Element, il subscriber può riprovare |
| Lo stesso subscriber apre il link in due tab simultaneamente | Il secondo tentativo di pagamento riceve errore Stripe "already paid" → trattato come successo |
| Token valido ma `failed_payment` già in stato `hard_churn` | Pagina mostra "Questo pagamento non è più attivo. Per riattivare il tuo account contatta [support]." |

### 8.3 Billing ChurnGuard

| Scenario | Comportamento atteso |
|----------|---------------------|
| Cliente completa Checkout ma il webhook `invoice.payment_succeeded` ritarda | Durante l'attesa, il cliente vede "Verifica pagamento in corso..." — polling sullo status ogni 5s per max 2 minuti |
| Cliente downgrade da Growth a Starter (via Customer Portal) | Stripe gestisce il prorating, webhook aggiorna `organizations.plan = 'starter'` |
| Cliente prova ad accedere al dashboard durante il blocco (grace period scaduto) | Dashboard visibile in read-only con banner prominente "Il tuo dunning engine è in pausa — Rinnova ora" |

### 8.4 Rate Limiting

| Scenario | Comportamento atteso |
|----------|---------------------|
| Stripe re-invia webhook perché non ha ricevuto risposta 200 nei tempi | L'idempotency check su `stripe_event_id` previene doppia elaborazione — non conta come nuovo evento per il rate limit |
| Vercel KV irraggiungibile | Fail open: il webhook viene processato senza rate limiting, con log warning. Non bloccare i webhook per un problema infrastrutturale |

---

## 9. Modello Dati — Modifiche e Aggiunte

### 9.1 Tabelle modificate

**`dunning_jobs`** — aggiungere colonna:
```sql
retry_count INTEGER DEFAULT 0 NOT NULL
```

**`organizations`** — aggiungere colonne:
```sql
logo_url                        TEXT,
brand_color                     TEXT DEFAULT '#000000',
stripe_customer_id_churnguard   TEXT,
stripe_subscription_id_churnguard TEXT,
plan_status                     TEXT DEFAULT 'trialing',  -- active | past_due | canceled | trialing
plan_expires_at                 TIMESTAMPTZ
```

### 9.2 Tabelle nuove

**`payment_tokens`:**
```sql
CREATE TABLE payment_tokens (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token             TEXT UNIQUE NOT NULL,
  failed_payment_id UUID REFERENCES failed_payments(id) ON DELETE CASCADE NOT NULL,
  organization_id   UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  expires_at        TIMESTAMPTZ NOT NULL,
  used_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX token_lookup_idx ON payment_tokens(token);
```

**`notifications`:**
```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  type            TEXT NOT NULL,  -- 'job_failed' | 'payment_recovered' | 'plan_past_due' | 'plan_expiring'
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  read            BOOLEAN DEFAULT false NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX notifications_org_unread_idx ON notifications(organization_id, read, created_at DESC);
```

### 9.3 Migrazioni richieste

1. `add_retry_count_to_dunning_jobs.sql`
2. `add_branding_and_billing_to_organizations.sql`
3. `create_payment_tokens.sql`
4. `create_notifications.sql`
5. `add_rls_policies.sql` (per tutte le tabelle)

---

## 10. Vincoli Tecnologici

| Vincolo | Dettaglio |
|---------|-----------|
| **Framework** | Next.js App Router (TypeScript) — invariato |
| **DB + Auth** | Supabase (PostgreSQL + RLS + Realtime) — invariato |
| **ORM** | Drizzle ORM — invariato, tutte le nuove tabelle devono avere schema Drizzle |
| **Payments** | Stripe — invariato. Nessun altro gateway in scope |
| **Email** | Resend — invariato |
| **AI** | Anthropic SDK `claude-sonnet-4-6` — invariato, con fallback template |
| **Deployment** | Vercel — invariato. Cron via Vercel Cron Jobs |
| **Rate limiting** | Vercel KV (nuovo) — da aggiungere alle env variables |
| **Grafici dashboard** | Recharts (preferito, già compatibile con shadcn/ui) o Chart.js |
| **Test framework** | Vitest (preferito per compatibilità Next.js/ESM) o Jest |
| **Storage logo** | Supabase Storage (già disponibile nell'infrastruttura) |
| **Stripe Payment Element** | Stripe.js v3 con `@stripe/react-stripe-js` |

---

## 11. Priorità MoSCoW e Roadmap

### Must Have (blocca il go-live)

| ID | Requisito | Dipendenze |
|----|-----------|------------|
| FR-001 | Retry automatico job falliti con backoff | — |
| FR-002 | Alert su job definitivamente falliti | FR-001, FR-003 |
| FR-003 | Tabella notifiche in-app | — |
| FR-004 | Pagina pubblica aggiornamento carta | FR-005, FR-006 |
| FR-005 | Sistema token sicuri | — |
| FR-006 | Branding cliente (logo + colore) | — |
| FR-007 | Billing ChurnGuard Starter/Growth | FR-020 |
| FR-008 | Grace period e blocco engine | FR-007 |
| FR-012 | RLS policies Supabase | — |
| FR-013 | Rate limiting webhook Vercel KV | — |
| FR-019 | Pagina conferma post-aggiornamento carta | FR-004 |
| FR-020 | Onboarding: selezione piano | FR-007 |

### Should Have (importante, ma non blocca il go-live)

| ID | Requisito | Dipendenze |
|----|-----------|------------|
| FR-009 | Notifiche in-app real-time | FR-003 |
| FR-010 | Grafico trend mensile | — |
| FR-011 | Breakdown per decline type | — |
| FR-014 | Settings page con dati reali | FR-006, FR-007 |
| FR-015 | Team management | — |
| FR-018 | Stripe Customer Portal | FR-007 |

### Could Have (valore aggiunto, se c'è tempo)

| ID | Requisito | Dipendenze |
|----|-----------|------------|
| FR-016 | Unit test funzioni critiche | — |
| FR-017 | Integration test webhook | — |
| FR-021 | Uso tabella recovery_metrics nel dashboard | — |

### Won't Have (escluso da questo scope)

| ID | Requisito | Motivo esclusione |
|----|-----------|-------------------|
| — | Piano percentage (8% recovered) | Complessità billing granulare, basso ROI immediato |
| — | Sequence customization (timing personalizzabile) | Backlog v1.1 come da PRD |
| — | E2E testing | Backlog, priorità a unit + integration |
| — | Retention policy webhook_events | Non urgente, costi storage trascurabili |
| — | Win-back campaign | Backlog v1.1 |
| — | Cohort analytics | Backlog v1.1 |
| — | Stripe Connect OAuth | Backlog v1.1 |

---

## 12. Glossario

| Termine | Definizione |
|---------|-------------|
| **Dunning** | Processo di contatto sistematico di un debitore per recuperare un pagamento scaduto |
| **Soft decline** | Rifiuto del pagamento temporaneo (fondi insufficienti, limite raggiunto) — il retry ha senso |
| **Hard decline** | Rifiuto del pagamento permanente (carta rubata, account chiuso) — nessun retry, serve nuova carta |
| **SCA** | Strong Customer Authentication — autenticazione aggiuntiva richiesta dalla banca (PSD2 Europa) |
| **Dunning job** | Unità di lavoro schedulata: può essere un'email o un retry di pagamento |
| **Recovery rate** | Percentuale di pagamenti falliti che vengono successivamente recuperati |
| **MRR recovered** | Monthly Recurring Revenue recuperato dal dunning engine nel mese |
| **Grace period** | Periodo di tolleranza (7 giorni) dopo il mancato pagamento del piano ChurnGuard, durante il quale l'engine continua a girare |
| **Token opaco** | Identificatore casuale (UUID v4) che non rivela informazioni interne del sistema |
| **Payment Element** | Componente UI di Stripe che gestisce l'inserimento sicuro dei dati di pagamento (PCI-compliant) |
| **RLS** | Row Level Security — funzionalità PostgreSQL che limita l'accesso alle righe in base all'utente autenticato |
| **Backoff esponenziale** | Strategia di retry che aumenta progressivamente l'intervallo tra i tentativi (1h, 4h, 24h) |
| **Branding cliente** | Personalizzazione visuale (logo, colore primario) dell'organizzazione cliente che appare nella pagina update-payment |
| **Org slug** | Identificatore URL-safe dell'organizzazione (es. `my-saas`) usato nel webhook endpoint |
| **Vercel KV** | Redis-compatible key-value store distribuito di Vercel, usato per rate limiting |
| **Supabase Realtime** | Funzionalità Supabase che propaga in WebSocket le modifiche al DB in tempo reale |

---

*Documento generato il 2026-03-04 — Discovery completata con il team ChurnGuard*
*Prossimo step: handoff al Tech Lead per stima effort e pianificazione sprint*
