---
allowed-tools: Task, Bash(git:*), Read, Write, Edit, Glob, Grep, TodoWrite, AskUserQuestion
argument-hint: <feature description>
description: Structured feature development workflow (branch, agents, review, docs, PR)
---

# Feature Development Command

## User Request
$ARGUMENTS

---

## IF NO INPUT SPECIFIED

If `$ARGUMENTS` is empty or doesn't contain a specific feature description:
1. Check GitHub Issues for pending tasks: `gh issue list --label feature --state open`
2. Identify the next issue with highest priority
3. Read issue details to understand what's missing: `gh issue view <number>`
4. Proceed with the next incomplete issue

---

## MANDATORY RULES

### 1. Git Workflow
- **ALWAYS** create a new branch from `main` before starting
- Branch naming: `feature/<descriptive-feature-name>`
- **WIP commits** during development (frequent commits with `WIP:` prefix)
- **Squash commit** before PR with descriptive message

### 2. Development Workflow (MANDATORY ORDER)
Follow this order ALWAYS:
1. **Branch**: Create branch from main
2. **GitHub Issue**: Comment on issue to mark "in progress"
3. **Planning**: Use planner agents FIRST (Opus)
4. **Execution**: Use executor agents to write code (Sonnet)
5. **Review**: Use reviewer agents to simplify and clean (Opus)
6. **Security**: Security audit
7. **E2E Testing**: Browser testing loop
8. **Documentation**: Update docs
9. **Build & Test**: Compile and test
10. **GitHub Issue Comments**: Document progress
11. **PR**: Create PR with `Closes #issue-number`

### 3. GitHub Issue Comments (MANDATORY)
- **NEVER** close an issue without adding comments
- **ALWAYS** document progress with meaningful comments throughout the workflow
- **EVERY** issue MUST have comments explaining:
  - What was done
  - Files modified
  - Decisions made
  - Any issues encountered and how they were resolved
- **NO ISSUE CAN BE CLOSED WITHOUT COMMENTS!**
- Use: `gh issue comment <number> --body "<comment>"`

### 4. Mandatory Agent Usage
- **NEVER develop code without the proper pipeline**

#### Agent Pipeline:

| Phase | Agent | Model | Role |
|-------|-------|-------|------|
| Planning | `backend-planner` | Opus | Design plan (backend: code + DB + infra) |
| Planning | `frontend-planner` | Opus | Design plan (frontend: components + hooks + pages) |
| Execution | `backend-code-executor` | Sonnet | Implement backend code |
| Execution | `frontend-executor` | Sonnet | Implement frontend code |
| Review | `backend-reviewer` | Opus | Simplify & clean backend code (APPLIES changes) |
| Review | `frontend-reviewer` | Opus | Simplify & clean frontend code (APPLIES changes) |
| Security | `security-auditor` | Opus | Security audit |
| Testing | `e2e-test-runner` | Sonnet | E2E browser testing |
| Docs | `docs-architect` | Haiku | Documentation |

<!-- CUSTOMIZE: Replace placeholder agents with your project's specific agents -->
<!-- Example: backend-planner, frontend-planner, backend-code-executor, frontend-executor, etc. -->

### 5. Component Reuse
- **ALWAYS** search for existing components before creating new ones
- If you want to create a new component:
  - **STOP** and ask user for feedback
  - Explain why a new component is necessary

---

## EXECUTION PHASES

### PHASE 1: Branch Setup
```
Current git status: !`git status`
Current branch: !`git branch --show-current`
```

1. Ensure you're on updated `main`
2. Create new branch: `git checkout -b feature/<feature-name>`
3. Confirm branch creation

### PHASE 2: Analysis and Scope Detection

Use **`Explore`** agent to understand the request and determine scope:
- Is this backend-only, frontend-only, or full-stack?
- Which modules/areas are involved?
- What existing code can be reused?

**REQUIRED OUTPUT**: Scope determination (backend/frontend/full-stack)

### PHASE 3: PLANNING (Opus — FIRST STEP)

**MANDATORY: Always plan before writing code!**

#### 3.1 Determine which planners to launch

| Scope | Planners |
|-------|----------|
| backend only | `backend-planner` |
| frontend only | `frontend-planner` |
| Full-stack | `backend-planner` + `frontend-planner` (in parallel) |

#### 3.2 Launch Planner(s)

If there's a related GitHub Issue, pass the issue number to the planner so it can read the details with `gh issue view <number>`.

**backend Planner** (if backend involved):
Use **`backend-planner`** agent (Task tool with subagent_type='backend-planner', model='opus') for:
- Analyzing existing code
- Designing architecture for the feature
- Producing structured plan

**frontend Planner** (if frontend involved):
Use **`frontend-planner`** agent (Task tool with subagent_type='frontend-planner', model='opus') for:
- Analyzing existing code
- Designing components, hooks, pages, routing
- Producing structured plan

**If full-stack**: Launch both planners. Pass backend plan output to frontend planner so it can align API contracts.

**REQUIRED OUTPUT**: Detailed implementation plan(s)

**DO NOT proceed to PHASE 4 without completed plan(s)!**

### PHASE 4: EXECUTION (Sonnet)

**Execute the plan using specialized executors.**

#### 4.1 backend Execution (if backend involved)

Use **`backend-code-executor`** agent (Task tool with subagent_type='backend-code-executor') for:
- Implementing the planned backend features
- Following the plan produced by the planner

