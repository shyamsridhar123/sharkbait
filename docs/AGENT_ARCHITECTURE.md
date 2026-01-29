# Sharkbait - Agent Architecture Specification

**Version:** 1.1  
**Date:** January 28, 2026  
**Status:** Draft (Updated with industry best practices)

---

## 1. Overview

This document defines a comprehensive agent architecture for Sharkbait, inspired by:
- **Microsoft Research Magentic-One** (orchestrator pattern, dual-ledger progress tracking, stall detection)
- **Anthropic's "Building Effective Agents"** (simplicity-first, evaluator-optimizer loops, parallel execution)
- VS Code Custom Agents (`.agent.md` format, handoffs, tool restrictions)
- Claude Code Plugins (agents, skills, hooks, commands)

### 1.1 Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Simplicity First** | 5 primary agents instead of 25+ subagents; use prompting modes |
| **Stall Detection** | Dual-ledger system (Task + Progress) with automatic recovery |
| **Iterative Refinement** | Evaluator-optimizer loops between agents (reviewer ↔ coder) |
| **Parallel Execution** | Fan-out/fan-in coordination for independent tasks |
| **Model Flexibility** | Different models for different agent roles |
| **Action Reversibility** | Classify actions by reversibility before execution |
| **Context Management** | Intelligent compaction preserving critical context |

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
│    (Routes requests, tracks progress, detects stalls, coordinates)          │
│    [Task Ledger] ←→ [Progress Ledger] ←→ [Context Manager]                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Primary      │          │  Prompting    │          │   Workflow    │
│  Agents (5)   │          │  Modes        │          │   Agents      │
├───────────────┤          ├───────────────┤          ├───────────────┤
│ • Coder       │   uses   │ --mode=bugs   │          │ • Feature Dev │
│ • Reviewer    │ ──────── │ --mode=security│         │ • PR Workflow │
│ • Planner     │          │ --mode=test   │          │ • Bug Fix     │
│ • Debugger    │          │ --mode=refactor│         │ • Refactor    │
│ • Explorer    │          │ --mode=...    │          │               │
└───────────────┘          └───────────────┘          └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        │   Iterative Loops     │
                        │ (Reviewer ↔ Coder)    │
                        └───────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TOOL LAYER                                      │
│    (File Ops, Shell, Git, GitHub, Beads, Search, Fetch, MCP Servers)        │
│    [Reversibility Classification: Easy | Effort | Irreversible]             │
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

### 3.1 Design Philosophy

> **Simplicity First**: Start with the minimum viable agent set. Add complexity only when demonstrably needed.
> — Anthropic, "Building Effective Agents"

This architecture follows the **orchestrator-workers pattern** validated by Microsoft Research (Magentic-One) and Anthropic's production deployments. We prioritize:
1. **Fewer, more capable agents** over many specialized subagents
2. **Stall detection and recovery** over blind execution
3. **Iterative refinement loops** over single-pass workflows
4. **Parallel execution** where tasks are independent

### 3.2 Agent Classification

| Type | Description | Autonomy Level | Example |
|------|-------------|----------------|---------|
| **Orchestrator** | Routes requests, tracks progress, manages recovery | Full | Main agent |
| **Primary Agent** | Handles major task categories with full capability | High | `coder`, `reviewer` |
| **Workflow Agent** | Multi-phase orchestrated process | High | `feature-dev` |

> **Note**: We intentionally avoid deep subagent hierarchies. Specialized behaviors (bug scanning, security auditing, test generation) are implemented as **prompting modes** within primary agents, not separate agents. This reduces latency, cost, and complexity.

### 3.3 Agent Hierarchy (Simplified)

```
Orchestrator (sharkbait)
│
├── Primary Agents (5 core agents)
│   ├── coder       → Writes, edits, refactors code
│   ├── reviewer    → Reviews code (bugs, security, style, performance)
│   ├── planner     → Designs architecture, creates implementation plans
│   ├── debugger    → Diagnoses and fixes bugs
│   └── explorer    → Understands and explains codebase
│
├── Workflow Agents (orchestrate multi-phase processes)
│   ├── feature-dev → Discovery → Plan → Implement → Review → Ship
│   ├── pr-workflow → Branch → Commit → Push → PR → Review → Merge
│   ├── bug-fix     → Diagnose → Fix → Verify → Document
│   └── refactor    → Analyze → Plan → Execute → Verify
│
└── Orchestration Utilities (built into orchestrator, not separate agents)
    ├── Progress Tracker   → Stall detection, recovery
    ├── Context Manager    → Token management, compaction
    └── Parallel Executor  → Fan-out/fan-in coordination
```

