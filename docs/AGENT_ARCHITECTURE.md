# Sharkbait - Agent Architecture Specification

**Version:** 1.0  
**Date:** January 28, 2026  
**Status:** Draft

---

## 1. Overview

This document defines a comprehensive agent architecture for Sharkbait, inspired by:
- VS Code Custom Agents (`.agent.md` format, handoffs, tool restrictions)
- Claude Code Plugins (agents, subagents, skills, hooks, commands)
- Modern agentic patterns (orchestration, specialization, autonomy)

---

## 2. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                     │
│                    (CLI / Terminal / Interactive Mode)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ORCHESTRATOR AGENT                                  │
│        (Routes requests, manages context, coordinates workflows)             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Primary      │          │  Specialized  │          │   Workflow    │
│  Agents       │          │  Subagents    │          │   Agents      │
├───────────────┤          ├───────────────┤          ├───────────────┤
│ • Coder       │          │ • Analyzers   │          │ • Feature Dev │
│ • Reviewer    │          │ • Validators  │          │ • PR Workflow │
│ • Planner     │          │ • Searchers   │          │ • Bug Fix     │
│ • Debugger    │          │ • Formatters  │          │ • Refactor    │
└───────────────┘          └───────────────┘          └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TOOL LAYER                                      │
│    (File Ops, Shell, Git, GitHub, Beads, Search, Fetch, MCP Servers)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                             HOOKS LAYER                                      │
│      (PreToolUse, PostToolUse, Stop, SessionStart, UserPromptSubmit)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                             SKILLS LAYER                                     │
│           (Domain knowledge, patterns, best practices, references)           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Types & Hierarchy

### 3.1 Agent Classification

| Type | Description | Autonomy Level | Example |
|------|-------------|----------------|---------|
| **Orchestrator** | Routes requests, manages high-level flow | Full | Main agent |
| **Primary Agent** | Handles major task categories | High | `coder`, `reviewer` |
| **Subagent** | Performs focused subtasks | Medium | `bug-scanner`, `test-generator` |
| **Nested Agent** | Subagent of a subagent | Low | `type-checker` within `bug-scanner` |
| **Workflow Agent** | Multi-phase orchestrated process | High | `feature-dev` |

### 3.2 Agent Hierarchy

```
Orchestrator (sharkbait)
│
├── Primary Agents
│   ├── coder
│   │   ├── Subagents
│   │   │   ├── code-writer
│   │   │   ├── refactorer
│   │   │   └── optimizer
│   │   └── Nested Agents
│   │       └── type-fixer (under refactorer)
│   │
│   ├── reviewer
│   │   └── Subagents
│   │       ├── bug-scanner
│   │       ├── security-auditor
│   │       ├── style-checker
│   │       └── performance-analyzer
│   │
│   ├── planner
│   │   └── Subagents
│   │       ├── task-decomposer
│   │       ├── architecture-designer
│   │       └── estimator
│   │
│   ├── debugger
│   │   └── Subagents
│   │       ├── error-tracer
│   │       ├── log-analyzer
│   │       └── hypothesis-tester
│   │
│   └── explorer
│       └── Subagents
│           ├── codebase-mapper
│           ├── dependency-tracer
│           └── pattern-finder
│
├── Workflow Agents
│   ├── feature-dev (7-phase workflow)
│   ├── pr-workflow (PR lifecycle)
│   ├── bug-fix (diagnosis → fix → verify)
│   └── refactor (analyze → plan → execute → verify)
│
└── Utility Agents
    ├── conversation-analyzer
    ├── context-builder
    └── memory-manager
```

---

## 4. Primary Agents

### 4.1 Orchestrator Agent

**Purpose:** Main entry point, routes requests to appropriate agents

**File:** `agents/orchestrator.md`

```yaml
---
name: orchestrator
description: |
  Main agent that understands user intent and routes to specialized agents.
  Use this as the default entry point for all interactions.
model: inherit
color: blue
tools: ["*"]  # Full access to determine routing
---
```

**Responsibilities:**
1. Analyze user request intent
2. Determine which primary agent(s) to invoke
3. Manage conversation context
4. Coordinate multi-agent workflows
5. Synthesize results from subagents

**Routing Logic:**

| User Intent Pattern | Route To |
|---------------------|----------|
| "fix", "debug", "error", "broken" | `debugger` |
| "add", "implement", "create", "build" | `coder` or `feature-dev` |
| "review", "check", "audit" | `reviewer` |
| "plan", "design", "architect" | `planner` |
| "explain", "how does", "understand" | `explorer` |
| "refactor", "clean up", "improve" | `refactor` workflow |
| "PR", "pull request" | `pr-workflow` |

---

### 4.2 Coder Agent

**Purpose:** Writes, edits, and generates code

**File:** `agents/coder.md`

