---
allowed-tools: Task, Bash(gh:*), Read, Write, Edit, Glob, Grep, TodoWrite, AskUserQuestion
argument-hint: <project description>
description: Complete project analysis (BA → Tech Lead) with GitHub output. Orchestrates Business Analyst and Tech Lead agents in sequence.
---

# Plan Project Command

## User Request
$ARGUMENTS

---

## IF NO INPUT SPECIFIED

If `$ARGUMENTS` is empty or doesn't contain a specific project description:
1. Ask the user what project they need to analyze
2. Use AskUserQuestion to gather initial context
3. Proceed with the analysis once you have enough information

---

## MANDATORY RULES

### 1. GitHub CLI is REQUIRED
- This command uses GitHub Issues for task tracking via `gh` CLI
- **PHASE 0** verifies `gh` CLI availability before proceeding

### 2. Documentation is the Contract
- BA writes DETAILED documentation to `docs/requirements/` at the END of analysis
- This documentation is the "contract" for Tech Lead
- Documentation path is passed to Tech Lead for reliability

### 3. User Confirmation at Checkpoints
- **CHECKPOINT 1**: After BA analysis, before Tech Lead
- **CHECKPOINT 2**: After Tech Lead plan, before issue creation
- Never proceed without explicit user approval

### 4. Mandatory Agent Usage
- **ALWAYS** use `business-analyst` agent for PHASE 1
- **ALWAYS** use `tech-lead` agent for PHASE 2

#### Available Agents:

| Agent | Use Case |
|-------|----------|
| `business-analyst` | Requirements discovery, interview, MoSCoW prioritization, local documentation |
| `tech-lead` | Technical validation, architecture, task breakdown, GitHub Issue creation |

---

## EXECUTION PHASES

### PHASE 0: Prerequisites Verification

**MANDATORY: Verify GitHub CLI before proceeding!**

#### 0.1 Check GitHub CLI Availability
Verify that `gh` CLI is available and authenticated:
```bash
gh auth status
```

#### 0.2 If `gh` is NOT configured

**STOP and inform the user:**

```
⚠️ GITHUB CLI NON CONFIGURATO

Questo comando richiede GitHub CLI per creare issues.

Per configurare:
1. Installa gh: brew install gh
2. Autenticati: gh auth login
3. Riavvia Claude Code

Dopo la configurazione, esegui nuovamente /plan-project
```

**DO NOT proceed to PHASE 1 without working `gh` CLI!**

#### 0.3 If `gh` is Configured
Proceed to PHASE 1.

---

### PHASE 1: Business Analysis

#### 1.1 Launch Business Analyst Agent

Use **Task tool** with:
- `subagent_type`: `general-purpose`
- Agent: `@business-analyst`

**Prompt for the agent:**
```
Sei il Business Analyst per questo progetto.

Descrizione iniziale del progetto:
$ARGUMENTS

ISTRUZIONI:
1. Analizza la descrizione iniziale
2. Conduci un'intervista adattiva per raccogliere tutti i requisiti
3. Fai domande fino a raggiungere il 98% di comprensione
4. AL TERMINE dell'analisi, SCRIVI la documentazione in `docs/requirements/`:
   - Un DOCUMENTO DETTAGLIATO con TUTTI i requisiti raccolti
   - Un riepilogo nel file principale

Il documento DEVE contenere:
- Requisiti funzionali
- Requisiti non funzionali
- Casi d'uso principali
- Eccezioni e edge case
- Priorità MoSCoW (Must/Should/Could/Won't)
- Vincoli (tecnologie, integrazioni, deadline)
- Glossario termini di dominio

OUTPUT RICHIESTO:
Alla fine, fornisci:
- Path del documento creato (docs/requirements/)
- Riepilogo di quanto raccolto
```

#### 1.2 Collect BA Output

From BA agent output, extract:
- **Doc path**: Path to requirements document in `docs/requirements/`
- **Summary**: Brief summary of what was collected

---

### CHECKPOINT 1: User Confirmation

