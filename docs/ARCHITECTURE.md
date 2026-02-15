# Sharkbait - Architecture Documentation

**Version:** 1.0  
**Date:** February 15, 2026  
**Status:** Current

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Components](#high-level-components)
3. [Data Flow Architecture](#data-flow-architecture)
4. [Design Patterns](#design-patterns)
5. [Security Model](#security-model)
6. [Error Handling](#error-handling)
7. [Extension Points](#extension-points)

---

## System Overview

Sharkbait is a Bun-based TypeScript CLI tool that provides an AI-powered coding assistant using Azure OpenAI's Responses API. It features a multi-agent architecture with an Ink-based terminal UI and comprehensive tool system.

### Core Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Runtime** | Bun 1.3+ | Fast startup, native TypeScript support, single binary compilation |
| **Language** | TypeScript 5.0+ | Type safety, IDE support, maintainability |
| **LLM Integration** | Azure OpenAI Responses API (GPT Codex 5.2) | Enterprise-grade AI with tool calling capabilities |
| **Terminal UI** | Ink 4.4 | React-like components for rich CLI interfaces |
| **CLI Framework** | Commander 12.1 | Command parsing and routing |
| **Memory System** | Beads (bd CLI) | Git-backed persistent memory for AI agents |
| **Version Control** | git + gh CLI | Full GitHub integration with single authentication |

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Sharkbait CLI Application                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                  Terminal Interface Layer                    │       │
│  │  - Ink-based React components                                │       │
│  │  - Message rendering, spinners, progress indicators          │       │
│  │  - User input handling                                       │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                              ↕                                          │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              Command Processing Layer                        │       │
│  │  - Commander-based CLI routing                               │       │
│  │  - Slash command system (/help, /context, etc.)             │       │
│  │  - Configuration management                                  │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                              ↕                                          │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    Agent System                              │       │
│  │  - Orchestrator: Routes and coordinates                     │       │
│  │  - Coder: Code generation and editing                       │       │
│  │  - Reviewer: Code review and quality checks                 │       │
│  │  - Explorer: Codebase analysis and navigation               │       │
│  │  - Planner: Task decomposition and planning                 │       │
│  │  - Debugger: Error diagnosis and fixing                     │       │
│  │  - Parallel Executor: Fan-out/fan-in coordination           │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                              ↕                                          │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                   Tool System (36 Tools)                     │       │
│  │  - File Operations: read, write, edit, search               │       │
│  │  - Shell: Command execution with safety checks              │       │
│  │  - Git: Status, diff, commit, branch operations             │       │
│  │  - GitHub: Issues, PRs, reviews via gh CLI                  │       │
│  │  - Beads: Memory persistence and task tracking              │       │
│  │  - Web: Fetch and search capabilities                       │       │
│  │  - Codebase: Analysis, dependencies, architecture mapping   │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                              ↕                                          │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │                    LLM Integration                           │       │
│  │  - Azure OpenAI client with streaming                       │       │
│  │  - Retry logic with exponential backoff                     │       │
│  │  - Tool call handling                                        │       │
│  │  - Context window management                                 │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                              ↕
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
  File System           Git/GitHub            Beads Memory
  - Read/Write          - Version Control     - Task Tracking
  - Directory Tree      - PR Management       - Git-backed State
```

---

## High-Level Components

### 1. Terminal Interface Layer (`src/ui/`)

**Purpose:** Provides rich, interactive terminal UI using React-style components.

**Key Files:**
- `app.tsx` - Main Ink application component
- `message.tsx` - Message rendering with syntax highlighting
- `spinner.tsx` - Loading states and progress indicators
- `demo.tsx` - Demo mode for showcasing features

**Features:**
- Real-time streaming text rendering
- Syntax highlighted code blocks
- Interactive prompts and confirmations
- Progress spinners and status indicators
- Logo and branding components

### 2. Command Processing (`src/commands/`)

**Purpose:** CLI command routing and slash command handling.

**Key Commands:**
- `chat` - Interactive chat session with the AI
- `ask <question>` - One-off question mode
- `run <task>` - Autonomous task execution
- `setup` - Configuration wizard
- `init` - Project initialization

**Slash Commands:**
- `/help` - Show available commands
- `/context <files...>` - Add files to context
- `/clear` - Clear conversation history
- `/exit` - End session

### 3. Agent System (`src/agent/`, `src/agents/`)

**Purpose:** Multi-agent architecture for intelligent task handling.

#### Orchestrator Agent
- **Role:** Routes requests, tracks progress, detects stalls
- **Features:**
  - Dual-ledger progress tracking (Task + Progress ledgers)
  - Stall detection with automatic recovery
  - Agent handoff coordination
  - Context management and compaction

#### Primary Agents
1. **Coder Agent** - Code generation, editing, refactoring
2. **Reviewer Agent** - Code review, quality checks, suggestions
3. **Explorer Agent** - Codebase navigation and analysis
4. **Planner Agent** - Task decomposition and planning
5. **Debugger Agent** - Error diagnosis and fixing

#### Workflow Features
- **Iterative Refinement:** Reviewer ↔ Coder loops
- **Parallel Execution:** Fan-out/fan-in for independent tasks
- **Model Flexibility:** Different models for different agent roles
- **Action Reversibility:** Classification before execution

### 4. Tool System (`src/tools/`)

**Purpose:** 36+ tools for file operations, shell commands, git, GitHub, and more.

#### Tool Categories

**File Operations** (`file-ops.ts`)
- `read_file` - Read file contents with line range support
- `write_file` - Write content to file (creates directories)
- `edit_file` - In-place file editing
- `search_files` - Search for patterns across files
- `list_directory` - Directory listing with filtering

**Shell Operations** (`shell.ts`)
- `execute_command` - Execute shell commands with safety checks
- `list_processes` - Show running processes
- `kill_process` - Terminate processes

**Git Operations** (`git.ts`)
- `git_status` - Repository status
- `git_diff` - View changes
- `git_commit` - Commit changes
- `git_branch` - Branch management
- `git_log` - Commit history

**GitHub Operations** (`github.ts`)
- `github_list_issues` - List repository issues
- `github_create_issue` - Create new issue
- `github_list_prs` - List pull requests
- `github_review_pr` - Submit PR review

**Beads Memory** (`beads.ts`)
- `beads_store` - Store memory
- `beads_recall` - Retrieve memory
- `beads_list` - List all memories
- `beads_clear` - Clear memory

**Web Operations** (`fetch.ts`)
- `fetch_url` - Fetch web content
- `search_web` - Web search capabilities

**Codebase Analysis** (`codebase.ts`) - *New*
- `analyze_codebase` - Project structure overview
- `find_dependencies` - Dependency analysis
- `map_architecture` - Architectural file mapping

#### Tool Registry
- Centralized registration and execution
- Type-safe parameter validation
- Error handling and logging
- Optional tool categories (e.g., beads can be disabled)

### 5. LLM Integration (`src/llm/`)

**Purpose:** Azure OpenAI integration with streaming and retry logic.

#### Components

**Azure OpenAI Client** (`azure-openai.ts`)
- Responses API integration (not Chat Completions)
- Streaming text and tool call handling
- Message conversion for multi-turn conversations
- Error wrapping and status code extraction

**Retry Logic** (`retry.ts`) - *New*
- Exponential backoff with jitter
- Configurable retry options
- Transient error detection (429, 500-504, network)
- Non-retryable error handling (401, 403, 400-499)
- Max delay capping (default 30s)

**Stream Handler** (`streaming.ts`)
- Manages async generator streams
- Accumulates streamed content
- Handles tool calls
- Finish reason detection

**Types** (`types.ts`)
- `Message` - Chat message format
- `ToolCall` - Tool invocation format
- `ChatChunk` - Streaming chunk format
- `ToolDefinition` - Tool schema format

### 6. Beads Memory System

**Purpose:** Git-backed persistent memory for AI agents.

**Integration:**
- Task tracking across sessions
- Context persistence
- Decision history
- Project state management

**Storage:**
- Uses `bd` CLI for memory operations
- Backed by git for version control
- Structured storage for different memory types

---

## Data Flow Architecture

### 1. Interactive Chat Flow

```
User Input (Terminal)
       ↓
Commander CLI Parser
       ↓
Chat Command Handler
       ↓
Orchestrator Agent
       ↓ (analyzes intent)
Agent Selection (Coder/Reviewer/Explorer/etc.)
       ↓
Context Gathering
  - File reading
  - Git status
  - Beads memory
       ↓
LLM Request (Azure OpenAI Responses API)
  - System instructions
  - User messages
  - Tool definitions
       ↓
Streaming Response Handler
  - Text chunks → Terminal UI
  - Tool calls → Tool Executor
       ↓
Tool Execution
  - Parameter validation
  - Safety checks
  - Execution
  - Result capture
       ↓
Tool Results → LLM (next turn)
       ↓
Final Response → Terminal UI
       ↓
Session State Update
  - Conversation history
  - Beads memory
  - Progress tracking
```

### 2. Autonomous Task Execution Flow

```
User: "run <task>"
       ↓
Planner Agent
  - Breaks task into subtasks
  - Identifies dependencies
  - Creates execution plan
       ↓
Parallel Executor
  - Fan-out to independent subtasks
  - Spawn agent instances
  - Track progress
       ↓
Individual Agent Execution
  - Coder: Implements changes
  - Reviewer: Checks quality
  - Debugger: Fixes errors
       ↓
Stall Detection System
  - Monitor Task Ledger
  - Monitor Progress Ledger
  - Detect lack of progress
  - Trigger recovery
       ↓
Iterative Refinement Loop
  - Reviewer ↔ Coder
  - Run tests
  - Fix failures
  - Repeat until success
       ↓
Fan-in Results
  - Aggregate outputs
  - Resolve conflicts
  - Generate summary
       ↓
Final Report → User
```

### 3. Tool Call Flow

```
LLM generates tool_call
       ↓
Stream Handler extracts tool call
  - id: unique identifier
  - name: tool name
  - arguments: JSON string
       ↓
Tool Registry lookup
       ↓
Parameter validation
  - JSON schema validation
  - Type checking
       ↓
Safety checks
  - Reversibility classification
  - Blocked command detection
  - Confirmation prompts (if needed)
       ↓
Tool execution
  - Spawn subprocess (for shell/git)
  - File system operations
  - API calls (GitHub, web)
       ↓
Result capture
  - stdout/stderr
  - exit codes
  - Structured data
       ↓
Format as tool message
  - role: "tool"
  - tool_call_id: matches original id
  - content: result string/JSON
       ↓
Add to conversation history
       ↓
Send to LLM for next turn
```

---

## Design Patterns

### 1. Dual-Ledger Progress Tracking (Magentic-One Inspired)

**Problem:** Agents can get stuck in loops without making progress.

**Solution:** Maintain two separate ledgers:

```typescript
// Task Ledger: What needs to be done
taskLedger = [
  { id: "t1", description: "Implement feature X", status: "in_progress" },
  { id: "t2", description: "Write tests", status: "pending" }
];

// Progress Ledger: What has actually been accomplished
progressLedger = [
  { timestamp: "2026-02-15T10:00:00Z", action: "Created file feature.ts" },
  { timestamp: "2026-02-15T10:05:00Z", action: "Implemented function X" }
];
```

**Stall Detection:**
- If no new progress entries for N turns, trigger recovery
- Recovery: Prompt agent to try different approach or ask for help

### 2. Intelligent Context Compaction

**Problem:** Context window limits require removing information.

**Solution:** Preserve critical context while removing redundant information:

**What to Keep:**
- Current task description
- Recent progress (last 5 entries)
- Active file contents
- Error messages
- User preferences

**What to Compress:**
- Old conversation turns → Summary
- Repeated information → Single reference
- Successful tool outputs → "Success" marker

**What to Remove:**
- Very old conversation history
- Redundant file reads
- Debug logging

### 3. Action Reversibility Classification

**Problem:** Some actions are irreversible and require extra caution.

**Solution:** Classify all tool operations by reversibility:

```typescript
enum Reversibility {
  EASY = "easy",        // git revert, undo file edit
  EFFORT = "effort",    // requires manual work to undo
  IRREVERSIBLE = "irreversible"  // cannot be undone
}

// Examples:
// EASY: git commit (can revert), file edit (can restore)
// EFFORT: npm publish (need version bump), PR merge (need revert PR)
// IRREVERSIBLE: rm -rf, git push --force, production deployment
```

**Action Levels:**
- **EASY:** Execute immediately
- **EFFORT:** Warn user, allow proceed
- **IRREVERSIBLE:** Require explicit confirmation

### 4. Retry Logic with Exponential Backoff

**Problem:** Transient API failures should be automatically retried.

**Solution:** Retry with exponential backoff and jitter:

```typescript
// Retry configuration
{
  maxRetries: 3,
  baseDelay: 1000ms,
  maxDelay: 30000ms,
  
  // Delay calculation
  delay = min(baseDelay * 2^attempt + jitter, maxDelay)
  
  // Example delays:
  // Attempt 1: 1000ms + jitter
  // Attempt 2: 2000ms + jitter
  // Attempt 3: 4000ms + jitter
}
```

**Retryable Errors:**
- HTTP 429 (Rate Limit)
- HTTP 500-504 (Server Errors)
- Network timeouts and connection errors

**Non-Retryable Errors:**
- HTTP 401/403 (Authentication)
- HTTP 400-499 (Client Errors)

### 5. Multi-Agent Coordination

**Pattern:** Orchestrator-Workers with message passing

```typescript
// Orchestrator decides which agent to use
function selectAgent(userIntent: string): Agent {
  if (userIntent.includes("write code")) return coderAgent;
  if (userIntent.includes("review")) return reviewerAgent;
  if (userIntent.includes("find")) return explorerAgent;
  // ... etc
}

// Agents communicate via structured messages
interface AgentMessage {
  from: AgentId;
  to: AgentId;
  type: "handoff" | "question" | "result";
  payload: unknown;
}
```

---

## Security Model

### 1. Command Execution Safety

**Blocked Commands:**
- `rm -rf` without safeguards
- `sudo` operations
- `curl | bash` piped execution
- Format commands (`mkfs`, etc.)
- Firewall modifications

**Safe Execution:**
- Argument arrays instead of shell strings (prevents injection)
- Working directory isolation
- Environment variable sanitization
- Timeout enforcement

### 2. Secret Redaction

**Sensitive Patterns:**
- API keys
- Tokens
- Passwords
- Private keys
- Environment variables with `SECRET`, `TOKEN`, `PASSWORD`, `KEY`

**Redaction Strategy:**
- Scan output before logging
- Replace with `[REDACTED]`
- Never include in LLM context

### 3. File System Restrictions

**Allowed Operations:**
- Read/write within project directory
- Create subdirectories
- Safe file deletion (with confirmation)

**Blocked Operations:**
- Access to system directories (`/etc`, `/usr`, `/sys`)
- Access to home directory secrets (`~/.ssh`, `~/.aws`)
- Modification of system configurations

### 4. GitHub Operation Safety

**Safe Operations:**
- Read repository data
- Create issues/PRs
- Add comments
- Request changes

**Requires Confirmation:**
- Merge PRs
- Close issues
- Force push
- Delete branches

---

## Error Handling

### 1. Structured Logging

**Log Levels:**
- `DEBUG` - Detailed execution traces
- `INFO` - Normal operations
- `WARN` - Non-fatal issues
- `ERROR` - Operation failures
- `FATAL` - System-level failures

**Log Format:**
```typescript
{
  timestamp: "2026-02-15T10:00:00.000Z",
  level: "ERROR",
  message: "Tool execution failed",
  context: {
    tool: "execute_command",
    args: { command: "npm test" },
    error: "Exit code 1"
  }
}
```

### 2. Error Classification

**Categories:**
- `ToolError` - Tool execution failures
- `LLMError` - Azure OpenAI API errors
- `ConfigError` - Configuration issues
- `ValidationError` - Input validation failures
- `NetworkError` - Connection problems

**Handling Strategy:**
- Tool errors → Inform LLM, suggest fixes
- LLM errors → Retry with backoff
- Config errors → Prompt user for setup
- Validation errors → Explain requirements
- Network errors → Retry or fail gracefully

### 3. Retry Mechanisms

**Automatic Retry:**
- LLM API calls (3 retries)
- Network operations (2 retries)
- File system operations (1 retry)

**Manual Retry:**
- Tool execution failures (agent decides)
- Validation failures (user fixes input)

### 4. Graceful Degradation

**When Features Fail:**
- Beads unavailable → Continue without memory
- GitHub CLI missing → Fallback to git only
- Syntax highlighting fails → Plain text output
- Streaming errors → Fallback to blocking calls

---

## Extension Points

### 1. Custom Tools

**Adding New Tools:**

```typescript
// Define tool
export const myTool: Tool = {
  name: "my_tool",
  description: "Does something useful",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "Input parameter" }
    },
    required: ["input"]
  },
  async execute({ input }) {
    // Implementation
    return { result: "success" };
  }
};

// Register tool
import { myTool } from "./my-tool";
this.registerAll([myTool]);
```

### 2. Custom Agents

**Creating New Agents:**

```typescript
export class MyAgent extends BaseAgent {
  name = "my_agent";
  description = "Specialized agent for X";
  model = "gpt-4"; // Can use different model
  
  async execute(task: Task): Promise<Result> {
    // Agent logic
    const plan = await this.createPlan(task);
    const result = await this.executeP(plan);
    return result;
  }
}
```

### 3. Custom Skills

**Adding Domain Knowledge:**

```typescript
// src/skills/my-domain.md
# My Domain Skill

## Expert Knowledge
- Pattern A should use approach X
- Pattern B requires library Y

## Code Patterns
\`\`\`typescript
// Example implementation
\`\`\`

## References
- [Documentation](https://example.com)
```

### 4. Custom Hooks

**Lifecycle Hooks:**

```typescript
export const myHook: Hook = {
  name: "pre_tool_use",
  async execute(context: HookContext) {
    // Run before tool execution
    console.log(`About to use tool: ${context.toolName}`);
    
    // Can modify context
    context.args.modified = true;
    
    // Can block execution
    if (context.toolName === "dangerous_tool") {
      throw new Error("Tool not allowed");
    }
  }
};
```

---

## Conclusion

Sharkbait's architecture emphasizes:

1. **Modularity** - Clear separation of concerns across layers
2. **Extensibility** - Easy to add new tools, agents, and capabilities
3. **Reliability** - Retry logic, error handling, stall detection
4. **Safety** - Command blocking, reversibility classification, confirmations
5. **Performance** - Streaming responses, parallel execution, context management

The system is designed to be both powerful for autonomous operations and safe for enterprise use, with comprehensive logging, error handling, and security controls throughout.