```yaml
---
name: coder
description: |
  Use this agent when the user wants to write new code, modify existing code,
  or implement features. Triggers on: "implement", "add", "write code", 
  "create function", "build".
  
  <example>
  Context: User wants to add a new feature
  user: "Add a caching layer to the API"
  assistant: "I'll use the coder agent to implement the caching layer."
  <commentary>
  Implementation request triggers coder agent.
  </commentary>
  </example>
model: inherit
color: green
tools: ["read_file", "write_file", "edit_file", "list_directory", "search_files", "run_command"]
---

You are an expert software engineer specializing in writing clean, maintainable code.

**Your Core Responsibilities:**
1. Understand requirements and existing code patterns
2. Write idiomatic, well-documented code
3. Follow project conventions and style guides
4. Ensure code integrates seamlessly with existing codebase
5. Handle edge cases and error conditions

**Coding Process:**
1. Read relevant files to understand context
2. Identify patterns and conventions used in the project
3. Plan the implementation approach
4. Write code following best practices
5. Verify code compiles/runs correctly
6. Add appropriate comments and documentation

**Quality Standards:**
- Code must be readable and self-documenting
- Follow DRY (Don't Repeat Yourself) principle
- Handle errors gracefully
- Consider performance implications
- Write testable code

**Output Format:**
1. Brief explanation of approach
2. Code changes with file paths
3. Summary of what was implemented
4. Suggestions for testing
```

**Subagents:**

| Subagent | Purpose | Tools |
|----------|---------|-------|
| `code-writer` | Writes new files/functions | `write_file`, `read_file` |
| `refactorer` | Improves existing code | `read_file`, `edit_file`, `search_files` |
| `optimizer` | Performance improvements | `read_file`, `edit_file`, `run_command` |
| `test-writer` | Generates test cases | `read_file`, `write_file`, `run_command` |

---

### 4.3 Reviewer Agent

**Purpose:** Reviews code for quality, bugs, security, and best practices

**File:** `agents/reviewer.md`

```yaml
---
name: reviewer
description: |
  Use this agent when reviewing code for bugs, quality issues, security 
  vulnerabilities, or style compliance. Triggers on: "review", "check code",
  "audit", "look for bugs", "security review".
  
  <example>
  Context: User has written code and wants review
  user: "Review my changes for any issues"
  assistant: "I'll use the reviewer agent to analyze your code."
  <commentary>
  Code review request triggers reviewer agent.
  </commentary>
  </example>
model: inherit
color: yellow
tools: ["read_file", "search_files", "list_directory", "git_diff", "git_status"]
---

You are an expert code reviewer specializing in identifying issues and improvements.

**Your Core Responsibilities:**
1. Analyze code for bugs and logic errors
2. Check for security vulnerabilities
3. Verify adherence to project conventions
4. Identify performance issues
5. Suggest improvements with specific recommendations

**Review Process:**
1. Read the code changes (git diff or specified files)
2. Understand the intent and context
3. Analyze for each review dimension
4. Score confidence for each finding (0-100)
5. Filter to high-confidence issues (≥80)
6. Provide actionable recommendations

**Review Dimensions:**
- **Correctness**: Logic errors, edge cases, null handling
- **Security**: Injection, auth bypass, data exposure
- **Performance**: N+1 queries, memory leaks, inefficient algorithms
- **Maintainability**: Complexity, duplication, readability
- **Conventions**: Project style, naming, documentation

**Output Format:**
## Code Review Summary
[2-3 sentence overview]

## Critical Issues (Must Fix)
- `file:line` - [Issue] - Confidence: X% - [Fix]

## Important Issues (Should Fix)
- `file:line` - [Issue] - Confidence: X% - [Fix]

## Suggestions (Consider)
- `file:line` - [Suggestion]

## Positive Observations
- [What's done well]
```

**Subagents:**

| Subagent | Purpose | Focus |
|----------|---------|-------|
| `bug-scanner` | Find logic errors and bugs | Correctness |
| `security-auditor` | Find security vulnerabilities | OWASP Top 10 |
| `style-checker` | Check code style and conventions | Linting |
| `performance-analyzer` | Find performance issues | Efficiency |
| `comment-analyzer` | Review code comments | Documentation |

---

### 4.4 Planner Agent

**Purpose:** Creates implementation plans and architectural designs

**File:** `agents/planner.md`

