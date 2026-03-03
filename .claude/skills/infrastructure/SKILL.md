---
name: infrastructure
description: Automatically suggests appropriate agents and commands for professional software development tasks. Covers feature development, code architecture, security audit, documentation, refactoring, code review, vulnerability analysis, UML diagrams, bug fixes, feature requests, planning, implementation, database design, migrations, and middleware.
---

# Infrastructure Development Skill

This skill helps you use the Claude Infrastructure Template effectively by automatically suggesting the right agents and commands based on your task.

## Pipeline: Planner → Executor → Reviewer

Every development task follows this pipeline:

1. **Planner** (Opus) — designs the implementation plan BEFORE any code is written
2. **Executor** (Sonnet) — writes code following the plan
3. **Reviewer** (Opus) — simplifies and cleans the code (APPLIES changes directly)

## When to Use Each Agent

### Planning Agents (FIRST STEP — Opus)

#### backend Planner (`@backend-planner`)
**Trigger phrases**: "plan backend", "design API", "plan database", "design service", "plan endpoint"

Use when:
- Planning new backend features
- Designing database schema changes
- Planning infrastructure changes
- Before ANY backend code is written

#### frontend Planner (`@frontend-planner`)
**Trigger phrases**: "plan frontend", "design component", "plan page", "design UI", "plan form"

Use when:
- Planning new frontend features
- Designing component hierarchy
- Planning routing and navigation
- Before ANY frontend code is written

### Execution Agents (Sonnet)

#### backend Executor (`@backend-code-executor`)
**Trigger phrases**: "implement service", "create route", "write backend", "implement endpoint"

Use when:
- Implementing backend features
- Following a plan from the planner
- Writing business logic and data access code

#### frontend Executor (`@frontend-executor`)
**Trigger phrases**: "implement component", "create page", "write frontend", "build UI"

Use when:
- Implementing frontend features
- Following a plan from the planner
- Building UI components and pages

### Review Agents (Opus — APPLIES CHANGES)

#### backend Reviewer (`@backend-reviewer`)
**Trigger phrases**: "review backend", "clean backend code", "simplify service", "refactor backend"

Use when:
- After backend code has been written
- Simplifying and cleaning code
- Enforcing SOLID and Clean Code
- Code quality gate before PR

#### frontend Reviewer (`@frontend-reviewer`)
**Trigger phrases**: "review frontend", "clean component", "simplify frontend", "refactor frontend"

Use when:
- After frontend code has been written
- Simplifying and cleaning code
- Code quality gate before PR

### Security Auditor Agent (`@security-auditor`)
**Trigger phrases**: "security", "audit", "vulnerability", "OWASP"

Use for security audits of both backend and frontend code.

### Documentation Agent (`@docs-architect`)
**Trigger phrases**: "document", "UML", "diagram", "API docs"

Use for documentation of both backend and frontend code.

## Available Commands

### The /request Command
Use `/request <description>` to analyze a request WITHOUT implementing it.
Uses Opus planners for technical breakdown before creating GitHub Issues.

### The /create Command
Use `/create <description>` for complete feature development:
1. Branch Setup
2. **Planning** (Opus) — planner agent(s) design the implementation
3. **Execution** (Sonnet) — executor agent(s) write code following the plan
4. **Review** (Opus) — reviewer agent(s) simplify and clean the code
5. Security → E2E Testing → Documentation → Build → PR

### The /bugfix Command
Use `/bugfix <description>` for structured bug fixing:
1. Analysis → Solution Proposal → User Confirmation
2. **Planning** (Opus) — plan the fix
3. **Execution** (Sonnet) — implement the fix
4. **Review** (Opus) — simplify and clean
5. Testing → Security → Documentation → PR

### The /parallel Command
Use `/parallel <N>` for parallel development of N GitHub Issues using git worktrees.

## Quick Reference

| Task | Agent/Command |
|------|---------------|
| Analyze request, create GitHub Issue | `/request <description>` |
| New feature (full workflow) | `/create <description>` |
| Bug fix (full workflow) | `/bugfix <description>` |
| Parallel development | `/parallel <N>` |
| Commit with Conventional Commits | `/commit` |
| Plan backend implementation | `@backend-planner` |
| Plan frontend implementation | `@frontend-planner` |
| Implement backend code | `@backend-code-executor` |
| Implement frontend code | `@frontend-executor` |
| Review/simplify backend | `@backend-reviewer` |
| Review/simplify frontend | `@frontend-reviewer` |
| Implement DB changes | `@db-executor` |
| Implement infra/middleware | `@infra-executor` |
| Security review | `@security-auditor` |
| Documentation | `@docs-architect` |
| API testing | `@api-test-runner` |
| E2E browser testing | `@e2e-test-runner` |
| Codebase exploration | `@Explore` |

## Customization Required

Before using this plugin, replace all `{{PLACEHOLDER}}` values in the agent files.
Use `/setup` to guide you through the process, or see the README for the complete placeholder reference.
