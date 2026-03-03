---
name: commit
description: Analyzes staged git changes and generates commit messages following Conventional Commits specification and git best practices. Handles single commits, multi-scope changes, and breaking changes.
argument-hint: "[--amend] [--scope <scope>]"
allowed-tools: Bash, Read, Glob, Grep
user-invocable: true
---

# Git Commit Message Skill

Generates well-structured commit messages following the **Conventional Commits** specification and git best practices.

## Execution Steps

### Step 1: Analyze the current state

Run these commands to understand what needs to be committed:

```bash
# Check staged changes
git diff --cached --stat

# Check if there are staged changes at all
git diff --cached --quiet && echo "NO_STAGED_CHANGES" || echo "HAS_STAGED_CHANGES"

# Get detailed diff of staged changes
git diff --cached

# Get recent commit history for style consistency
git log --oneline -15
```

**If NO_STAGED_CHANGES**: Inform the user that there are no staged changes. Show `git status` output and suggest which files to stage. Do NOT proceed with commit.

**If the user passed `--amend`**: Also read the last commit message with `git log -1 --format=%B` to understand what's being amended.

### Step 2: Determine commit type

Analyze the diff and classify the change into ONE primary type:

| Type | When to use | Example |
|------|-------------|---------|
| `feat` | New feature or capability for the user | `feat: add user avatar upload` |
| `fix` | Bug fix | `fix: prevent crash on empty input` |
| `refactor` | Code change that neither fixes a bug nor adds a feature | `refactor: extract validation into hook` |
| `docs` | Documentation only | `docs: add API endpoint reference` |
| `style` | Formatting, semicolons, whitespace (no logic change) | `style: fix indentation in config` |
| `test` | Adding or updating tests | `test: add unit tests for auth service` |
| `chore` | Build process, tooling, dependencies, config | `chore: update eslint config` |
| `perf` | Performance improvement | `perf: cache database query results` |
| `ci` | CI/CD configuration | `ci: add staging deploy pipeline` |
| `build` | Build system or external dependencies | `build: upgrade to node 20` |
| `revert` | Reverts a previous commit | `revert: undo avatar upload feature` |

### Step 3: Determine scope (optional)

The scope provides additional context about WHAT area of the codebase is affected:

- Use the module, component, or feature name: `auth`, `api`, `dashboard`, `db`
- Use the layer name for cross-cutting changes: `models`, `routes`, `middleware`
- **Omit scope** if the change is truly global or the scope is obvious from the description

### Step 4: Write the commit message

Follow these rules strictly:

#### Subject line (REQUIRED)
```
type(scope): imperative description
```

- **Imperative mood**: "add" not "added" or "adds"
- **Lowercase** first letter after colon
- **No period** at the end
- **Max 50 characters** for the description (72 total including type/scope)
- Focus on **WHAT** changed, not HOW

#### Body (when needed)
```

Explain WHY this change was made and provide context
that isn't obvious from the code itself.

- Wrap at 72 characters per line
- Separate from subject with a blank line
- Use bullet points for multiple points
```

Add a body when:
- The "why" isn't obvious from the subject alone
- There are important side effects or consequences
- The change is part of a larger effort that needs context
- Multiple files/areas were changed for a single purpose

Do NOT add a body for:
- Simple, self-explanatory changes (`fix: typo in README`)
- Single-file changes where the type+description says it all
- Routine chores (`chore: bump version to 1.2.3`)

#### Footer (when needed)
```

BREAKING CHANGE: description of what breaks and migration path

Refs: #123, #456
Closes: #789
```

- **Breaking changes**: Add `!` after type/scope AND explain in footer
  ```
  feat(api)!: change authentication to OAuth2

  BREAKING CHANGE: JWT tokens are no longer accepted.
  Migrate by updating client to use OAuth2 flow.
  ```
- **Issue references**: `Refs:`, `Closes:`, `Fixes:` followed by issue numbers

### Step 5: Present and confirm

Present the commit message to the user in a code block. Then ask for confirmation before executing.

If the user confirms, execute the commit:

```bash
git commit -m "$(cat <<'EOF'
type(scope): subject line here

Optional body explaining why.

Optional footer.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

If `--amend` was passed, use `git commit --amend` instead of `git commit`.

After the commit, run `git status` to verify success.

## Multi-scope Changes

When staged changes span multiple unrelated scopes, suggest splitting into separate commits:

1. Show the user which files belong to which logical group
2. Suggest unstaging some files: `git reset HEAD <files>`
3. Commit the first group
4. Re-stage and commit the second group

Only combine scopes in one commit if the changes are genuinely coupled (e.g., adding a feature requires both API and UI changes for the same user story).

## Examples of Good Commit Messages

```
feat(auth): add password reset via email

Users can now request a password reset link sent to their
registered email address. Token expires after 24 hours.

Closes: #142
```

```
fix(api): return 404 instead of 500 for missing resources
```

```
refactor(orders): extract price calculation into service

Price calculation logic was duplicated across three controllers.
Centralizing it ensures consistent behavior and easier testing.
```

```
chore: bump dependencies to latest minor versions
```

```
feat(dashboard)!: redesign metrics layout to card grid

BREAKING CHANGE: custom dashboard configurations from v1
are not compatible. Users must reconfigure their dashboard
layout after upgrading.
```

## Examples of Bad Commit Messages (AVOID)

| Bad | Why | Better |
|-----|-----|--------|
| `fix: fix bug` | Non-descriptive | `fix(auth): prevent duplicate session on refresh` |
| `update files` | No type, vague | `refactor(utils): simplify date formatting helpers` |
| `feat: Added new feature for the users to be able to upload` | Past tense, too long | `feat(upload): add file upload for user profiles` |
| `WIP` | Not a valid commit message | Stage only complete work, or use `chore: wip avatar upload` |
| `fix: Fixed issue #123.` | Past tense, period | `fix(cart): apply discount before tax calc` |
| `misc changes` | No type, meaningless | Split into specific commits per change |