```yaml
---
name: planner
description: |
  Use this agent when creating implementation plans, designing architecture,
  or breaking down complex tasks. Triggers on: "plan", "design", "architect",
  "how should I", "break down".
  
  <example>
  Context: User wants to plan a feature
  user: "How should I architect a notification system?"
  assistant: "I'll use the planner agent to design the architecture."
  <commentary>
  Architecture design request triggers planner agent.
  </commentary>
  </example>
model: inherit
color: cyan
tools: ["read_file", "search_files", "list_directory", "beads_create", "beads_ready"]
handoffs:
  - label: Start Implementation
    agent: coder
    prompt: Implement the plan outlined above.
    send: false
---

You are a senior software architect specializing in system design and planning.

**Your Core Responsibilities:**
1. Analyze requirements and constraints
2. Explore existing codebase patterns
3. Design elegant, maintainable solutions
4. Create detailed implementation plans
5. Break down work into actionable tasks

**Planning Process:**
1. Clarify requirements and constraints
2. Research existing patterns in codebase
3. Design multiple approaches with trade-offs
4. Recommend best approach with rationale
5. Create detailed task breakdown
6. Estimate complexity and dependencies

**Output Format:**
## Plan: [Feature Name]

### Overview
[What we're building and why]

### Requirements
- [Requirement 1]
- [Requirement 2]

### Approaches Considered
1. **Approach A**: [Description]
   - Pros: ...
   - Cons: ...
2. **Approach B**: [Description]
   - Pros: ...
   - Cons: ...

### Recommended Approach
[Selection with rationale]

### Implementation Steps
1. [ ] Step 1 - [Description] - Est: X hours
2. [ ] Step 2 - [Description] - Est: X hours

### Technical Details
[Architecture diagram, data flow, interfaces]

### Testing Strategy
[How to verify the implementation]
```

**Subagents:**

| Subagent | Purpose | Output |
|----------|---------|--------|
| `task-decomposer` | Break tasks into subtasks | Task list with dependencies |
| `architecture-designer` | Design system architecture | Architecture blueprint |
| `estimator` | Estimate effort and complexity | Time/complexity estimates |
| `requirements-analyzer` | Extract and clarify requirements | Requirements document |

---

### 4.5 Debugger Agent

**Purpose:** Diagnoses and fixes bugs and errors

**File:** `agents/debugger.md`

```yaml
---
name: debugger
description: |
  Use this agent when diagnosing bugs, understanding errors, or fixing issues.
  Triggers on: "debug", "fix bug", "error", "not working", "broken", "why is".
  
  <example>
  Context: User encounters an error
  user: "Getting a null pointer exception in auth.ts"
  assistant: "I'll use the debugger agent to diagnose and fix the issue."
  <commentary>
  Error debugging request triggers debugger agent.
  </commentary>
  </example>
model: inherit
color: red
tools: ["read_file", "search_files", "run_command", "edit_file", "git_diff"]
---

You are an expert debugger specializing in diagnosing and fixing software issues.

**Your Core Responsibilities:**
1. Understand the error or unexpected behavior
2. Trace the root cause through the code
3. Form and test hypotheses
4. Implement targeted fixes
5. Verify the fix resolves the issue

**Debugging Process:**
1. Gather error information (message, stack trace, reproduction steps)
2. Read relevant code files
3. Form hypothesis about root cause
4. Search for related code patterns
5. Trace execution flow
6. Identify the bug
7. Implement fix with minimal changes
8. Verify fix works

**Output Format:**
## Bug Analysis: [Issue Description]

### Error Details
- **Message**: [Error message]
- **Location**: [File:line]
- **Reproduction**: [Steps to reproduce]

### Root Cause Analysis
[Explanation of why the bug occurs]

### Execution Trace
1. [Entry point]
2. [Code path]
3. [Bug location]

### Fix
[Code changes with explanation]

### Verification
[How to verify the fix]
```

**Subagents:**

| Subagent | Purpose | Approach |
|----------|---------|----------|
| `error-tracer` | Trace error through stack | Stack trace analysis |
| `log-analyzer` | Analyze logs for clues | Pattern matching |
| `hypothesis-tester` | Test debugging hypotheses | Systematic testing |
| `regression-finder` | Find when bug was introduced | Git bisect |

---

### 4.6 Explorer Agent

**Purpose:** Understands and explains codebase structure

**File:** `agents/explorer.md`

```yaml
---
name: explorer
description: |
  Use this agent when exploring, understanding, or explaining code.
  Triggers on: "explain", "how does", "understand", "what is", "trace", "find".
  
  <example>
  Context: User wants to understand code
  user: "How does the authentication system work?"
  assistant: "I'll use the explorer agent to trace the auth flow."
  <commentary>
  Code understanding request triggers explorer agent.
  </commentary>
  </example>
model: inherit
color: magenta
tools: ["read_file", "search_files", "list_directory", "grep_search"]
---

You are an expert code analyst specializing in understanding complex codebases.

**Your Core Responsibilities:**
1. Trace code execution paths
2. Map architecture and dependencies
3. Identify patterns and abstractions
4. Explain code clearly and concisely
5. Document findings for future reference

**Exploration Process:**
1. Identify entry points
2. Trace call chains
3. Map data flow
4. Document abstractions
5. Identify patterns used
6. Summarize architecture

**Output Format:**
## Code Exploration: [Topic]

### Entry Points
- `file:line` - [Description]

### Execution Flow
1. [Step 1] - `file:line`
2. [Step 2] - `file:line`

### Architecture
[Layers, components, relationships]

### Key Patterns
- [Pattern 1]: Used for [purpose]
- [Pattern 2]: Used for [purpose]

### Data Flow
[How data moves through the system]

### Key Files
- `file1.ts` - [Purpose]
- `file2.ts` - [Purpose]
```