### 3.4 Prompting Modes vs. Subagents

Instead of 25+ subagents, primary agents support **prompting modes** that focus their behavior:

| Primary Agent | Prompting Modes (via system prompt injection) |
|---------------|----------------------------------------------|
| `coder` | `--mode=write`, `--mode=refactor`, `--mode=test`, `--mode=docs` |
| `reviewer` | `--mode=bugs`, `--mode=security`, `--mode=style`, `--mode=performance` |
| `planner` | `--mode=architecture`, `--mode=tasks`, `--mode=estimate` |
| `debugger` | `--mode=trace`, `--mode=hypothesis`, `--mode=fix` |
| `explorer` | `--mode=map`, `--mode=dependencies`, `--mode=patterns` |

This approach:
- Reduces agent spawning overhead
- Maintains context within a single agent
- Allows easy parallel execution (same agent, different modes)
- Simplifies testing and debugging

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
3. **Track progress and detect stalls** (dual-ledger system)
4. Manage conversation context
5. Coordinate multi-agent workflows
6. **Trigger recovery and re-planning** when progress stalls
7. Synthesize results from agents

### 4.1.1 Dual-Ledger Progress Tracking (Inspired by Magentic-One)

The orchestrator maintains two ledgers for robust task execution:

```typescript
interface TaskLedger {
  // Outer loop - high-level planning
  taskId: string;
  objective: string;
  facts: string[];           // Known truths about the task
  assumptions: string[];     // Educated guesses that may be wrong
  plan: PlanStep[];          // Current execution plan
  createdAt: Date;
  lastReplanAt: Date;
}

interface ProgressLedger {
  // Inner loop - execution tracking
  currentStep: number;
  stepHistory: StepResult[];
  stallCount: number;        // Consecutive steps without progress
  lastProgressAt: Date;
  agentAssignments: Map<string, AgentAssignment>;
}

interface StepResult {
  stepId: number;
  agent: string;
  action: string;
  outcome: "success" | "partial" | "failed" | "blocked";
  progressMade: boolean;     // Did this step advance the task?
  notes: string;
}
```

**Stall Detection Algorithm:**

```typescript
const STALL_THRESHOLD = 3;  // Max steps without progress before re-planning
const MAX_REPLANS = 2;      // Max re-planning attempts before escalation

function checkProgress(progress: ProgressLedger, task: TaskLedger): Action {
  if (isTaskComplete(progress)) {
    return { type: "complete" };
  }
  
  if (progress.stallCount >= STALL_THRESHOLD) {
    if (task.replanCount >= MAX_REPLANS) {
      return { type: "escalate", reason: "Repeated stalls, human intervention needed" };
    }
    return { type: "replan", reason: "No progress after " + STALL_THRESHOLD + " steps" };
  }
  
  return { type: "continue", nextAgent: selectNextAgent(progress, task) };
}
```

**Recovery Strategies:**

| Stall Type | Detection | Recovery Action |
|------------|-----------|-----------------|
| Agent loops | Same tool called 3+ times with same args | Force agent switch |
| No progress | 3 steps without `progressMade: true` | Re-plan with updated facts |
| Repeated failures | Same error 2+ times | Update assumptions, try alternative |
| Resource blocked | Tool returns "access denied" | Escalate to user |
| Context overflow | Token limit approaching | Compact context, preserve key facts |

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

### 5.0 Iterative Refinement Pattern (Evaluator-Optimizer)

All workflows incorporate **iterative refinement loops** where output is evaluated and improved:

```typescript
// The evaluator-optimizer pattern
async function iterativeRefinement<T>(
  generate: () => Promise<T>,
  evaluate: (result: T) => Promise<Evaluation>,
  improve: (result: T, feedback: Evaluation) => Promise<T>,
  maxIterations: number = 3
): Promise<T> {
  let result = await generate();
  
  for (let i = 0; i < maxIterations; i++) {
    const evaluation = await evaluate(result);
    
    if (evaluation.approved) {
      return result;
    }
    
    if (evaluation.severity === "critical") {
      result = await improve(result, evaluation);
    } else {
      // Minor issues - return with notes
      return { ...result, notes: evaluation.suggestions };
    }
  }
  
  throw new Error("Max refinement iterations reached");
}

interface Evaluation {
  approved: boolean;
  severity: "none" | "minor" | "major" | "critical";
  issues: Issue[];
  suggestions: string[];
}
```

**Example: Coder → Reviewer → Coder Loop**

