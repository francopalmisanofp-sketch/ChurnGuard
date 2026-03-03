---
allowed-tools: Task, Bash(gh:*), Read, Glob, Grep, TodoWrite, AskUserQuestion
argument-hint: <feature or improvement request>
description: Analyze request, check duplicates, estimate complexity, create GitHub Issue (no implementation)
---

# Request Management Command

## User Request
$ARGUMENTS

---

## IF NO INPUT SPECIFIED

If `$ARGUMENTS` is empty or doesn't contain a specific request:
1. Ask the user what feature or improvement they need
2. Use AskUserQuestion to gather requirements
3. Proceed with the analysis once you have enough information

---

## MANDATORY RULES

### 1. Analysis Only - NO Implementation
- **NEVER** create branches or write code
- **NEVER** modify any files except GitHub Issues
- This command is for planning and issue creation ONLY
- If the user wants to implement, suggest using `/create` or `/bugfix` after

### 2. Duplicate Detection is Critical
- **ALWAYS** check for duplicates before proceeding
- Search in ALL locations: GitHub Issues, local docs, codebase
- If duplicate found → **STOP** and inform user

### 3. User Confirmation Required
- **NEVER** create GitHub Issues without user confirmation
- Present the proposed issue structure first
- Wait for explicit approval

### 4. Consultare Documentazione Esistente (OBBLIGATORIO)
- **SEMPRE** leggere la documentazione esistente (CLAUDE.md, docs/, GitHub Issues) prima di analizzare
- Cercare requisiti, specifiche e decisioni architetturali correlate
- Usare le informazioni per produrre issue piu precisi e contestualizzati

### 5. Mandatory Agent Usage

| Phase | Agent | Model | Role |
|-------|-------|-------|------|
| Codebase analysis, duplicates | `Explore` | - | Analisi codice esistente |
| Scope detection | `Explore` | - | Determina se backend/frontend/full-stack |
| backend analysis & breakdown | `backend-planner` | Opus | Analisi tecnica backend |
| frontend analysis & breakdown | `frontend-planner` | Opus | Analisi tecnica frontend |

<!-- CUSTOMIZE: Replace placeholder agents with your project's specific planners -->
<!-- Example: backend-planner, frontend-planner -->

---

## EXECUTION PHASES

### PHASE 1: Request Understanding

#### 1.1 Consultare Documentazione Esistente (OBBLIGATORIO)
**PRIMA di analizzare la richiesta**, cerca documentazione correlata:
- Cerca issue esistenti: `gh issue list --search "<termine>"`
- Leggi CLAUDE.md e docs/ per requisiti e architettura
- Leggi issue correlate: `gh issue view <number>`

#### 1.2 Analyze the Request
Use **`Explore`** agent (Task tool with subagent_type='Explore') for:
- Understanding what the user is asking for
- Identifying the type of request (feature/improvement)
- Extracting keywords for duplicate search
- **Determining scope**: backend-only, frontend-only, or full-stack
- Understanding the impact on existing code

**REQUIRED OUTPUT**:
- Clear description of the request
- Type: Feature / Improvement
- Scope: backend / frontend / Full-stack
- Keywords for search
- Affected areas

### PHASE 2: Duplicate Check

**MANDATORY: Check ALL these locations before proceeding!**

#### 2.1 GitHub Issues
Search for existing issues with similar title/description:
```bash
gh issue list --search "<keywords>" --state all
```

#### 2.2 Local Documentation
Use **`Explore`** agent to search:
- `CLAUDE.md` - Project context and existing features
- `README.md` - Project overview
- `docs/` folder - Technical documentation
- Any other doc files

#### 2.4 Codebase
Use **`Explore`** agent to check if:
- Similar functionality already exists
- There's a partial implementation
- Related components are already built

**Search for:**
- Similar function/class names
- Related file patterns
- Existing implementations

### PHASE 3: Duplicate Found Handler

**IF ANY DUPLICATE IS FOUND:**