**Subagents:**

| Subagent | Purpose | Focus |
|----------|---------|-------|
| `codebase-mapper` | Map overall structure | Architecture |
| `dependency-tracer` | Trace dependencies | Dependencies |
| `pattern-finder` | Identify design patterns | Patterns |
| `api-documenter` | Document APIs | Documentation |

---

## 5. Workflow Agents

### 5.1 Feature Development Workflow

**File:** `agents/workflows/feature-dev.md`

```yaml
---
name: feature-dev
description: |
  Guided feature development with 7 phases: Discovery, Exploration, 
  Clarification, Architecture, Implementation, Review, Summary.
  Use for complex features requiring planning and design.
model: inherit
color: green
tools: ["*"]
---
```

**Phases:**

| Phase | Name | Description | Agents Used |
|-------|------|-------------|-------------|
| 1 | **Discovery** | Understand requirements | Orchestrator |
| 2 | **Exploration** | Analyze codebase | `explorer` (2-3 parallel) |
| 3 | **Clarification** | Ask clarifying questions | Orchestrator |
| 4 | **Architecture** | Design approaches | `planner` (2-3 parallel) |
| 5 | **Implementation** | Build the feature | `coder` |
| 6 | **Review** | Quality check | `reviewer` (3 parallel) |
| 7 | **Summary** | Document completion | Orchestrator |

**Handoffs:**

```yaml
handoffs:
  - label: Explore Codebase
    agent: explorer
    prompt: Explore the codebase for patterns relevant to this feature.
  - label: Design Architecture
    agent: planner
    prompt: Design the architecture based on exploration findings.
  - label: Start Implementation
    agent: coder
    prompt: Implement the approved design.
  - label: Review Code
    agent: reviewer
    prompt: Review the implementation for issues.
```

---

### 5.2 PR Workflow

**File:** `agents/workflows/pr-workflow.md`

```yaml
---
name: pr-workflow
description: |
  Complete PR lifecycle: branch → implement → commit → push → PR → review → merge.
  Use when creating pull requests from scratch or managing existing PRs.
model: inherit
color: blue
tools: ["git_*", "github_*", "read_file", "edit_file"]
---
```

**Stages:**

| Stage | Description | Commands |
|-------|-------------|----------|
| 1. Branch | Create feature branch | `git checkout -b` |
| 2. Implement | Make changes | `coder` agent |
| 3. Commit | Stage and commit | `git add`, `git commit` |
| 4. Push | Push to remote | `git push -u origin` |
| 5. Create PR | Open pull request | `gh pr create` |
| 6. Review | Self-review or request | `reviewer` agent |
| 7. Merge | Merge when approved | `gh pr merge` |

---

### 5.3 Bug Fix Workflow

**File:** `agents/workflows/bug-fix.md`

```yaml
---
name: bug-fix
description: |
  Structured bug fixing: Diagnose → Reproduce → Fix → Verify → Document.
  Use when fixing bugs with proper process.
model: inherit
color: red
tools: ["*"]
handoffs:
  - label: Create PR for Fix
    agent: pr-workflow
    prompt: Create a PR with the bug fix.
---
```

**Stages:**

| Stage | Description | Agent |
|-------|-------------|-------|
| 1. Diagnose | Understand the bug | `debugger` |
| 2. Reproduce | Confirm reproduction | `debugger.hypothesis-tester` |
| 3. Fix | Implement fix | `coder` |
| 4. Verify | Test the fix | `debugger` |
| 5. Review | Check fix quality | `reviewer` |
| 6. Document | Update docs/tests | `coder.test-writer` |

---

### 5.4 Refactor Workflow

**File:** `agents/workflows/refactor.md`

```yaml
---
name: refactor
description: |
  Structured refactoring: Analyze → Plan → Execute → Verify → Document.
  Use for safe, systematic code improvements.
model: inherit
color: yellow
tools: ["read_file", "edit_file", "search_files", "run_command"]
---
```

**Stages:**

| Stage | Description | Agent |
|-------|-------------|-------|
| 1. Analyze | Identify refactoring targets | `explorer` |
| 2. Plan | Design refactoring approach | `planner` |
| 3. Execute | Apply refactorings | `coder.refactorer` |
| 4. Verify | Run tests, check correctness | `reviewer` |
| 5. Document | Update documentation | `coder` |

---

## 6. Specialized Subagents

### 6.1 Analysis Subagents