```typescript
// After coder writes code, reviewer evaluates
const code = await coder.write(requirements);
const review = await reviewer.evaluate(code, { mode: "bugs" });

if (!review.approved && review.issues.some(i => i.severity === "critical")) {
  // Feed review back to coder for fixes
  const fixedCode = await coder.fix({
    originalCode: code,
    issues: review.issues,
    suggestions: review.suggestions,
  });
  
  // Re-review the fixes
  const reReview = await reviewer.evaluate(fixedCode, { mode: "bugs" });
  // ... continue until approved or max iterations
}
```

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
| 2 | **Exploration** | Analyze codebase | `explorer` (parallel modes) |
| 3 | **Clarification** | Ask clarifying questions | Orchestrator |
| 4 | **Architecture** | Design approaches | `planner` |
| 5 | **Implementation** | Build the feature | `coder` |
| 6 | **Review** | Quality check (with refinement loop) | `reviewer` ↔ `coder` |
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

**Stages (with Refinement Loops):**

| Stage | Description | Agent | Refinement |
|-------|-------------|-------|------------|
| 1. Diagnose | Understand the bug | `debugger --mode=trace` | - |
| 2. Reproduce | Confirm reproduction | `debugger --mode=hypothesis` | - |
| 3. Fix | Implement fix | `coder --mode=write` | - |
| 4. Verify | Test the fix | `debugger` | If fails → back to Fix |
| 5. Review | Check fix quality | `reviewer` | If issues → back to Fix |
| 6. Document | Update docs/tests | `coder --mode=test` | - |

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

## 6. Prompting Modes (Replacing Subagents)

Instead of spawning separate subagents, primary agents support **focused prompting modes** that specialize their behavior through system prompt injection.

### 6.1 Reviewer Modes

The `reviewer` agent supports parallel execution with different modes:

```typescript
// Launch reviewer in multiple modes simultaneously
const reviews = await Promise.all([
  runAgent("reviewer", { mode: "bugs", context }),
  runAgent("reviewer", { mode: "security", context }),
  runAgent("reviewer", { mode: "style", context }),
]);

// Consolidate findings
const consolidated = consolidateReviews(reviews, { minConfidence: 80 });
```

| Mode | Focus | Confidence Threshold |
|------|-------|---------------------|
| `bugs` | Logic errors, null handling, edge cases | 80% |
| `security` | OWASP Top 10, injection, auth bypass | 90% |
| `style` | Naming, formatting, conventions | 70% |
| `performance` | N+1 queries, memory leaks, complexity | 75% |

### 6.2 Coder Modes

```typescript
// Mode-specific system prompt additions
const coderModes = {
  write: "Focus on writing new code. Follow existing patterns.",
  refactor: "Focus on improving structure without changing behavior.",
  test: "Focus on generating comprehensive test cases.",
  docs: "Focus on generating documentation and comments.",
};
```

### 6.3 Planner Modes

| Mode | Output |
|------|--------|
| `architecture` | System design with diagrams and component relationships |
| `tasks` | Task breakdown with dependencies (Beads format) |
| `estimate` | Effort estimates with confidence ranges |

### 6.4 How Modes Work

Modes are implemented via **system prompt injection**, not separate agents:

```typescript
async function runAgentWithMode(
  agent: Agent,
  mode: string,
  context: Context
): Promise<AgentResult> {
  const modePrompt = agent.modes[mode];
  if (!modePrompt) throw new Error(`Unknown mode: ${mode}`);
  
  // Inject mode-specific instructions into system prompt
  const enhancedSystemPrompt = `
${agent.systemPrompt}

## Current Mode: ${mode}
${modePrompt}

Focus exclusively on ${mode}-related concerns for this execution.
`;

  return agent.run({
    ...context,
    systemPrompt: enhancedSystemPrompt,
  });
}
```

**Benefits over Subagents:**
- Single agent maintains full context
- No handoff latency between agents
- Easier to test and debug
- Parallel modes use same model, cheaper than separate agents

---

## 6.5 Parallel Execution Coordinator

For tasks that benefit from multiple perspectives, the orchestrator coordinates parallel agent execution:

