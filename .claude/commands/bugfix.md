---
allowed-tools: Task, Bash(git:*), Read, Write, Edit, Glob, Grep, TodoWrite, AskUserQuestion
argument-hint: <bug description or error message>
description: Structured bugfix workflow (analyze, confirm, GitHub Issue, branch, plan, fix, review, test, PR)
---

# Bugfix Command

## Bug Report
$ARGUMENTS

---

## IF NO INPUT SPECIFIED

If `$ARGUMENTS` is empty or doesn't contain a specific bug description:
1. Check GitHub Issues for bug tickets: `gh issue list --label bug`
2. Identify the highest priority bug
3. Review the bug details and reproduction steps: `gh issue view <number>`
4. Proceed with the analysis

---

## MANDATORY RULES

### 1. Analysis First
- **NEVER** propose a fix without fully understanding the problem
- **ALWAYS** ask clarifying questions if the bug is unclear
- **ALWAYS** get user confirmation before implementing the fix

### 2. Git Workflow
- **ALWAYS** create a new branch from `main` before starting
- Branch naming: `bugfix/<descriptive-bug-name>` or `fix/<issue-number>-<short-description>`
- **WIP commits** during development
- **Squash commit** before PR

### 3. GitHub Issue Integration
- **ALWAYS** create/update issue on GitHub before starting work
- **ADD** solution details as comments: `gh issue comment <number> --body "<comment>"`
- **NO ISSUE CAN BE CLOSED WITHOUT COMMENTS!**

### 4. Agent Pipeline (Planner → Executor → Reviewer)

| Phase | Agent | Model | Role |
|-------|-------|-------|------|
| Planning | `backend-planner` | Opus | Design fix plan (if backend) |
| Planning | `frontend-planner` | Opus | Design fix plan (if frontend) |
| Execution | `backend-code-executor` | Sonnet | Implement fix |
| Execution | `frontend-executor` | Sonnet | Implement fix |
| Review | `backend-reviewer` | Opus | Simplify & clean (APPLIES changes) |
| Review | `frontend-reviewer` | Opus | Simplify & clean (APPLIES changes) |
| Security | `security-auditor` | Opus | Security check |
| Testing | `e2e-test-runner` | Sonnet | Verify fix |
| Docs | `docs-architect` | Haiku | Update docs |

<!-- CUSTOMIZE: Replace placeholder agents with your project's specific agents -->
<!-- Example: backend-planner, frontend-planner, backend-code-executor, etc. -->

---

## EXECUTION PHASES

### PHASE 1: Bug Analysis

Use **`Explore`** agent for:
- Analyzing the error/bug description
- Tracing the code flow to identify root cause
- Finding all affected files and components
- Understanding expected vs actual behavior

**REQUIRED OUTPUT**: Root cause, affected files, impact assessment

### PHASE 2: Solution Proposal + User Confirmation

Use **`Plan`** agent for:
- Evaluating possible solutions
- Identifying safest/cleanest approach
- Checking for side effects

**MANDATORY: Present and get approval before proceeding!**
1. **Root Cause**: What's causing the bug
2. **Proposed Solution**: How you plan to fix it
3. **Files to Modify**: List of files that will change
4. **Potential Risks**: Any side effects
5. **Alternative Approaches**: Other options (if any)

**DO NOT proceed without user confirmation!**

### PHASE 3: GitHub Issue Management

Create/update GitHub Issue with:
```bash
# Create new issue (if none exists)
gh issue create --title "bug: <description>" --label bug --body "<details>"
# Or comment on existing issue
gh issue comment <number> --body "Root cause: ... / Proposed fix: ..."
```
- Bug details and reproduction steps
- Root cause analysis
- Proposed solution

### PHASE 4: Branch Setup

1. Ensure on updated `main`
2. Create branch: `git checkout -b bugfix/<bug-name>`

### PHASE 5: PLANNING (Opus — FIRST STEP)

**Plan the fix before writing code.**

If there's a related GitHub Issue, pass the issue number to the planner so it can read the details with `gh issue view <number>`.

Use appropriate planner(s):
- **`backend-planner`** if bug is in backend code
- **`frontend-planner`** if bug is in frontend code
- Both if full-stack

The planner reads documentation, analyzes the bug context, and produces a focused fix plan.

### PHASE 6: EXECUTION (Sonnet)