<!-- CUSTOMIZE: If your project has multiple specialized executors, list them here -->
<!-- Example: backend-db-executor (FIRST), backend-code-executor, backend-infra-executor -->

#### 4.2 frontend Execution (if frontend involved)

Use **`frontend-executor`** agent (Task tool with subagent_type='frontend-executor') for:
- Implementing the planned frontend features
- Following the plan produced by the planner

**Note**: frontend execution can run in parallel with backend if API contracts are defined in the plan.

**WIP COMMITS**: Each executor commits frequently with `WIP: <description>`

### PHASE 5: REVIEW (Opus — MANDATORY)

**MANDATORY: ALWAYS review after execution! Reviewers MODIFY files directly!**

#### 5.1 backend Review (if backend code was written)
Use **`backend-reviewer`** agent (Task tool with subagent_type='backend-reviewer', model='opus') for:
- Simplifying and cleaning code
- Applying best practices (SOLID, clean code)
- Removing complexity, dead code, unnecessary abstractions
- **DIRECTLY EDITING files**

#### 5.2 frontend Review (if frontend code was written)
Use **`frontend-reviewer`** agent (Task tool with subagent_type='frontend-reviewer', model='opus') for:
- Simplifying and cleaning code
- Removing unnecessary state and complexity
- **DIRECTLY EDITING files**

**If full-stack**: Launch both reviewers in parallel.

**After reviewers complete:**
- Review the changes made
- WIP commit: `WIP: Code review improvements`

**DO NOT proceed to PHASE 6 without completing review!**

### PHASE 6: Security Review
Use **`security-auditor`** agent for security audit.

Minimum checklist:
- [ ] No hardcoded credentials
- [ ] Input sanitization
- [ ] Appropriate error handling
- [ ] No sensitive data in logs
- [ ] Tokens handled securely

### PHASE 7: E2E Testing (MANDATORY LOOP)

Use **`e2e-test-runner`** agent for browser testing.

#### Test Loop:
1. Run tests
2. **ALL PASSED** → Proceed to PHASE 8
3. **ANY FAILED** → Pass failures to appropriate executor → Fix → Re-test
4. Repeat until ALL pass

**DO NOT proceed if tests are failing!**

### PHASE 8: Documentation (MANDATORY)
Use **`docs-architect`** agent for documentation updates.

### PHASE 9: Build & Test
1. `npm run lint` — fix errors
2. `npm run build` — verify no build errors
3. `npm test` — all tests pass

**DO NOT proceed if build fails!**

### PHASE 10: GitHub Issue Update (MANDATORY)
Add detailed comment to GitHub Issue:
```bash
gh issue comment <number> --body "## Summary\n- Work done: ...\n- Files modified: ...\n- Technical decisions: ...\n- Testing performed: ..."
```

### PHASE 11: Finalization and PR
1. Squash commits into descriptive one
2. Create PR with description, checklist, screenshots, `Closes #issue-number`

---

## WORKFLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEVELOPMENT WORKFLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. BRANCH                                                       │
│     └── git checkout -b feature/<name>                          │
│                                                                  │
│  2. ANALYZE (Explore agent)                                      │
│     └── Determine scope: backend / frontend / full-stack │
│                                                                  │
│  3. PLAN (Opus) ← FIRST STEP                                    │
│     ├── backend-planner → backend plan                  │
│     └── frontend-planner → frontend plan                  │
│                                                                  │
│  4. EXECUTE (Sonnet)                                             │
│     ├── backend-code-executor → backend implementation       │
│     └── frontend-executor → frontend implementation       │
│                                                                  │
│  5. REVIEW (Opus) [MANDATORY - APPLIES CHANGES]                  │
│     ├── backend-reviewer → Simplify + Clean backend     │
│     └── frontend-reviewer → Simplify + Clean frontend     │
│                                                                  │
│  6. SECURITY (security-auditor agent)                          │
│     └── Audit code, check vulnerabilities                       │
│                                                                  │
│  7. E2E TESTING (e2e-test-runner) [LOOP]                         │
│     └── Run tests -> Fix failures -> Repeat until pass          │
│                                                                  │
│  8. DOCS (docs-architect agent)                                  │
│     └── Update documentation, add comments                      │
│                                                                  │
│  9. BUILD & TEST                                                 │
│     └── npm run lint -> npm run build -> npm test │
│                                                                  │
│  10. GITHUB ISSUE COMMENTS (MANDATORY!)                          │
│      └── Add progress comments to issue                         │
│                                                                  │
│  11. PR                                                          │
│      └── Squash, create PR with Closes #issue-number            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## PRE-PR CHECKLIST

- [ ] Branch created from updated main
- [ ] All tasks completed
- [ ] Pipeline followed:
  - [ ] **Planner(s)** used FIRST (Opus)
  - [ ] **Executor(s)** wrote code following plan (Sonnet)
  - [ ] **Reviewer(s)** simplified and cleaned code (Opus - APPLIES changes!)
  - [ ] Security auditor(s) reviewed
  - [ ] **E2E tests pass** (loop until all pass)
  - [ ] **Docs architect(s)** updated documentation
- [ ] App compiled and tested:
  - [ ] `npm run lint` without errors
  - [ ] Build successful
  - [ ] Tests pass
- [ ] **GitHub Issue comments added (MANDATORY!)**
- [ ] Commits squashed
- [ ] PR description complete (Closes #issue-number)

---

## START EXECUTION

Now proceeding with analysis of the request: **$ARGUMENTS**

First, I'll check the repository status, create the appropriate branch, and begin the planning phase.