```typescript
interface ParallelExecutionConfig {
  agents: AgentInvocation[];
  strategy: "all" | "race" | "quorum";
  timeout: number;
  consolidation: "merge" | "vote" | "best";
}

interface AgentInvocation {
  agent: string;
  mode?: string;
  context: Context;
  weight?: number;  // For weighted voting
}

// Parallel execution strategies
type Strategy = {
  all: "Wait for all agents to complete, then consolidate";
  race: "Return result from first agent to complete";
  quorum: "Return when majority agree on result";
};

async function executeParallel(config: ParallelExecutionConfig): Promise<ConsolidatedResult> {
  const { agents, strategy, timeout, consolidation } = config;
  
  // Launch all agents concurrently
  const promises = agents.map(async (invocation) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const result = await runAgentWithMode(
        invocation.agent,
        invocation.mode,
        { ...invocation.context, signal: controller.signal }
      );
      return { status: "success", result, agent: invocation.agent };
    } catch (error) {
      return { status: "failed", error, agent: invocation.agent };
    } finally {
      clearTimeout(timeoutId);
    }
  });
  
  // Apply strategy
  switch (strategy) {
    case "race":
      return Promise.race(promises);
      
    case "quorum":
      return waitForQuorum(promises, Math.ceil(agents.length / 2));
      
    case "all":
    default:
      const results = await Promise.allSettled(promises);
      return consolidateResults(results, consolidation);
  }
}
```

**Consolidation Strategies:**

| Strategy | Use Case | Implementation |
|----------|----------|----------------|
| `merge` | Combine unique findings (reviews) | Dedupe by finding, merge contexts |
| `vote` | Agree on a decision | Weighted majority voting |
| `best` | Select highest-quality result | Score each result, pick best |

**Example: Parallel Code Review**

```typescript
const reviewConfig: ParallelExecutionConfig = {
  agents: [
    { agent: "reviewer", mode: "bugs", weight: 1.0 },
    { agent: "reviewer", mode: "security", weight: 1.5 },  // Security issues weighted higher
    { agent: "reviewer", mode: "style", weight: 0.5 },
    { agent: "reviewer", mode: "performance", weight: 0.8 },
  ],
  strategy: "all",
  timeout: 30000,
  consolidation: "merge",
};

const consolidatedReview = await executeParallel(reviewConfig);
// Returns merged list of all findings, deduplicated, sorted by severity
```

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

### 12.1 Model Flexibility (Heterogeneous Models)

Following Magentic-One's approach, Sharkbait supports **different models for different agents**:

> "Magentic-One is model-agnostic, allowing the integration of heterogeneous models... For the Orchestrator, we recommend a strong reasoning model."
> — Microsoft Research

```typescript
interface ModelConfig {
  orchestrator: ModelSpec;   // Strong reasoning (GPT-4o, Claude Opus)
  primaryAgents: ModelSpec;  // Balanced (GPT-4o, Claude Sonnet)
  parallelModes: ModelSpec;  // Cost-efficient for parallel runs (GPT-4-turbo, Claude Haiku)
}

interface ModelSpec {
  provider: "azure" | "openai" | "anthropic";
  model: string;
  deployment?: string;       // Azure-specific
  maxTokens: number;
  temperature: number;
}

// Default model assignments
const defaultModels: ModelConfig = {
  orchestrator: {
    provider: "azure",
    model: "gpt-codex-5.2",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    maxTokens: 16000,
    temperature: 0.3,        // Lower for consistent routing
  },
  primaryAgents: {
    provider: "azure",
    model: "gpt-codex-5.2",
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    maxTokens: 16000,
    temperature: 0.7,        // Higher for creative coding
  },
  parallelModes: {
    provider: "azure",
    model: "gpt-4-turbo",    // Cheaper for parallel review modes
    deployment: process.env.AZURE_OPENAI_PARALLEL_DEPLOYMENT,
    maxTokens: 8000,
    temperature: 0.5,
  },
};
```

**Model Selection by Task:**

| Task Type | Recommended Model | Reasoning |
|-----------|------------------|-----------|
| Orchestration & routing | Strong reasoning (GPT-4o, o1) | Needs reliable decision-making |
| Complex coding | Full-capability (Codex 5.2) | Needs deep context understanding |
| Code review (parallel) | Efficient (GPT-4-turbo) | Cost-effective for 3-4 parallel runs |
| Simple edits | Fast (Haiku-level) | Speed over depth |
| Security analysis | Strong reasoning | Critical findings need accuracy |

**Configuration File:**

```json
// .sharkbait.json
{
  "models": {
    "orchestrator": {
      "provider": "azure",
      "deployment": "gpt-codex-5.2"
    },
    "primaryAgents": {
      "provider": "azure", 
      "deployment": "gpt-codex-5.2"
    },
    "parallelModes": {
      "provider": "azure",
      "deployment": "gpt-4-turbo"
    }
  }
}
```

### 12.2 Agent File Format

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
model: inherit                      # inherit | orchestrator | primary | parallel | <specific-model>
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