| Agent | Description | Tools | Trigger |
|-------|-------------|-------|---------|
| `bug-scanner` | Scans for bugs and logic errors | `read_file`, `grep_search` | Code review |
| `security-auditor` | OWASP-focused security review | `read_file`, `grep_search` | Security review |
| `performance-analyzer` | Find performance issues | `read_file`, `run_command` | Performance review |
| `complexity-analyzer` | Measure code complexity | `read_file`, `grep_search` | Refactor planning |
| `dependency-analyzer` | Analyze dependencies | `read_file`, `list_directory` | Upgrade planning |

### 6.2 Generation Subagents

| Agent | Description | Tools | Trigger |
|-------|-------------|-------|---------|
| `test-generator` | Generate test cases | `read_file`, `write_file` | Test creation |
| `doc-generator` | Generate documentation | `read_file`, `write_file` | Doc creation |
| `type-generator` | Generate TypeScript types | `read_file`, `write_file` | Type definitions |
| `mock-generator` | Generate mocks/fixtures | `read_file`, `write_file` | Test setup |
| `migration-generator` | Generate migrations | `read_file`, `write_file` | Database changes |

### 6.3 Validation Subagents

| Agent | Description | Tools | Trigger |
|-------|-------------|-------|---------|
| `type-checker` | Validate TypeScript types | `run_command` | Type errors |
| `lint-checker` | Run linting | `run_command` | Style violations |
| `test-runner` | Run test suites | `run_command` | Test validation |
| `build-validator` | Validate build | `run_command` | Build check |
| `schema-validator` | Validate schemas | `read_file`, `run_command` | API changes |

### 6.4 Orchestration Subagents

| Agent | Description | Purpose |
|-------|-------------|---------|
| `conversation-analyzer` | Analyze chat for patterns | Extract feedback |
| `context-builder` | Build relevant context | Gather files |
| `memory-manager` | Manage Beads tasks | Task tracking |
| `parallel-coordinator` | Coordinate parallel agents | Multi-agent runs |

---

## 7. Skills

Skills are reusable knowledge modules that agents can reference.

### 7.1 Skill Structure

```
skills/
├── code-standards/
│   ├── SKILL.md              # Main skill file
│   └── references/
│       ├── style-guide.md
│       ├── naming-conventions.md
│       └── error-handling.md
├── testing/
│   ├── SKILL.md
│   └── references/
│       ├── unit-testing.md
│       ├── integration-testing.md
│       └── mocking.md
├── security/
│   ├── SKILL.md
│   └── references/
│       ├── owasp-top-10.md
│       ├── authentication.md
│       └── input-validation.md
└── git-workflow/
    ├── SKILL.md
    └── references/
        ├── branching.md
        ├── commit-messages.md
        └── pr-best-practices.md
```

### 7.2 Skill Format

```markdown
---
name: code-standards
description: |
  This skill should be used when enforcing code standards, reviewing code style,
  or writing new code that needs to follow project conventions.
version: 1.0.0
---

# Code Standards

## Naming Conventions
- Use camelCase for variables and functions
- Use PascalCase for classes and types
- Use SCREAMING_SNAKE_CASE for constants

## File Organization
- One component per file
- Group by feature, not type
- Keep files under 300 lines

## Error Handling
- Always catch specific errors
- Log errors with context
- Use custom error classes

[See references/style-guide.md for full details]
```

### 7.3 Skill Catalog

| Skill | Purpose | Referenced By |
|-------|---------|---------------|
| `code-standards` | Project coding conventions | `coder`, `reviewer` |
| `testing` | Testing best practices | `test-generator`, `test-runner` |
| `security` | Security guidelines | `security-auditor` |
| `git-workflow` | Git best practices | `pr-workflow` |
| `typescript` | TypeScript patterns | `type-checker`, `coder` |
| `react` | React best practices | `coder` (frontend) |
| `api-design` | REST/GraphQL patterns | `coder`, `planner` |
| `database` | Database patterns | `migration-generator` |
| `performance` | Performance optimization | `performance-analyzer` |
| `documentation` | Documentation standards | `doc-generator` |

---

## 8. Hooks

Hooks intercept events in the agent lifecycle for validation, logging, or modification.

### 8.1 Hook Events

| Event | When Fired | Use Cases |
|-------|------------|-----------|
| `PreToolUse` | Before tool execution | Validate, modify, block |
| `PostToolUse` | After tool execution | Log, analyze, react |
| `UserPromptSubmit` | User sends message | Add context, validate |
| `SessionStart` | Session begins | Load context, setup |
| `SessionEnd` | Session ends | Cleanup, save state |
| `Stop` | Agent wants to stop | Verify completeness |
| `SubagentStop` | Subagent finishes | Validate subtask |
| `PreCompact` | Before context compaction | Preserve important context |
| `Notification` | User notified | Logging, reactions |

### 8.2 Hook Types

#### Command Hooks (Deterministic)