Use appropriate executor(s) to implement the fix:
- **`backend-code-executor`** for backend fixes
- **`frontend-executor`** for frontend fixes

**WIP COMMITS** during implementation.

#### Update GitHub Issue (MANDATORY)
Add comment to issue with changes made, files modified, solution applied:
```bash
gh issue comment <number> --body "Changes: ..."
```

### PHASE 7: REVIEW (Opus — MANDATORY)

Use appropriate reviewer(s):
- **`backend-reviewer`** for backend fix code
- **`frontend-reviewer`** for frontend fix code

Reviewers **APPLY changes directly** to simplify and clean the fix code.

**DO NOT proceed without completing review!**

### PHASE 8: Testing

1. `npm run lint` — fix errors
2. `npm run build` — verify no build errors
3. `npm test` — all tests pass
4. Manual verification: confirm bug is fixed

### PHASE 9: Security Review

Use **`security-auditor`** agent for security audit of the fix.

### PHASE 10: E2E Testing (MANDATORY LOOP)

Use **`e2e-test-runner`** agent for browser/API testing.

Loop: Run → Fail → Fix → Re-test until ALL pass.

### PHASE 11: Documentation

Use **`docs-architect`** agent for documentation updates.

### PHASE 12: Commit and PR

1. Squash WIP commits
2. Create PR with: bug description, root cause, solution, testing, closes #issue-number

### PHASE 13: Update GitHub Issue (MANDATORY)

1. PR should reference issue with `Closes #<number>` in body
2. Add final summary comment on the issue: `gh issue comment <number> --body "..."`

---

## WORKFLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                      BUGFIX WORKFLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. ANALYZE (Explore agent)                                      │
│     └── Understand bug, trace root cause                        │
│                                                                  │
│  2. PROPOSE SOLUTION (Plan agent)                                │
│     └── Design fix, GET USER CONFIRMATION                       │
│                                                                  │
│  3. GITHUB ISSUE                                                 │
│     └── Create/update issue                                     │
│                                                                  │
│  4. BRANCH                                                       │
│     └── git checkout -b bugfix/<name>                           │
│                                                                  │
│  5. PLAN (Opus)                                                  │
│     └── Planner agent(s) → fix plan                             │
│                                                                  │
│  6. EXECUTE (Sonnet)                                             │
│     └── Executor(s) implement the fix following the plan        │
│     └── ADD GITHUB ISSUE COMMENT (MANDATORY!)                   │
│                                                                  │
│  7. REVIEW (Opus) [MANDATORY - APPLIES CHANGES]                  │
│     └── Reviewer(s) simplify and clean the fix code             │
│                                                                  │
│  8. TEST                                                         │
│     └── Verify fix, run tests, check build                     │
│                                                                  │
│  9. SECURITY                                                     │
│     └── Audit fix, check vulnerabilities                        │
│                                                                  │
│  10. E2E TESTING [LOOP]                                          │
│      └── Run tests -> Fix failures -> Repeat until pass         │
│                                                                  │
│  11. DOCS                                                        │
│      └── Update documentation                                   │
│                                                                  │
│  12. COMMIT & PR                                                 │
│      └── Squash, create PR                                      │
│                                                                  │
│  13. UPDATE GITHUB ISSUE (MANDATORY COMMENTS!)                   │
│      └── PR references issue, final summary comment             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## PRE-PR CHECKLIST

- [ ] Bug fully analyzed and understood
- [ ] User confirmed the proposed solution
- [ ] GitHub Issue created/updated
- [ ] Pipeline followed:
  - [ ] **Planner(s)** designed fix plan (Opus)
  - [ ] **Executor(s)** implemented fix (Sonnet)
  - [ ] **Reviewer(s)** simplified and cleaned code (Opus - APPLIES changes!)
  - [ ] Security auditor reviewed
  - [ ] **E2E tests pass** (loop until pass)
  - [ ] Docs updated
- [ ] Fix implemented and tested
- [ ] **GitHub Issue comments added (MANDATORY!)**
- [ ] PR created with full description (Closes #issue-number)
- [ ] GitHub Issue updated with PR link

---

## START EXECUTION

Now proceeding with analysis of the bug: **$ARGUMENTS**

First, I'll analyze the problem to understand the root cause, then ask any clarifying questions before proposing a solution.
