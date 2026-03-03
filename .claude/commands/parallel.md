---
allowed-tools: Task, Bash(git:*,gh:*), Read, Write, Edit, Glob, Grep, AskUserQuestion, TeamCreate, TeamDelete, SendMessage, TaskCreate, TaskUpdate, TaskList, TaskGet
argument-hint: <N=4> [--filter label:backend] [--priority high|normal]
description: Parallel feature development - fetches N issues from GitHub, creates worktrees, launches pipeline of specialized agents per issue
---

# Parallel Development Command

## User Input
$ARGUMENTS

---

## OVERVIEW

Questo comando orchestra lo sviluppo parallelo di N GitHub Issues usando git worktree.
Per ogni issue, il Team Lead (tu) lancia una **pipeline sequenziale: Planner → Executor(s) → Reviewer**,
dove ogni agente lavora direttamente nel worktree come teammate del team.
Il Team Lead controlla l'output tra una fase e l'altra e decide quando procedere.

---

## PARSE INPUT

Parse `$ARGUMENTS` per estrarre:
- **N** (numero di issue da lavorare in parallelo, default: `4`)
- **--filter** (opzionale): filtro label GitHub (es: `label:backend`, `label:frontend`)
- **--priority** (opzionale): filtro priorita via label (`priority:high`, `priority:normal`)

---

## MANDATORY RULES

### 1. Pipeline: Planner → Executor(s) → Reviewer
Per ogni task, il Team Lead lancia gli agenti in questa sequenza:
1. **Planner** (Opus) — progetta l'implementazione
2. **Executor(s)** (Sonnet) — scrive il codice seguendo il piano
3. **Reviewer** (Opus) — semplifica e pulisce il codice
4. **Security** — audit OWASP
5. **Test + Docs** — in parallelo

### 2. 1 PR per task
Ogni task produce il suo branch e la sua PR indipendente.

### 3. Auto-detect tipo agente con conferma
- Label `backend` → stack backend
- Label `frontend` o nessun label → stack frontend
- Se ambiguo → chiedi conferma all'operatore

### 4. Conflict detection obbligatorio
Prima di lanciare, analizzare quali file ogni issue potrebbe toccare.
Se 2+ issue toccano gli stessi file → escludere la issue con priorita piu bassa.

### 5. GitHub Issue Comments OBBLIGATORI
Commento iniziale e finale per ogni issue. MAI chiudere senza commenti!
```bash
gh issue comment <number> --body "<comment>"
```

### 6. Git Safety
Branch naming: `feature/<task-name-slug>`, worktree in `/tmp/churnguard-worktrees/`

---

## AGENT STACK MAPPING

### frontend (tag: frontend, o nessun tag)
| Phase | subagent_type | Model |
|-------|---------------|-------|
| Planning | `frontend-planner` | Opus |
| Execution | `frontend-executor` | Sonnet |
| Review | `frontend-reviewer` | Opus |
| Security | `security-auditor` | Opus |
| Testing | `e2e-test-runner` | Sonnet |
| Documentation | `docs-architect` | Haiku |

### backend (tag: backend)
| Phase | subagent_type | Model |
|-------|---------------|-------|
| Planning | `backend-planner` | Opus |
| Execution | `backend-code-executor` | Sonnet |
| Review | `backend-reviewer` | Opus |
| Security | `security-auditor` | Opus |
| Testing | `e2e-test-runner` | Sonnet |
| Documentation | `docs-architect` | Haiku |

<!-- CUSTOMIZE: If your project has multiple specialized executors, list them separately -->
<!-- Example for backend: backend-db-executor (FIRST), backend-code-executor, backend-infra-executor -->

---

## EXECUTION PHASES

### PHASE 1: Fetch Issues da GitHub

1. **Cerca issue** aperte:
   ```bash
   gh issue list --state open --json number,title,labels,body --limit 20
   ```

2. **Per ogni issue trovata**, recupera dettagli completi:
   ```bash
   gh issue view <number>
   ```

3. **Filtra** per label, priorita.
4. **Ordina** per priorita → data creazione
5. **Seleziona** le prime N issue

### PHASE 2: Conflict Detection

1. Analizza descrizione task per identificare file/moduli coinvolti
2. Usa `Explore` agent se necessario
3. Costruisci matrice conflitti
4. Se conflitto: escludi task con priorita piu bassa

### PHASE 3: Presentazione e Conferma

Mostra all'operatore usando `AskUserQuestion`:
- Lista task selezionati con priorita, tag, stack assegnato
- Task esclusi per conflitti
- Chiedi conferma

### PHASE 4: Setup

1. `git checkout main && git pull origin main`
2. Per ogni issue: `git branch feature/{slug} main && git worktree add /tmp/churnguard-worktrees/task-{i} feature/{slug}`
3. GitHub: commento iniziale su issue `gh issue comment <number> --body "In progress..."`
4. `TeamCreate: team_name="parallel-dev"`

### PHASE 5: Pipeline per Task

Per ogni task, esegui la pipeline sequenziale.

#### STEP 1: PLANNING (Opus)