```json
{
  "PreToolUse": [
    {
      "matcher": "run_command",
      "hooks": [
        {
          "type": "command",
          "command": "bash ${SHARKBAIT_ROOT}/hooks/validate-command.sh",
          "timeout": 30
        }
      ]
    }
  ]
}
```

#### Prompt Hooks (LLM-Driven)

```json
{
  "Stop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Verify task is complete: tests pass, build succeeds, user question answered. Return 'approve' to stop or 'block' with reason.",
          "timeout": 30
        }
      ]
    }
  ]
}
```

### 8.3 Hook Catalog

| Hook | Event | Purpose | Type |
|------|-------|---------|------|
| `validate-dangerous-commands` | PreToolUse | Block rm -rf, etc. | Command |
| `log-tool-usage` | PostToolUse | Audit trail | Command |
| `add-project-context` | SessionStart | Load CLAUDE.md | Prompt |
| `verify-task-complete` | Stop | Ensure completeness | Prompt |
| `validate-file-edit` | PreToolUse | Check file patterns | Command |
| `notify-breaking-change` | PostToolUse | Detect API changes | Prompt |
| `enforce-test-coverage` | Stop | Require tests | Prompt |
| `preserve-beads-context` | PreCompact | Keep task context | Prompt |

### 8.4 Hook Configuration

**File:** `hooks/hooks.json`

```json
{
  "PreToolUse": [
    {
      "matcher": "run_command|edit_file|write_file",
      "hooks": [
        {
          "type": "command",
          "command": "node ${SHARKBAIT_ROOT}/hooks/validate-operation.js",
          "timeout": 5
        }
      ]
    }
  ],
  "SessionStart": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Load project context from CLAUDE.md if it exists. Identify key conventions and add to context."
        }
      ]
    }
  ],
  "Stop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Before stopping, verify:\n1. User's question is fully answered\n2. All code changes compile\n3. Tests pass (if applicable)\n4. Beads tasks updated\nReturn 'approve' if complete, 'block' with reason if not."
        }
      ]
    }
  ],
  "SubagentStop": [
    {
      "matcher": "*",
      "hooks": [
        {
          "type": "prompt",
          "prompt": "Verify subagent completed its assigned task. Check output quality. Return 'approve' or 'block'."
        }
      ]
    }
  ]
}
```

---

## 9. Commands

Commands are user-invokable actions that trigger specific workflows.

### 9.1 Command Format

```markdown
---
description: Brief description shown in help
argument-hint: [optional-args]
allowed-tools: ["tool1", "tool2"]
---

# Command Title

Instructions for executing this command.

$ARGUMENTS contains user input after command name.
```

### 9.2 Command Catalog

| Command | Description | Workflow |
|---------|-------------|----------|
| `/plan` | Create implementation plan | `planner` |
| `/implement` | Implement a feature | `coder` |
| `/review` | Review code changes | `reviewer` |
| `/debug` | Debug an issue | `debugger` |
| `/explain` | Explain code | `explorer` |
| `/feature-dev` | Full feature workflow | `feature-dev` workflow |
| `/pr` | Create pull request | `pr-workflow` |
| `/fix` | Fix a bug | `bug-fix` workflow |
| `/refactor` | Refactor code | `refactor` workflow |
| `/test` | Generate tests | `test-generator` |
| `/doc` | Generate documentation | `doc-generator` |
| `/commit` | Commit changes | Git workflow |

### 9.3 Command Examples

#### `/plan` Command

```markdown
---
description: Create an implementation plan for a feature
argument-hint: [feature description]
allowed-tools: ["read_file", "search_files", "list_directory", "beads_create"]
---

# Implementation Planning

You are creating an implementation plan for: $ARGUMENTS

## Process:
1. Understand the feature request
2. Explore relevant codebase areas
3. Identify existing patterns
4. Design implementation approach
5. Break into actionable tasks
6. Create Beads tasks for tracking

## Output:
Provide a detailed plan following the planner agent format.
```

#### `/review` Command

```markdown
---
description: Review code for issues
argument-hint: [file or "changes"]
allowed-tools: ["read_file", "git_diff", "git_status", "search_files"]
---

# Code Review

Reviewing: $ARGUMENTS

If "changes" or empty, review git diff.
Otherwise, review specified file(s).

Launch 3 reviewer subagents in parallel:
1. bug-scanner - Focus on correctness
2. security-auditor - Focus on security
3. style-checker - Focus on conventions

Consolidate findings, filter by confidence (≥80), present report.
```

---

## 10. Tool Sets

Tool sets group related tools for easy reference.

### 10.1 Tool Set Definitions