1. **STOP** the workflow immediately
2. Present to user:
   - What was found (task/code/documentation)
   - Where it was found (link if available)
   - How similar it is to the request
   - Status (if it's a task: pending/in progress/done)
3. **DO NOT proceed** to Phase 4

**Present format:**
```
⚠️ DUPLICATE FOUND

Type: [GitHub Issue / Existing Code / Documentation]
Location: [Link or path]
Status: [If applicable]

Description:
[What was found and how it relates to the request]

Recommendation:
[What the user should do - e.g., check existing task, update existing feature, etc.]
```

**END WORKFLOW HERE IF DUPLICATE FOUND**

### PHASE 4: Clarification

**Only proceed here if NO duplicates were found.**

Use **AskUserQuestion** tool to clarify:

**Questions to ask (if not already clear):**
- [ ] Specific requirements and acceptance criteria
- [ ] Priority level (urgent/high/medium/low)
- [ ] Dependencies on other features
- [ ] Target users/use cases
- [ ] Any constraints or limitations

**Gather enough information to:**
- Estimate complexity accurately
- Create a detailed task description
- Identify subtasks if needed

### PHASE 5: Technical Analysis with Planners (Opus)

**Use the specialized planners to produce an accurate technical breakdown.**

#### 5.1 Determine which planner(s) to launch

| Scope | Planner(s) |
|-------|------------|
| backend only | `backend-planner` |
| frontend only | `frontend-planner` |
| Full-stack | `backend-planner` + `frontend-planner` (in parallel) |

#### 5.2 Launch Planner(s)

**backend Planner** (if backend involved):
Use **`backend-planner`** agent (Task tool with subagent_type='backend-planner', model='opus') for:
- Reading project documentation (CLAUDE.md, docs/, GitHub Issue)
- Analyzing existing code
- Identifying changes needed
- Estimating file count and complexity
- Producing a structured breakdown

**frontend Planner** (if frontend involved):
Use **`frontend-planner`** agent (Task tool with subagent_type='frontend-planner', model='opus') for:
- Reading project documentation (CLAUDE.md, docs/, GitHub Issue)
- Analyzing existing code
- Identifying components/changes needed
- Estimating file count and complexity
- Producing a structured breakdown

**If full-stack**: Launch both. Pass backend plan to frontend planner for API contract alignment.

**REQUIRED OUTPUT from planners**:
- List of specific subtasks with file references
- Dependencies between subtasks (what must be done first)
- Complexity per subtask (bassa/media/alta)
- Overall complexity estimation

#### 5.3 Consolidate Analysis

From the planner output, produce:

```
📊 TECHNICAL ANALYSIS

Scope: [backend / frontend / Full-stack]
Overall Complexity: [BASSA / MEDIA / ALTA]
Suggested Priority: [Urgent / High / Medium / Low]

backend Impact (if applicable):
- New/modified files: ~[N]
- Key changes: [details]

frontend Impact (if applicable):
- New/modified files: ~[N]
- Key changes: [details]

Dependencies:
- [What must be done first]

Risks:
- [Identified risks]

Subtask Breakdown:
1. [Subtask] - Complessita: [bassa/media/alta]
2. [Subtask] - Complessita: [bassa/media/alta]
...
```

### PHASE 6: Task Proposal

**MANDATORY: Present task and get confirmation BEFORE creating!**

Present the proposed GitHub Issue to user:

```
📋 PROPOSED GITHUB ISSUE

Title: [Descriptive title]

Description:
[Detailed description including:]
- What needs to be done
- Acceptance criteria
- Technical notes

Type: [Feature / Improvement]
Complexity: [BASSA / MEDIA / ALTA]
Priority: [Urgent / High / Medium / Low]

Checklist:
- [ ] [Task 1 - with specific files/scope from planner]
- [ ] [Task 2 - with specific files/scope from planner]
- [ ] [...]

Labels: [backend / frontend / full-stack]

---
Do you want me to create this issue on GitHub?
```

**WAIT for user confirmation!**

### PHASE 7: GitHub Issue Creation

**Only proceed after explicit user approval!**

#### 7.1 Create Issue
Create GitHub Issue with:
```bash
gh issue create --title "<title>" --body "<body>" --label "<labels>"
```
- **Title**: As proposed
- **Body**: Full details including technical analysis from planners, checklist items
- **Labels**: backend / frontend / full-stack, priority

#### 7.2 Confirm Creation
Present to user:
- Issue link
- Summary of what was created
- Next steps: "Use `/create` to start implementation"

---

## WORKFLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                      REQUEST WORKFLOW                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. READ DOCS (MANDATORY)                                        │
│     └── Search existing documentation and GitHub Issues          │
│                                                                  │
│  2. UNDERSTAND (Explore agent)                                   │
│     └── Analyze request, determine scope (backend/frontend/full-stack) │
│                                                                  │
│  3. CHECK DUPLICATES                                             │
│     ├── GitHub Issues (open + closed)                            │
│     ├── Local docs (CLAUDE.md, README, docs/)                    │
│     └── Codebase (existing implementations)                      │
│                                                                  │
│  4. IF DUPLICATE → STOP & INFORM USER                            │
│                                                                  │
│  5. CLARIFY (AskUserQuestion)                                    │
│     └── Requirements, priority, constraints                      │
│                                                                  │
│  6. TECHNICAL ANALYSIS (Opus Planners)                            │
│     ├── backend-planner → backend breakdown              │
│     └── frontend-planner → frontend breakdown              │
│                                                                  │
│  7. PROPOSE ISSUE                                                │
│     └── Structured issue with planner-informed checklist         │
│     └── GET USER CONFIRMATION                                    │
│                                                                  │
│  8. CREATE ON GITHUB (after confirmation)                        │
│     └── Issue with checklist and labels                          │
│     └── Suggest /create for implementation                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## CHECKLIST

- [ ] Project documentation consulted (CLAUDE.md, docs/, GitHub Issues)
- [ ] Request analyzed and scope determined (backend/frontend/full-stack)
- [ ] Duplicate check completed in ALL locations
- [ ] No duplicates found (or workflow stopped)
- [ ] Clarifying questions asked
- [ ] **Planner(s) used for technical analysis** (Opus)
- [ ] Complexity estimated with file-level detail
- [ ] Issue proposal presented with planner-informed checklist
- [ ] **User confirmation received**
- [ ] Issue created on GitHub with labels
- [ ] Issue link provided to user

---

## IMPORTANT NOTES

- This command does NOT implement anything
- Always suggest `/create` or `/bugfix` for implementation
- The planners provide detailed technical breakdown that makes GitHub Issue checklists actionable
- Issue creation requires explicit user approval

---

## START EXECUTION

Now analyzing the request: **$ARGUMENTS**

First, I'll read project documentation and check existing GitHub Issues, then analyze your request and check for duplicates.
