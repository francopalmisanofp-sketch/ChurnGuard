---
allowed-tools: Task, Bash(gh:*), Read, Write, Edit, Glob, Grep, WebSearch, WebFetch, AskUserQuestion
argument-hint: <description or GitHub Issue number>
description: Analyze project requirements and generate comprehensive UML Use Case Diagrams using Mermaid. Accepts user input or GitHub Issue number.
---

# Analyze Use Cases Command

## User Input
$ARGUMENTS

---

## OVERVIEW

This command orchestrates a comprehensive Use Case analysis workflow:
1. **Input Acquisition** - From user description or GitHub Issue
2. **Research Update** - Latest UML/Use Case best practices
3. **Use Case Generation** - Systematic analysis of all use cases
4. **Validation Pass** - Review for completeness
5. **Documentation Output** - Mermaid diagrams + specifications

---

## MANDATORY RULES

### 1. Agent Usage
- **ALWAYS** use `requirements-engineer` agent for Use Case analysis and Mermaid generation
- **ALWAYS** use `Explore` agent for codebase analysis when code path is provided

### 2. Research First
- **ALWAYS** search online for latest UML Use Case best practices before generating diagrams
- Update knowledge on Mermaid syntax improvements

### 3. Double-Check
- **ALWAYS** perform a validation pass after initial generation
- Look for missing actors, use cases, and relationships

### 4. Output Format
- **ALWAYS** provide Mermaid code that renders correctly
- **Save documentation locally** in `docs/use-cases/` folder

---

## EXECUTION PHASES

### PHASE 0: Input Detection

Determine the input type from `$ARGUMENTS`:

**Option A: GitHub Issue Number**
If input matches a number (e.g., `#42` or `42`):
```
→ Read issue from GitHub: gh issue view <number>
→ Extract requirements, features, user stories
```

**Option B: User Description**
If input is text description:
```
→ Use the provided description as requirements source
→ Ask clarifying questions if description is vague
```

**Option C: Empty Input**
If `$ARGUMENTS` is empty:
```
→ Ask user: "Provide a project description OR a GitHub Issue number"
→ Optionally ask if they want to analyze existing codebase
```

#### Input Detection Logic

```
IF $ARGUMENTS is a number or starts with "#":
    → PHASE 1A: GitHub Issue Input
ELSE IF $ARGUMENTS is not empty:
    → PHASE 1B: User Description Input
ELSE:
    → Ask user for input using AskUserQuestion
```

---

### PHASE 1A: GitHub Issue Input Acquisition

**Read from GitHub:**

```bash
gh issue view <number> --json title,body,labels,comments
```

**Extract and organize:**
- Project name and description
- Features and requirements
- User stories (if present)
- Acceptance criteria
- Stakeholders mentioned

**Output: Requirements Summary**
```markdown
## Requirements from GitHub Issue

**Source:** Issue #[number]

### Project Overview
[extracted overview]

### Features/Requirements
- [feature 1]
- [feature 2]

### User Stories (if present)
- As a [user], I want to [action] so that [benefit]

### Stakeholders Mentioned
- [stakeholder 1]
- [stakeholder 2]
```

---

### PHASE 1B: User Description Input

**Analyze the provided description:**

1. Identify key information:
   - What is the system/project about?
   - Who are the potential users?
   - What features are mentioned?

2. **Ask clarifying questions** using AskUserQuestion:
   - "Who are the main users of this system?"
   - "Are there external systems that need to integrate?"
   - "What are the 3-5 most important features?"

3. **Optionally ask about codebase:**
   - "Do you want me to also analyze existing code? If yes, provide the path."

---

### PHASE 1C: Codebase Analysis (Optional)

If user provides a code path or requests codebase analysis:

**Use `Explore` agent** (Task tool with subagent_type='Explore') to:
- Scan project structure
- Identify existing features from code
- Find API endpoints, services, models
- Extract user-facing functionality

**Output: Codebase Insights**
```markdown
## Codebase Analysis

### Project Structure
[high-level structure]

### Identified Features (from code)
- [feature 1] - found in [file/folder]
- [feature 2] - found in [file/folder]

### API Endpoints (if applicable)
- GET /api/xxx - [description]
- POST /api/xxx - [description]

### User-Facing Functionality
- [functionality 1]
- [functionality 2]
```

---

### PHASE 2: Research Update

**MANDATORY: Search for latest best practices before generating diagrams!**

Use **WebSearch** tool to research:

1. **UML Use Case best practices 2024 2025**
   ```
   Query: "UML use case diagram best practices 2024 2025"
   ```

2. **Mermaid Use Case syntax updates**
   ```
   Query: "Mermaid diagram use case syntax latest"
   ```

3. **Use Case modeling patterns**
   ```
   Query: "use case modeling patterns include extend generalization when to use"
   ```

**Compile Research Summary:**
```markdown
## Research Update

### Latest Best Practices Found
- [practice 1]
- [practice 2]

### Mermaid Syntax Notes
- [any new syntax or improvements]

### Patterns to Apply
- [pattern 1]
- [pattern 2]
```

---

### PHASE 3: Use Case Generation

**Launch `requirements-engineer` agent** (Task tool with subagent_type='requirements-engineer'):

**Prompt for the agent:**
```
Analyze the following requirements and generate comprehensive UML Use Case Diagrams.

## Requirements Source
[Insert requirements from PHASE 1]

## Research Insights
[Insert research from PHASE 2]

## Instructions
1. Identify ALL actors (primary, secondary, external systems)
2. Identify ALL use cases with proper naming (verb + noun)
3. Define relationships (include, extend, generalization)
4. Create Mermaid Use Case Diagram(s)
5. Provide Use Case specifications (at least brief format)

## Output Required
1. Actors Table
2. Use Cases Table with priorities
3. Mermaid Diagram Code
4. Use Case Specifications

If the system is complex, create multiple diagrams by module/domain.
```