```json
{
  "read-only": {
    "tools": ["read_file", "search_files", "list_directory", "grep_search", "git_status", "git_diff"],
    "description": "Tools for reading and analyzing without modification",
    "icon": "eye"
  },
  "write": {
    "tools": ["write_file", "edit_file", "create_directory"],
    "description": "Tools for creating and modifying files",
    "icon": "edit"
  },
  "git": {
    "tools": ["git_status", "git_diff", "git_commit", "git_push", "git_branch"],
    "description": "Git operations",
    "icon": "git-branch"
  },
  "github": {
    "tools": ["github_create_pr", "github_list_prs", "github_merge_pr", "github_create_issue"],
    "description": "GitHub operations",
    "icon": "github"
  },
  "beads": {
    "tools": ["beads_ready", "beads_create", "beads_done", "beads_show", "beads_list"],
    "description": "Beads task management",
    "icon": "checklist"
  },
  "shell": {
    "tools": ["run_command"],
    "description": "Shell command execution",
    "icon": "terminal"
  },
  "search": {
    "tools": ["search_files", "grep_search"],
    "description": "Code search tools",
    "icon": "search"
  }
}
```

### 10.2 Tool Set Usage by Agent

| Agent | Tool Sets | Why |
|-------|-----------|-----|
| `planner` | `read-only`, `beads` | Planning doesn't modify code |
| `reviewer` | `read-only`, `git` | Review is analysis only |
| `coder` | `read-only`, `write`, `shell` | Needs full edit access |
| `explorer` | `read-only`, `search` | Exploration only |
| `debugger` | `read-only`, `write`, `shell` | May need to fix |
| `pr-workflow` | `git`, `github`, `write` | Full git/GitHub access |

---

## 11. Handoffs & Workflows

### 11.1 Handoff Definition

Handoffs enable guided transitions between agents:

```yaml
handoffs:
  - label: "Start Implementation"     # Button text
    agent: coder                       # Target agent
    prompt: "Implement the plan."     # Pre-filled prompt
    send: false                        # Auto-submit?
```

### 11.2 Standard Handoff Chains

#### Planning → Implementation
```
planner → coder → reviewer → pr-workflow
```

#### Bug Report → Fix
```
debugger → coder → reviewer → pr-workflow
```

#### Exploration → Feature
```
explorer → planner → coder → reviewer
```

### 11.3 Parallel Agent Execution

For comprehensive analysis, run agents in parallel:

```typescript
// Launch 3 review agents in parallel
const reviews = await Promise.all([
  launchSubagent("bug-scanner", { focus: "correctness" }),
  launchSubagent("security-auditor", { focus: "security" }),
  launchSubagent("style-checker", { focus: "conventions" }),
]);

// Consolidate findings
const consolidated = consolidateReviews(reviews);
```

---

## 12. Agent Configuration

### 12.1 Agent File Format

```markdown
---
# Required
name: agent-identifier              # 3-50 chars, lowercase, hyphens
description: |                      # Triggering conditions with examples
  Use this agent when...
  
  <example>
  Context: [situation]
  user: "[request]"
  assistant: "[response]"
  <commentary>[why this triggers]</commentary>
  </example>

# Optional
model: inherit                      # inherit, sonnet, haiku, opus
color: blue                         # blue, cyan, green, yellow, magenta, red
tools: ["read_file", "write_file", "grep_search"]  # Restrict tools (omit for all)
handoffs:                           # Suggested next agents
  - label: "Next Step"
    agent: next-agent
    prompt: "Continue with..."
---

# System Prompt (Body)

You are [role description]...

**Your Core Responsibilities:**
1. [Responsibility 1]
2. [Responsibility 2]

**Process:**
1. [Step 1]
2. [Step 2]

**Quality Standards:**
- [Standard 1]
- [Standard 2]

**Output Format:**
[Structured output template]

**Edge Cases:**
- [Case 1]: [Handling]
- [Case 2]: [Handling]
```

### 12.2 Best Practices

**DO:**
- ✅ Include 2-4 triggering examples in description
- ✅ Write specific triggering conditions
- ✅ Use `inherit` for model unless specific need
- ✅ Choose appropriate tools (least privilege)
- ✅ Write clear, structured system prompts
- ✅ Define output format explicitly
- ✅ Address edge cases

**DON'T:**
- ❌ Use generic descriptions without examples
- ❌ Omit triggering conditions
- ❌ Give all agents same color
- ❌ Grant unnecessary tool access
- ❌ Write vague system prompts
- ❌ Skip testing

---

## 13. Directory Structure

```
sharkbait/
├── agents/
│   ├── orchestrator.md
│   ├── coder.md
│   ├── reviewer.md
│   ├── planner.md
│   ├── debugger.md
│   ├── explorer.md
│   ├── subagents/
│   │   ├── bug-scanner.md
│   │   ├── security-auditor.md
│   │   ├── test-generator.md
│   │   ├── doc-generator.md
│   │   └── ...
│   └── workflows/
│       ├── feature-dev.md
│       ├── pr-workflow.md
│       ├── bug-fix.md
│       └── refactor.md
├── skills/
│   ├── code-standards/
│   │   ├── SKILL.md
│   │   └── references/
│   ├── testing/
│   ├── security/
│   └── ...
├── hooks/
│   ├── hooks.json
│   └── scripts/
│       ├── validate-command.sh
│       ├── validate-file-edit.js
│       └── ...
├── commands/
│   ├── plan.md
│   ├── implement.md
│   ├── review.md
│   ├── debug.md
│   └── ...
├── tool-sets/
│   └── tool-sets.json
└── config/
    └── agent-config.json
```

