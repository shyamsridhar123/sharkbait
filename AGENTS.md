# Sharkbait Project Instructions

> **⚠️ MANDATORY: Read this entire file before making ANY changes to this codebase.**

---

## 🚨 STRICT ENFORCEMENT RULES

These rules are **NON-NEGOTIABLE**. Failure to follow them will result in rejected work.

### Rule 1: Always Check Backlog First
Before starting ANY work:
1. Run `backlog task list` to see existing tasks
2. Search for related tasks before creating new ones
3. Link your work to an existing task OR create a new one

### Rule 2: Task Lifecycle is Mandatory
```
backlog task start <id>   # BEFORE you begin work
backlog task complete <id> # AFTER work is done and committed
```

### Rule 3: Commits Must Reference Tasks
All commits MUST include the task ID:
- ✅ `git commit -m "SB-001.02: Add project directory structure"`
- ❌ `git commit -m "Add some files"`

### Rule 4: No Orphan Work
Every code change must be:
1. Linked to a backlog task
2. Committed with task reference
3. Marked complete when done

---

## Backlog.md MCP Integration

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

### BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->

---

## 📋 Quick Reference Commands

| Action | Command |
|--------|---------|
| List all tasks | `backlog task list` |
| View task details | `backlog task view <id>` |
| Start a task | `backlog task start <id>` |
| Complete a task | `backlog task complete <id>` |
| Create subtask | `backlog task create "title" -p <parent-id>` |
| Search tasks | `backlog task search "query"` |

---

## 🏗️ Project Structure

```
sharkbait/
├── docs/           # PRD, TRD, Architecture docs
├── src/            # Source code (to be created)
├── backlog/        # Backlog.md task files
│   └── tasks/      # Individual task markdown files
└── AGENTS.md       # THIS FILE - project instructions
```

---

## 🔧 Tech Stack (Do Not Deviate)

| Component | Technology | Reason |
|-----------|------------|--------|
| Runtime | Bun | Fast startup, native TS |
| Language | TypeScript | Type safety |
| LLM | Azure OpenAI GPT Codex 5.2 | Enterprise |
| Memory | Beads (bd CLI) | Git-backed persistence |
| GitHub | git + gh CLI | No Octokit needed |
| CLI UI | ink | React for terminals |
| CLI Framework | commander | Argument parsing |

---

## ✅ Pre-Flight Checklist

Before making any changes, verify:

- [ ] I have read the relevant task in `backlog/tasks/`
- [ ] I have run `backlog task start <id>`
- [ ] I understand which files need to be modified
- [ ] My changes align with docs/TRD.md specifications
- [ ] My commit message will include the task ID


## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
