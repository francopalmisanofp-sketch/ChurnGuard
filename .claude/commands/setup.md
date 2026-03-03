---
allowed-tools: Bash, Read, Write, Edit, Glob, AskUserQuestion
description: Initialize claude-infrastructure-template in your project. Creates .claude folder and copies agents, commands, skills for local customization.
---

# Setup Claude Infrastructure Template

This command initializes the claude-infrastructure-template in your current project.

## What this does:
1. Creates `.claude/` directory if it doesn't exist
2. Copies all agents to `.claude/agents/`
3. Copies all commands to `.claude/commands/`
4. Copies all skills to `.claude/skills/`
5. Guides you through placeholder customization

---

## Step 1: Check current directory

First, let me verify we're in a project directory and check if `.claude` already exists.

```bash
pwd
ls -la .claude 2>/dev/null || echo "No .claude directory found"
```

---

## Step 2: Create directory structure

Create the `.claude` directory structure:

```bash
mkdir -p .claude/agents .claude/commands .claude/skills
```

---

## Step 3: Copy files from plugin

The plugin files are located at: `~/.claude/plugins/marketplaces/*/claude-infrastructure-template/`

Find and copy all agents:
```bash
PLUGIN_DIR=$(find ~/.claude/plugins -type d -name "claude-infrastructure-template" 2>/dev/null | head -1)
if [ -n "$PLUGIN_DIR" ]; then
  cp -n "$PLUGIN_DIR"/agents/*.md .claude/agents/ 2>/dev/null || true
  cp -n "$PLUGIN_DIR"/commands/*.md .claude/commands/ 2>/dev/null || true
  cp -rn "$PLUGIN_DIR"/skills/* .claude/skills/ 2>/dev/null || true
  echo "Files copied from: $PLUGIN_DIR"
else
  echo "Plugin directory not found. Please install the plugin first."
fi
```

Note: `-n` flag prevents overwriting existing files.

---

## Step 4: Customize placeholders

After copying, ask the user about their project configuration:

Use AskUserQuestion to gather:

1. **Framework name** (Next.js App Router): React, Flutter, Django, Express, NestJS, etc.
2. **Language** (TypeScript): TypeScript, Dart, Python, JavaScript, etc.
3. **Package manager** (npm): npm, yarn, npm, pub, pip, etc.
4. **Build command** (npm run build): npm run build, flutter build, etc.
5. **Test command** (npm test): npm test, flutter test, pytest, etc.
6. **Analyze command** (npm run lint): npm run lint, flutter analyze, etc.

Then for stack and pipeline agents:
7. **Stack 1 name** (backend): e.g., backend, server, api
8. **Stack 2 name** (frontend): e.g., frontend, client, mobile
9. **Stack 1 source dir** ({{STACK_1_SRC}}): e.g., server/src, src, backend/src
10. **Stack 2 source dir** ({{STACK_2_SRC}}): e.g., src, client/src, frontend/src
11. **Planner Agent 1** (backend-planner): e.g., backend-planner
12. **Planner Agent 2** (frontend-planner): e.g., frontend-planner
13. **Executor Agent 1** (backend-code-executor): e.g., backend-code-executor
14. **Executor Agent 2** (frontend-executor): e.g., frontend-executor
15. **Reviewer Agent 1** (backend-reviewer): e.g., backend-reviewer
16. **Reviewer Agent 2** (frontend-reviewer): e.g., frontend-reviewer
17. **Security agent name** (security-auditor): e.g., security-auditor
18. **Docs agent name** (docs-architect): e.g., docs-architect

Project configuration:
19. **Project name** (ChurnGuard): e.g., My App
20. **Project slug** (churnguard): e.g., my-app (used in worktree paths)
21. **ORM** (Drizzle ORM): e.g., Prisma, Drizzle, TypeORM, SQLAlchemy (optional)
22. **Database** (PostgreSQL): e.g., PostgreSQL, MySQL, MongoDB (optional)
23. **Server port** (3001): e.g., 3000, 8080

Testing configuration:
24. **Backend URL** (http://localhost:3000/api): e.g., http://localhost:3000/api
25. **Frontend URL** (http://localhost:3000): e.g., http://localhost:3000
26. **Test user email** (test@example.com): e.g., test@example.com
27. **Test user password** (password123): e.g., password123

Database configuration (optional, for db-executor):
28. **DB container name** (supabase_db): e.g., myproject-postgres
29. **DB user** (postgres): e.g., postgres
30. **DB name** (churnguard_dev): e.g., mydb_dev

Optional GitHub configuration:
31. **GitHub repository** (auto-detected from git remote)

---

## Step 5: Replace placeholders

After gathering information, use Edit tool to replace all `{{PLACEHOLDER}}` values in the copied files:

```bash
# Example: Replace Next.js App Router with your framework in all files
find .claude -name "*.md" -exec sed -i '' 's/Next.js App Router/YourFramework/g' {} \;
```

Do this for each placeholder the user provided.

---

## Step 6: Verify setup

List the created structure:

```bash
echo "=== Setup Complete ==="
echo ""
echo "Created structure:"
find .claude -type f -name "*.md" | head -20
echo ""
echo "Available agents:"
ls .claude/agents/
echo ""
echo "Available commands:"
ls .claude/commands/
echo ""
echo "Next steps:"
echo "1. Review and customize agents in .claude/agents/"
echo "2. Customize commands in .claude/commands/"
echo "3. Ensure GitHub CLI is configured (gh auth login)"
echo "4. Run /create or /bugfix to test the workflow"
```

---

## Execution

Now execute this setup:

1. First, check if we're in a valid project directory
2. Create the directory structure
3. Copy files from the plugin
4. Ask the user for customization values
5. Replace placeholders
6. Show summary

Start by verifying the current directory and checking for existing `.claude` folder.