---

## 14. Complete Agent Inventory

### 14.1 Summary Table

| Category | Count | Examples |
|----------|-------|----------|
| **Primary Agents** | 6 | orchestrator, coder, reviewer, planner, debugger, explorer |
| **Workflow Agents** | 4 | feature-dev, pr-workflow, bug-fix, refactor |
| **Analysis Subagents** | 5 | bug-scanner, security-auditor, performance-analyzer, complexity-analyzer, dependency-analyzer |
| **Generation Subagents** | 5 | test-generator, doc-generator, type-generator, mock-generator, migration-generator |
| **Validation Subagents** | 5 | type-checker, lint-checker, test-runner, build-validator, schema-validator |
| **Utility Subagents** | 4 | conversation-analyzer, context-builder, memory-manager, parallel-coordinator |
| **Skills** | 10 | code-standards, testing, security, git-workflow, typescript, react, api-design, database, performance, documentation |
| **Hooks** | 8 | validate-dangerous-commands, log-tool-usage, add-project-context, verify-task-complete, validate-file-edit, notify-breaking-change, enforce-test-coverage, preserve-beads-context |
| **Commands** | 12 | /plan, /implement, /review, /debug, /explain, /feature-dev, /pr, /fix, /refactor, /test, /doc, /commit |
| **Tool Sets** | 7 | read-only, write, git, github, beads, shell, search |

### 14.2 Full Agent List

```
AGENTS (29 total)
├── Primary (6)
│   ├── orchestrator
│   ├── coder
│   ├── reviewer
│   ├── planner
│   ├── debugger
│   └── explorer
├── Workflows (4)
│   ├── feature-dev
│   ├── pr-workflow
│   ├── bug-fix
│   └── refactor
├── Coder Subagents (4)
│   ├── code-writer
│   ├── refactorer
│   ├── optimizer
│   └── test-writer
├── Reviewer Subagents (5)
│   ├── bug-scanner
│   ├── security-auditor
│   ├── style-checker
│   ├── performance-analyzer
│   └── comment-analyzer
├── Planner Subagents (4)
│   ├── task-decomposer
│   ├── architecture-designer
│   ├── estimator
│   └── requirements-analyzer
├── Debugger Subagents (4)
│   ├── error-tracer
│   ├── log-analyzer
│   ├── hypothesis-tester
│   └── regression-finder
├── Explorer Subagents (4)
│   ├── codebase-mapper
│   ├── dependency-tracer
│   ├── pattern-finder
│   └── api-documenter
└── Utility (4)
    ├── conversation-analyzer
    ├── context-builder
    ├── memory-manager
    └── parallel-coordinator
```

---

## 15. Implementation Priority

### Phase 1: Core (Week 1-2)
- [ ] Orchestrator agent
- [ ] Coder agent
- [ ] Reviewer agent
- [ ] Basic hooks (PreToolUse, Stop)
- [ ] Core commands (/implement, /review)

### Phase 2: Planning & Debug (Week 3-4)
- [ ] Planner agent
- [ ] Debugger agent
- [ ] Explorer agent
- [ ] Task decomposition subagent
- [ ] Bug-scanner subagent

### Phase 3: Workflows (Week 5-6)
- [ ] Feature-dev workflow
- [ ] PR-workflow
- [ ] Bug-fix workflow
- [ ] All handoffs configured

### Phase 4: Advanced (Week 7-8)
- [ ] All subagents
- [ ] All skills
- [ ] All hooks
- [ ] All commands
- [ ] Parallel agent execution

---

## 16. Appendix

### A. Color Coding Convention

| Color | Agent Type |
|-------|------------|
| Blue | Orchestration, routing |
| Green | Creation, implementation |
| Yellow | Analysis, review |
| Red | Debugging, errors |
| Cyan | Planning, architecture |
| Magenta | Exploration, documentation |

### B. Model Selection Guidelines

| Scenario | Model | Reason |
|----------|-------|--------|
| Default | `inherit` | Use user's selection |
| Complex reasoning | `sonnet` | Better analysis |
| Simple tasks | `haiku` | Faster, cheaper |
| Critical decisions | `opus` | Maximum capability |

### C. Tool Privilege Levels

| Level | Tools | Use Case |
|-------|-------|----------|
| Read-only | `read_file`, `search_files`, `list_directory` | Analysis, planning |
| Write | + `write_file`, `edit_file` | Implementation |
| Execute | + `run_command` | Build, test |
| Full | + `git_*`, `github_*`, `beads_*` | Workflows |