**Collect Output:**
- Actors identified
- Use Cases identified
- Mermaid diagram(s)
- Use Case specifications

---

### PHASE 4: Validation Pass

**MANDATORY: Double-check for completeness!**

**Launch `requirements-engineer` agent again** for validation:

**Prompt for validation:**
```
Review the following Use Case analysis for completeness.

## Original Requirements
[Insert requirements from PHASE 1]

## Generated Analysis
[Insert output from PHASE 3]

## Validation Checklist
Check for:
1. Missing actors - Are there users or systems not included?
2. Missing use cases - Are there features/requirements not covered?
3. Missing relationships - Should any use cases include/extend others?
4. Orphan elements - Any actor or use case not connected?
5. Naming consistency - Do all use cases follow verb+noun format?
6. Abstraction level - Are all use cases at the same level of detail?

## Output Required
1. Validation results (PASS/ISSUES FOUND)
2. If issues found: list of additions/corrections
3. Updated Mermaid diagram (if changes needed)
4. Updated Use Case specifications (if changes needed)
```

**If issues found:**
- Apply corrections
- Update diagrams and specifications

---

### PHASE 5: Output Generation

**MANDATORY: Save ALL documentation locally in docs/use-cases/.**

Use **AskUserQuestion** to determine output preferences:

1. **Output format:**
   - Full documentation (diagrams + all specifications)?
   - Diagrams only?
   - Summary only?

2. **Diagram style:**
   - Single comprehensive diagram?
   - Multiple diagrams by module?
   - Both?

#### 5.1 Save Documentation Locally

Save to `docs/use-cases/`:

```
1. Create/Update docs with:
   - docs/use-cases/overview.md - Use Case overview
   - docs/use-cases/diagrams.md - Mermaid diagrams
   - docs/use-cases/specifications.md - Actor and Use Case tables

2. Optionally create GitHub Issues for each use case:
   gh issue create --title "[UC-XXX] Use Case Name" --body "<specification>"
```

---

### PHASE 6: Summary and Next Steps

**Present final summary to user:**

```markdown
## ✅ Use Case Analysis Complete

### Generated Artifacts

**Location:** docs/use-cases/

**Files created:**
- 📄 overview.md - Overview
- 📄 diagrams.md - Use Case Diagram (Mermaid)
- 📄 specifications.md - Actors, Use Cases List, Specifications

### Statistics
- Actors identified: [N]
- Use Cases identified: [N]
- Include relationships: [N]
- Extend relationships: [N]

### Validation Results
- [x] Completeness check passed
- [x] All requirements covered
- [x] No orphan elements
- [x] Saved locally

### Recommended Next Steps
1. Review the generated diagrams with stakeholders
2. Validate use case priorities (Must/Should/Could)
3. Use `/create` to start implementing high-priority use cases
4. Consider running `@domain-analyst` for DDD analysis
5. Consider running `@database-architect` for database design
```

---

## WORKFLOW SUMMARY

```
┌─────────────────────────────────────────────────────────────────┐
│                  /analyze-usecases WORKFLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 0: INPUT DETECTION                                        │
│  └── GitHub Issue #? → Read from GitHub                          │
│  └── Description? → Use provided text                           │
│  └── Empty? → Ask user                                          │
│  └── Code path? → Analyze codebase (optional)                   │
│                                                                  │
│  PHASE 1: INPUT ACQUISITION                                      │
│  └── Extract requirements from source                           │
│  └── Ask clarifying questions if needed                         │
│                                                                  │
│  PHASE 2: RESEARCH UPDATE                                        │
│  └── Search latest UML best practices                           │
│  └── Search Mermaid syntax updates                              │
│  └── Compile insights                                           │
│                                                                  │
│  PHASE 3: USE CASE GENERATION (requirements-engineer agent)     │
│  └── Identify actors                                            │
│  └── Identify use cases                                         │
│  └── Define relationships                                       │
│  └── Generate Mermaid diagrams                                  │
│  └── Write specifications                                       │
│                                                                  │
│  PHASE 4: VALIDATION PASS (requirements-engineer agent)         │
│  └── Check for missing actors                                   │
│  └── Check for missing use cases                                │
│  └── Check for missing relationships                            │
│  └── Apply corrections if needed                                │
│                                                                  │
│  PHASE 5: OUTPUT GENERATION                                      │
│  └── Ask output preferences (format, diagram style)             │
│  └── Save documentation to docs/use-cases/                      │
│                                                                  │
│  PHASE 6: SUMMARY                                                │
│  └── Present results                                            │
│  └── Recommend next steps                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## CHECKLIST

- [ ] Input source identified (GitHub Issue/Description/Code)
- [ ] Requirements extracted and organized
- [ ] Online research completed (latest best practices)
- [ ] `requirements-engineer` agent used for generation
- [ ] All actors identified and classified
- [ ] All use cases identified with proper naming
- [ ] Relationships defined (include/extend/generalization)
- [ ] Mermaid diagrams generated and validated
- [ ] **VALIDATION PASS completed** (double-check)
- [ ] Output preferences confirmed with user
- [ ] **Documentation saved to docs/use-cases/**
- [ ] Summary presented with next steps

---

## START EXECUTION

Now analyzing: **$ARGUMENTS**

First, I'll determine the input type and acquire requirements, then proceed with the research and analysis phases.