```
Task tool:
  name: "plan-task-{i}"
  team_name: "parallel-dev"
  subagent_type: "{planner_subagent_type}"
  model: "opus"
  mode: "bypassPermissions"
  run_in_background: true
  prompt: |
    Sei un planner del team "parallel-dev".
    Worktree: /tmp/churnguard-worktrees/task-{i}

    ## Issue
    - Numero: #{issue_number}
    - Titolo: {issue_title}
    - Descrizione: {issue_body}

    ## Istruzioni
    - Leggi la documentazione del progetto (CLAUDE.md, docs/)
    - Analizza il codebase nel worktree
    - Produci un piano di implementazione dettagliato
    - Identifica file da creare/modificare
    - Definisci l'ordine di esecuzione

    Invia il piano al team-lead quando pronto.
```

**Team Lead**: Aspetta piano → verifica → shutdown planner.

#### STEP 2: EXECUTION (Sonnet)

Use the appropriate executor(s) based on the stack:

```
Task tool:
  name: "dev-task-{i}"
  subagent_type: "{executor_subagent_type}"
  prompt: |
    Worktree: /tmp/churnguard-worktrees/task-{i}
    Piano: {piano}
    Implementa seguendo il piano.
```

<!-- CUSTOMIZE: If your project has multiple specialized executors (e.g., DB, Code, Infra), -->
<!-- launch them sequentially: DB first, then Code, then Infra -->

**Team Lead**: Aspetta → verifica → shutdown.

#### STEP 3: REVIEW (Opus)

```
Task tool:
  name: "review-task-{i}"
  subagent_type: "{reviewer_subagent_type}"
  model: "opus"
  mode: "bypassPermissions"
  run_in_background: true
  prompt: |
    Worktree: /tmp/churnguard-worktrees/task-{i}

    Esamina TUTTI i file modificati:
    ```bash
    cd /tmp/churnguard-worktrees/task-{i} && git diff --name-only main
    ```

    - Review e APPLICA correzioni direttamente
    - Semplifica: Clean Code, SOLID, DRY
    - Committa: git add -A && git commit -m "refactor: code review improvements"
```

**Team Lead**: Aspetta → verifica → shutdown.

#### STEP 4: Security Review

```
Task tool:
  name: "security-task-{i}"
  subagent_type: "{security_subagent_type}"
  prompt: |
    Worktree: /tmp/churnguard-worktrees/task-{i}
    Audit completo OWASP top 10. Fix critici direttamente.
```

**Team Lead**: Se fix necessari → lancia executor per fix → shutdown.

#### STEP 5: Testing + Docs (IN PARALLELO)

Lancia entrambi nello stesso messaggio:

```
# Test
Task tool:
  name: "test-task-{i}"
  subagent_type: "{test_subagent_type}"
  prompt: |
    Worktree: /tmp/churnguard-worktrees/task-{i}
    Testa tutte le feature implementate.

# Docs
Task tool:
  name: "docs-task-{i}"
  subagent_type: "{docs_subagent_type}"
  prompt: |
    Worktree: /tmp/churnguard-worktrees/task-{i}
    Documenta le feature implementate.
```

**Team Lead**: Aspetta entrambi. Se test falliscono → executor fix → re-test (max 3).

### PHASE 6: Build, Squash e PR

Per ogni task:
1. Build check
2. Squash commit: `git reset --soft main && git commit -m "feat({scope}): {description}"`
3. Push e PR: `git push -u origin feature/{slug} && gh pr create --body "Closes #<number>"`
4. GitHub Issue: commento finale con PR link

### PHASE 7: Cleanup

1. `git worktree remove /tmp/churnguard-worktrees/task-{i}`
2. `TeamDelete`

---

## ERROR HANDLING

### Agente non risponde
Dopo 10 min senza messaggi → ping → se no risposta → shutdown e rilancia.

### Security problemi critici
Team Lead lancia executor per fix → ri-lancia security (max 2 round).

### Test falliscono
Team Lead lancia executor per fix → ri-test (max 3 tentativi).

### Build fallisce
Team Lead lancia executor per fix → ri-build (max 3).

---

## WORKFLOW SUMMARY

```
Per ogni task (N task in parallelo su N worktree):

  Team Lead
    |
    |-- [1] PLAN (Opus)
    |       Lancia planner ──────────> Analizza, progetta piano
    |       <── Piano pronto ─────────  Shutdown planner
    |
    |-- [2] EXECUTE (Sonnet)
    |       Lancia executor(s) ──────> Implementa seguendo piano
    |       <── "fatto" ──────────────  Shutdown executor(s)
    |
    |-- [3] REVIEW (Opus)
    |       Lancia reviewer ─────────> Simplify + Clean Code
    |       <── "fatto" ──────────────  Shutdown reviewer
    |
    |-- [4] SECURITY
    |       Lancia security ─────────> Audit OWASP
    |       Se fix: executor → fix → shutdown
    |
    |-- [5] TEST + DOCS (parallelo)
    |       test-runner + docs-architect
    |       Se test fail: executor fix (loop max 3)
    |
    |-- [6] BUILD, SQUASH, PR, GITHUB ISSUE
    |
    |-- [7] CLEANUP
```

---

## START EXECUTION

Now parsing input and fetching issues from GitHub...