**MANDATORY: Get user confirmation before proceeding to Tech Lead!**

Present to user:

```
📋 RIEPILOGO ANALISI BUSINESS ANALYST

Doc: [doc_path]

Il Business Analyst ha raccolto i seguenti requisiti:

[Summary from BA output]

📝 La documentazione dettagliata è stata salvata in docs/requirements/.

---

Vuoi procedere con l'analisi tecnica del Tech Lead?
- Se SÌ: procederò a passare la documentazione al Tech Lead
- Se NO: il BA può correggere/integrare l'analisi
```

Use **AskUserQuestion** to get confirmation:
- Options: "Sì, procedi con Tech Lead" / "No, il BA deve correggere"
- If NO: Return to BA for corrections, then present summary again
- If SÌ: Proceed to PHASE 2

---

### PHASE 2: Technical Planning

#### 2.1 Launch Tech Lead Agent

Use **Task tool** with:
- `subagent_type`: `general-purpose`
- Agent: `@tech-lead`

**Prompt for the agent:**
```
Sei il Tech Lead per questo progetto.

RIFERIMENTI DOCUMENTAZIONE:
- Doc path: [doc_path from PHASE 1]

ISTRUZIONI:
1. LEGGI la documentazione dettagliata (docs/requirements/)
2. Valida tecnicamente i requisiti
3. Fai domande tecniche se necessario
4. Proponi architettura e piano operativo
5. Prepara la creazione di GitHub Issues (NON crearle ancora!)

OUTPUT RICHIESTO:
Alla fine, fornisci:
- Validazione tecnica dei requisiti
- Architettura proposta
- Piano operativo con milestone
- Struttura Issue proposta (Backend + Frontend)
- Eventuali rischi e mitigazioni

NON creare ancora le issue su GitHub - attendi conferma dell'utente.
```

#### 2.2 Collect Tech Lead Output

From Tech Lead agent output, extract:
- **Technical validation**: Any gaps or issues
- **Architecture**: Proposed architecture
- **Task structure**: Epic and subtasks breakdown

---

### CHECKPOINT 2: User Confirmation

**MANDATORY: Get user confirmation before creating tasks!**

Present to user:

```
🏗️ PIANO TECNICO DEL TECH LEAD

Validazione Tecnica:
[Technical validation summary]

Architettura Proposta:
[Architecture summary]

Struttura Task Proposta:

EPIC: [Epic title]
├── Backend:
│   ├── [Subtask 1]
│   ├── [Subtask 2]
│   └── [...]
└── Frontend:
    ├── [Subtask 1]
    ├── [Subtask 2]
    └── [...]

---

Vuoi che il Tech Lead crei queste issue su GitHub?
- Se SÌ: creerò le issue dettagliate
- Se NO: il Tech Lead rivede il piano
```

Use **AskUserQuestion** to get confirmation:
- Options: "Sì, crea le issue" / "No, rivedi il piano"
- If NO: Return to Tech Lead for revision
- If SÌ: Proceed to PHASE 3

---

### PHASE 3: Issue Creation

#### 3.1 Create GitHub Issues

Use **Task tool** with Tech Lead agent to:
- Create parent issue (Epic) on GitHub
- Create Backend issues with checklist
- Create Frontend issues with checklist
- Save architecture document in `docs/architecture/`

```bash
# Create issues
gh issue create --title "<title>" --label "<labels>" --body "<body>"
```

#### 3.2 Confirm Creation

Present to user:

```
✅ ISSUE CREATE SU GITHUB

Issue Backend: [N] issue create
Issue Frontend: [N] issue create
Documento architettura: docs/architecture/

---

📌 Prossimi passi:
1. Rivedi le issue su GitHub
2. Assegna priorità e responsabili
3. Usa /create per iniziare lo sviluppo di ogni issue
```

---

## WORKFLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                    /plan-project WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│  FASE 0: VERIFICA PREREQUISITI                                  │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  1. Verifica se GitHub CLI è configurato                         │
│  2. Se NON configurato:                                         │
│     - Avvisa l'utente                                           │
│     - Guida nella configurazione gh CLI                         │
│     - STOP: comando non può proseguire senza gh CLI             │
│  3. Se configurato → Procedi                                    │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│  FASE 1: BUSINESS ANALYST                                       │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  1. Riceve descrizione iniziale                                 │
│  2. Intervista interattiva (domande adattive)                   │
│  3. Raccoglie requisiti fino a 98% comprensione                 │
│  4. AL TERMINE DELL'ANALISI, SCRIVE in docs/requirements/:      │
│     - Documento DETTAGLIATO con TUTTI i requisiti raccolti      │
│       (funzionali, non funzionali, eccezioni, priorità MoSCoW)  │
│  5. Mostra RIEPILOGO all'utente                                 │
│  6. CHIEDE CONFERMA per procedere                               │
│                                                                  │
│  OUTPUT OBBLIGATORIO:                                           │
│  - Path documento (docs/requirements/)                          │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│  CHECKPOINT 1: Conferma utente                                  │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Se NO → BA corregge/integra → Nuovo riepilogo                  │
│  Se SÌ → Passa doc path a Tech Lead                             │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│  FASE 2: TECH LEAD                                              │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  1. LEGGE documentazione DETTAGLIATA (docs/requirements/)       │
│     (riceve doc path dal checkpoint precedente)                 │
│  2. Valida tecnicamente i requisiti                             │
│  3. Domande tecniche (se necessarie)                            │
│  4. Propone architettura e piano operativo                      │
│  5. Mostra RIEPILOGO TECNICO all'utente                         │
│  6. CHIEDE CONFERMA per creare task                             │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│  CHECKPOINT 2: Conferma utente                                  │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  Se NO → Tech Lead rivede il piano                              │
│  Se SÌ → Procedi con creazione issue                            │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│  FASE 3: CREAZIONE ISSUE                                        │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
│  OUTPUT:                                                         │
│  - Issue Backend su GitHub                                      │
│  - Issue Frontend su GitHub                                     │
│  - Documento architettura locale                                │
│                                                                  │
│  ══════════════════════════════════════════════════════════════ │
│  FINE: Issue pronte per sviluppo                                │
│  ══════════════════════════════════════════════════════════════ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## CHECKLIST

### PHASE 0: Prerequisites
- [ ] GitHub CLI verified as available (`gh auth status`)
- [ ] If not available: user guided to configure and STOP

### PHASE 1: Business Analysis
- [ ] BA agent launched with project description
- [ ] Interview completed (98% understanding)
- [ ] Requirements documented in docs/requirements/
- [ ] Doc path collected

### CHECKPOINT 1
- [ ] Summary presented to user
- [ ] **User confirmation received**
- [ ] If NO: BA corrections made
- [ ] If SÌ: proceed to PHASE 2

### PHASE 2: Technical Planning
- [ ] Tech Lead agent launched with doc path
- [ ] Documentation read from docs/requirements/
- [ ] Technical validation completed
- [ ] Architecture proposed
- [ ] Issue structure proposed (NOT created yet)

### CHECKPOINT 2
- [ ] Technical plan presented to user
- [ ] **User confirmation received**
- [ ] If NO: Tech Lead revisions made
- [ ] If SÌ: proceed to PHASE 3

### PHASE 3: Issue Creation
- [ ] Backend issues created on GitHub
- [ ] Frontend issues created on GitHub
- [ ] Architecture document saved locally
- [ ] All issue links provided to user

---

## RELIABILITY NOTES

- **Documentation as Contract**: The documentation created by BA is the "contract" that Tech Lead must implement
- **Session Interruption**: If the session breaks, the docs in `docs/requirements/` contain all information to resume
- **GitHub Issues**: All tasks are tracked as GitHub Issues for visibility and traceability
- **Explicit Checkpoints**: User must explicitly confirm at each checkpoint

---

## START EXECUTION

Now starting project analysis: **$ARGUMENTS**

First, I'll verify that GitHub CLI is configured and available.
