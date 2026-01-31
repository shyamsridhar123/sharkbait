# Sharkbait SDK - High-Level Design Document

**Version:** 1.0  
**Date:** January 30, 2026  
**Author:** Sharkbait Team  
**Status:** Draft  
**Reference:** [GitHub Copilot SDK](https://github.com/github/copilot-sdk)

---

## 1. Executive Summary

The Sharkbait SDK provides a programmatic interface for developers to integrate Sharkbait's AI coding agent capabilities into their own applications, IDE extensions, CI/CD pipelines, and automation workflows.

### Key Design Decisions (Validated Against Copilot SDK)

| Decision | Copilot SDK Pattern | Sharkbait Implementation |
|----------|---------------------|--------------------------|
| **Communication** | JSON-RPC over stdio/TCP | JSON-RPC over stdio/TCP |
| **Multi-language** | TypeScript, Python, Go, .NET | TypeScript (primary), Python (secondary) |
| **Runtime** | CLI in server mode | Sharkbait CLI in server mode |
| **Session Model** | Stateful sessions with persistence | Stateful sessions + Beads memory |
| **Tool System** | Built-in + Custom tools | Built-in + Custom + MCP tools |
| **Streaming** | Server-Sent Events (SSE) | SSE via session events |

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER APPLICATION                                 │
│              (IDE Extension, CI/CD, Web App, Automation)                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        │     SDK CLIENT        │
                        │  (TypeScript/Python)  │
                        └───────────┬───────────┘
                                    │ JSON-RPC (stdio or TCP)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SHARKBAIT CLI (Server Mode)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Session   │  │    Tool     │  │    Event    │  │   Model     │        │
│  │   Manager   │  │   Registry  │  │  Dispatcher │  │   Router    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         └─────────────────┼────────────────┼────────────────┘               │
│                           │                │                                │
│  ┌────────────────────────┴────────────────┴────────────────────────────┐  │
│  │                         AGENT CORE                                    │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │  │ Orchestrator│  │  Primary    │  │  Workflow   │  │  Progress   │  │  │
│  │  │   Agent     │  │  Agents     │  │  Agents     │  │  Tracker    │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                          INTEGRATIONS                                 │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │  │
│  │  │ Azure   │  │  Beads  │  │  Git +  │  │  File   │  │   MCP   │    │  │
│  │  │ OpenAI  │  │ Memory  │  │ GitHub  │  │  System │  │ Servers │    │  │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Communication Protocol

Following Copilot SDK patterns, the SDK communicates via **JSON-RPC 2.0**:

```
┌──────────────┐                    ┌─────────────────────┐
│  SDK Client  │ ───── stdio ────── │ Sharkbait CLI       │
│              │     or TCP         │ (Server Mode)       │
└──────────────┘                    └─────────────────────┘
       │                                    │
       │  Request: session.create           │
       │ ─────────────────────────────────> │
       │                                    │
       │  Response: {sessionId: "..."}      │
       │ <───────────────────────────────── │
       │                                    │
       │  Notification: session.event       │
       │ <───────────────────────────────── │
       │                                    │
```

---

## 3. SDK Components

### 3.1 Client Architecture

```
sdk/
├── typescript/                    # Primary SDK
│   ├── src/
│   │   ├── index.ts              # Public exports
│   │   ├── client.ts             # SharkbaitClient class
│   │   ├── session.ts            # SharkbaitSession class
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── tools.ts              # Tool definitions & helpers
│   │   ├── events.ts             # Event types
│   │   ├── jsonrpc/              # JSON-RPC client
│   │   │   ├── connection.ts     # Connection management
│   │   │   ├── protocol.ts       # RPC protocol
│   │   │   └── transport.ts      # stdio/TCP transport
│   │   └── utils/
│   │       ├── retry.ts          # Retry logic
│   │       └── errors.ts         # Custom exceptions
│   ├── package.json
│   └── tsconfig.json
│
└── python/                        # Secondary SDK
    ├── src/
    │   └── sharkbait/
    │       ├── __init__.py
    │       ├── client.py
    │       ├── session.py
    │       ├── types.py
    │       └── jsonrpc/
    ├── pyproject.toml
    └── README.md
```

### 3.2 Core Classes

#### SharkbaitClient

The main entry point for SDK users:

```typescript
// TypeScript SDK
export interface SharkbaitClientOptions {
  // Connection options
  cliPath?: string;                    // Path to sharkbait CLI
  autoStart?: boolean;                 // Auto-start CLI server (default: true)
  connectionMode?: 'stdio' | 'tcp';    // Connection mode
  tcpPort?: number;                    // TCP port (for tcp mode)
  
  // Azure OpenAI configuration (BYOK)
  provider?: ProviderConfig;
  
  // Timeouts
  timeout?: number;                    // Request timeout (ms)
  connectTimeout?: number;             // Connection timeout (ms)
}

export class SharkbaitClient {
  state: ConnectionState;
  
  // Lifecycle
  async start(): Promise<void>;
  async stop(): Promise<void>;
  
  // Sessions
  async createSession(config?: SessionConfig): Promise<SharkbaitSession>;
  async resumeSession(sessionId: string, config?: ResumeSessionConfig): Promise<SharkbaitSession>;
  async listSessions(): Promise<SessionMetadata[]>;
  async deleteSession(sessionId: string): Promise<void>;
  async getLastSessionId(): Promise<string | undefined>;
  
  // Utilities
  async ping(): Promise<PingResponse>;
  async listModels(): Promise<ModelInfo[]>;
  async getStatus(): Promise<GetStatusResponse>;
}
```

#### SharkbaitSession

Represents a single conversation session:

```typescript
export class SharkbaitSession {
  readonly sessionId: string;
  readonly workspacePath?: string;
  
  // Messaging
  async send(options: MessageOptions): Promise<void>;
  async sendAndWait(options: MessageOptions): Promise<AssistantMessageEvent | null>;
  
  // Event handling
  on(handler: SessionEventHandler): () => void;
  on<K extends SessionEventType>(eventType: K, handler: TypedEventHandler<K>): () => void;
  
  // History
  async getMessages(): Promise<SessionEvent[]>;
  
  // Lifecycle
  async destroy(): Promise<void>;
}
```

### 3.3 Session Configuration

```typescript
export interface SessionConfig {
  // Model selection
  model?: string;                      // e.g., "gpt-codex-5.2", "claude-sonnet"
  reasoningEffort?: ReasoningEffort;   // "low" | "medium" | "high" | "xhigh"
  
  // Custom tools
  tools?: Tool[];
  availableTools?: string[];           // Whitelist built-in tools
  excludedTools?: string[];            // Blacklist built-in tools
  
  // System message customization
  systemMessage?: SystemMessageConfig;
  
  // Agents
  customAgents?: CustomAgentConfig[];
  
  // Skills
  skillDirectories?: string[];
  disabledSkills?: string[];
  
  // Working context
  workingDirectory?: string;
  
  // Streaming
  streaming?: boolean;
  
  // Beads integration (Sharkbait-specific)
  beadsEnabled?: boolean;
  beadsProjectPath?: string;
  
  // MCP servers
  mcpServers?: Record<string, MCPServerConfig>;
  
  // Handlers
  onPermissionRequest?: PermissionHandler;
  onUserInputRequest?: UserInputHandler;
  hooks?: SessionHooks;
  
  // Persistence
  infiniteSessions?: InfiniteSessionConfig;
}
```

---

## 4. Tool System

### 4.1 Built-in Tools (Sharkbait Core)

| Tool | Description | Category |
|------|-------------|----------|
| `view` | Read file contents | File Ops |
| `edit` | Edit existing files | File Ops |
| `create` | Create new files | File Ops |
| `glob` | Search files by pattern | File Ops |
| `grep` | Search text in files | File Ops |
| `shell` | Execute shell commands | Shell |
| `git_status` | Get git status | Git |
| `git_diff` | Get git diff | Git |
| `git_commit` | Create commits | Git |
| `gh_pr_create` | Create GitHub PRs | GitHub |
| `gh_issue_create` | Create GitHub issues | GitHub |
| `beads_task_create` | Create Beads tasks | Memory |
| `beads_task_list` | List Beads tasks | Memory |
| `beads_task_complete` | Complete Beads tasks | Memory |

### 4.2 Custom Tool Definition

```typescript
// Define custom tools with Zod schema validation
import { defineTool } from '@sharkbait/sdk';
import { z } from 'zod';

const weatherTool = defineTool('get_weather', {
  description: 'Get current weather for a location',
  parameters: z.object({
    location: z.string().describe('City name'),
    units: z.enum(['celsius', 'fahrenheit']).optional()
  }),
  handler: async ({ location, units }, invocation) => {
    const weather = await fetchWeather(location, units);
    return {
      textResultForLlm: `Weather in ${location}: ${weather.temp}°`,
      resultType: 'success'
    };
  }
});

const session = await client.createSession({
  tools: [weatherTool]
});
```

### 4.3 Tool Result Types

```typescript
export type ToolResultType = 'success' | 'failure' | 'rejected' | 'denied';

export interface ToolResultObject {
  textResultForLlm: string;            // Text result for LLM context
  binaryResultsForLlm?: ToolBinaryResult[];  // Binary attachments
  resultType: ToolResultType;
  error?: string;                      // Error message (for failures)
  sessionLog?: string;                 // Log output for session
  toolTelemetry?: Record<string, unknown>;
}

export type ToolResult = string | ToolResultObject;
```

---

## 5. Event System

### 5.1 Session Event Types

Following Copilot SDK's event model:

```typescript
export type SessionEventType =
  // Session lifecycle
  | 'session.start'
  | 'session.idle'
  | 'session.resume'
  | 'session.error'
  
  // Messages
  | 'user.message'
  | 'assistant.message'
  | 'assistant.message_delta'      // Streaming chunks
  | 'assistant.reasoning'
  | 'assistant.reasoning_delta'    // Streaming reasoning
  
  // Tools
  | 'tool.call'
  | 'tool.execution_progress'
  | 'tool.execution_complete'
  
  // Agents
  | 'subagent.started'
  | 'subagent.selected'
  | 'subagent.completed'
  | 'subagent.failed'
  
  // Hooks
  | 'hook.start'
  | 'hook.end'
  
  // Beads (Sharkbait-specific)
  | 'beads.task_created'
  | 'beads.task_updated'
  | 'beads.task_completed';
```

### 5.2 Event Handling

```typescript
// Generic handler
session.on((event) => {
  console.log(`Event: ${event.type}`);
});

// Typed handler
session.on('assistant.message_delta', (event) => {
  process.stdout.write(event.data.deltaContent);
});

session.on('tool.call', (event) => {
  console.log(`Tool called: ${event.data.toolName}`);
});

session.on('session.idle', () => {
  console.log('Session complete');
});
```

---

## 6. Streaming Support

### 6.1 Streaming Configuration

```typescript
const session = await client.createSession({
  model: 'gpt-codex-5.2',
  streaming: true
});

// Streaming usage
session.on('assistant.message_delta', (event) => {
  // Incremental message chunks
  process.stdout.write(event.data.deltaContent);
});

session.on('assistant.reasoning_delta', (event) => {
  // Incremental reasoning (if model supports)
  console.log(`[Thinking] ${event.data.deltaContent}`);
});

session.on('assistant.message', (event) => {
  // Final complete message
  console.log('\n--- Complete ---');
  console.log(event.data.content);
});

await session.send({ prompt: 'Explain quantum computing' });
```

### 6.2 Non-Streaming Usage

```typescript
const session = await client.createSession({
  streaming: false  // Default
});

// Simple request-response
const response = await session.sendAndWait({
  prompt: 'What is 2+2?'
});

console.log(response?.data.content);  // "4"
```

---

## 7. BYOK (Bring Your Own Key)

### 7.1 Provider Configuration

```typescript
export interface ProviderConfig {
  type: 'azure' | 'openai' | 'anthropic';
  
  // Azure OpenAI
  azureEndpoint?: string;
  azureDeployment?: string;
  azureApiVersion?: string;
  
  // OpenAI
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  
  // Anthropic
  anthropicApiKey?: string;
}

// Usage
const client = new SharkbaitClient({
  provider: {
    type: 'azure',
    azureEndpoint: 'https://my-resource.openai.azure.com',
    azureDeployment: 'gpt-codex-5.2',
    azureApiVersion: '2024-06-01'
  }
});
```

---

## 8. Session Hooks

### 8.1 Hook Types

```typescript
export interface SessionHooks {
  // Before tool execution
  onPreToolUse?: (context: PreToolUseContext) => Promise<PreToolUseResult>;
  
  // After tool execution  
  onPostToolUse?: (context: PostToolUseContext) => Promise<PostToolUseResult>;
  
  // When user submits prompt
  onUserPromptSubmitted?: (context: PromptContext) => Promise<PromptResult>;
  
  // Session lifecycle
  onSessionStart?: (context: SessionStartContext) => Promise<void>;
  onStop?: (context: StopContext) => Promise<StopResult>;
}
```

### 8.2 Hook Example

```typescript
const session = await client.createSession({
  hooks: {
    onPreToolUse: async (context) => {
      // Audit tool calls
      console.log(`Tool: ${context.toolName}, Args: ${JSON.stringify(context.arguments)}`);
      
      // Optionally block or modify
      if (context.toolName === 'shell' && context.arguments.command.includes('rm -rf')) {
        return { action: 'deny', reason: 'Destructive command blocked' };
      }
      
      return { action: 'allow' };
    },
    
    onPostToolUse: async (context) => {
      // Log tool results
      console.log(`Tool ${context.toolName} completed: ${context.resultType}`);
      return {};
    }
  }
});
```

---

## 9. Beads Integration (Sharkbait-Specific)

### 9.1 Beads Configuration

```typescript
const session = await client.createSession({
  beadsEnabled: true,
  beadsProjectPath: '/path/to/project'
});

// Listen for Beads events
session.on('beads.task_created', (event) => {
  console.log(`New task: ${event.data.taskId} - ${event.data.title}`);
});

session.on('beads.task_completed', (event) => {
  console.log(`Task completed: ${event.data.taskId}`);
});
```

### 9.2 Beads Tools

```typescript
// Beads-specific tools exposed to the agent
const beadsTools = [
  'beads_task_create',
  'beads_task_list', 
  'beads_task_start',
  'beads_task_complete',
  'beads_task_search',
  'beads_context_get'
];

const session = await client.createSession({
  availableTools: [...defaultTools, ...beadsTools]
});
```

---

## 10. Custom Agents

### 10.1 Agent Configuration

```typescript
export interface CustomAgentConfig {
  name: string;
  displayName: string;
  description: string;
  instructions: string;
  tools?: string[];              // Tool whitelist
  model?: string;                // Model override
}

// Usage
const session = await client.createSession({
  customAgents: [
    {
      name: 'security-reviewer',
      displayName: 'Security Reviewer',
      description: 'Reviews code for security vulnerabilities',
      instructions: `You are a security expert. Focus on:
        - SQL injection
        - XSS vulnerabilities
        - Authentication issues
        - Secrets exposure`,
      tools: ['view', 'grep', 'glob'],
      model: 'gpt-codex-5.2'
    }
  ]
});
```

---

## 11. Error Handling

### 11.1 Exception Hierarchy

```typescript
export class SharkbaitError extends Error {
  code: string;
}

export class ConnectionError extends SharkbaitError {
  // Failed to connect to CLI server
}

export class AuthenticationError extends SharkbaitError {
  // Invalid credentials or provider config
}

export class SessionError extends SharkbaitError {
  sessionId?: string;
}

export class ToolExecutionError extends SharkbaitError {
  toolName: string;
  toolCallId: string;
}

export class TimeoutError extends SharkbaitError {
  // Request timed out
}

export class RateLimitError extends SharkbaitError {
  retryAfter: number;  // Seconds to wait
}
```

### 11.2 Error Handling Example

```typescript
try {
  const session = await client.createSession();
  const response = await session.sendAndWait({ prompt: 'Hello' });
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Failed to connect to Sharkbait CLI');
  } else if (error instanceof AuthenticationError) {
    console.error('Check your API credentials');
  } else if (error instanceof TimeoutError) {
    console.error('Request timed out');
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry after ${error.retryAfter}s`);
  }
}
```

---

## 12. Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-3)

| Task | Description | Priority |
|------|-------------|----------|
| CLI Server Mode | Implement JSON-RPC server in Sharkbait CLI | P0 |
| RPC Protocol | Define request/response/notification types | P0 |
| Session Management | Create/resume/delete sessions | P0 |
| Event System | Session event dispatch and subscription | P0 |

### Phase 2: TypeScript SDK (Weeks 4-6)

| Task | Description | Priority |
|------|-------------|----------|
| Client Class | SharkbaitClient implementation | P0 |
| Session Class | SharkbaitSession implementation | P0 |
| JSON-RPC Client | Connection, transport, protocol | P0 |
| Type Definitions | Complete TypeScript types | P0 |
| Streaming | Delta event handling | P0 |
| Custom Tools | Tool registration API | P1 |
| Tests | Unit + integration tests | P1 |
| Documentation | API docs + examples | P1 |

### Phase 3: Python SDK (Weeks 7-9)

| Task | Description | Priority |
|------|-------------|----------|
| Package Setup | pyproject.toml, structure | P1 |
| Async Client | httpx-based async client | P1 |
| Pydantic Models | Type-safe data models | P1 |
| Streaming | Async generator support | P1 |
| Tests & Docs | Complete coverage | P1 |

### Phase 4: Advanced Features (Weeks 10-12)

| Task | Description | Priority |
|------|-------------|----------|
| Hooks System | Pre/post tool hooks | P1 |
| BYOK Providers | Azure, OpenAI, Anthropic | P1 |
| MCP Integration | MCP server support | P2 |
| Custom Agents | Agent configuration | P2 |
| Infinite Sessions | Context compaction | P2 |

---

## 13. API Comparison with Copilot SDK

| Feature | Copilot SDK | Sharkbait SDK |
|---------|-------------|---------------|
| Client creation | `new CopilotClient()` | `new SharkbaitClient()` |
| Session creation | `client.createSession()` | `client.createSession()` |
| Send message | `session.send()` | `session.send()` |
| Wait for response | `session.sendAndWait()` | `session.sendAndWait()` |
| Event subscription | `session.on()` | `session.on()` |
| Custom tools | `defineTool()` | `defineTool()` |
| Streaming | `streaming: true` | `streaming: true` |
| BYOK | `provider: {...}` | `provider: {...}` |
| Session hooks | `hooks: {...}` | `hooks: {...}` |
| **Beads memory** | ❌ | ✅ `beadsEnabled: true` |
| **Progress tracking** | ❌ | ✅ Dual-ledger system |

---

## 14. Usage Examples

### 14.1 Basic Usage

```typescript
import { SharkbaitClient } from '@sharkbait/sdk';

async function main() {
  const client = new SharkbaitClient();
  
  const session = await client.createSession({
    model: 'gpt-codex-5.2'
  });
  
  const response = await session.sendAndWait({
    prompt: 'Create a TypeScript function to validate email addresses'
  });
  
  console.log(response?.data.content);
  
  await session.destroy();
  await client.stop();
}
```

### 14.2 Streaming with Custom Tools

```typescript
import { SharkbaitClient, defineTool } from '@sharkbait/sdk';
import { z } from 'zod';

const dbQueryTool = defineTool('db_query', {
  description: 'Query the application database',
  parameters: z.object({
    table: z.string(),
    filter: z.record(z.string()).optional()
  }),
  handler: async ({ table, filter }) => {
    const results = await database.query(table, filter);
    return JSON.stringify(results);
  }
});

async function main() {
  const client = new SharkbaitClient();
  
  const session = await client.createSession({
    streaming: true,
    tools: [dbQueryTool],
    beadsEnabled: true
  });
  
  session.on('assistant.message_delta', (event) => {
    process.stdout.write(event.data.deltaContent);
  });
  
  session.on('tool.call', (event) => {
    console.log(`\n🔧 Calling: ${event.data.toolName}`);
  });
  
  await session.send({
    prompt: 'Find all users who signed up in the last week'
  });
}
```

### 14.3 CI/CD Integration

```typescript
import { SharkbaitClient } from '@sharkbait/sdk';

async function reviewPullRequest(prNumber: number) {
  const client = new SharkbaitClient({
    provider: {
      type: 'azure',
      azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
      azureDeployment: 'gpt-codex-5.2'
    }
  });
  
  const session = await client.createSession({
    customAgents: [{
      name: 'pr-reviewer',
      displayName: 'PR Reviewer',
      description: 'Reviews pull requests for issues',
      instructions: 'Review code for bugs, security issues, and best practices'
    }]
  });
  
  const review = await session.sendAndWait({
    prompt: `Review PR #${prNumber} and provide feedback`
  });
  
  return review?.data.content;
}
```

---

## 15. Distribution

### 15.1 TypeScript/Node.js

```bash
# NPM
npm install @sharkbait/sdk

# Yarn  
yarn add @sharkbait/sdk

# pnpm
pnpm add @sharkbait/sdk
```

### 15.2 Python

```bash
pip install sharkbait-sdk
```

### 15.3 Package Structure

**NPM Package:**
```json
{
  "name": "@sharkbait/sdk",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**PyPI Package:**
```toml
[project]
name = "sharkbait-sdk"
version = "1.0.0"
requires-python = ">=3.9"
dependencies = [
  "httpx>=0.27.0",
  "pydantic>=2.0.0"
]
```

---

## 16. Success Metrics

| Metric | Target |
|--------|--------|
| Time to first API call | < 5 minutes |
| Streaming latency (first token) | < 100ms |
| TypeScript SDK bundle size | < 500KB |
| Python SDK install size | < 1MB |
| API documentation coverage | 100% |
| Test coverage | > 80% |
| Developer satisfaction | > 4.5/5 |

---

## 17. Open Questions

1. **Protocol versioning**: How to handle SDK/CLI version compatibility?
2. **Authentication**: Should we support GitHub OAuth in addition to API keys?
3. **Telemetry**: What usage data should we collect (opt-in)?
4. **Rate limiting**: How to handle Azure OpenAI rate limits gracefully?
5. **Offline mode**: Should SDK work with local models?

---

## 18. References

- [GitHub Copilot SDK](https://github.com/github/copilot-sdk) - Primary reference implementation
- [Sharkbait TRD](./TRD.md) - Technical requirements
- [Sharkbait PRD](./PRD.md) - Product requirements
- [Agent Architecture](./AGENT_ARCHITECTURE.md) - Agent design patterns
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [vscode-jsonrpc](https://github.com/microsoft/vscode-languageserver-node/tree/main/jsonrpc) - JSON-RPC library

---

## Appendix A: JSON-RPC Methods

### Session Methods

| Method | Request | Response |
|--------|---------|----------|
| `session.create` | `SessionConfig` | `{ sessionId, workspacePath? }` |
| `session.resume` | `{ sessionId, ...config }` | `{ sessionId, workspacePath? }` |
| `session.send` | `{ sessionId, prompt, ... }` | `void` |
| `session.destroy` | `{ sessionId }` | `void` |
| `session.getMessages` | `{ sessionId }` | `SessionEvent[]` |
| `session.list` | `{}` | `SessionMetadata[]` |
| `session.delete` | `{ sessionId }` | `void` |

### Utility Methods

| Method | Request | Response |
|--------|---------|----------|
| `ping` | `{ message? }` | `{ message, timestamp }` |
| `status` | `{}` | `{ version, ready, ... }` |
| `models.list` | `{}` | `ModelInfo[]` |

### Notifications (Server → Client)

| Notification | Payload |
|--------------|---------|
| `session.event` | `SessionEvent` |
| `tool.call` | `{ sessionId, toolCallId, toolName, arguments }` |
| `permission.request` | `{ sessionId, operation, ... }` |

---

*Document generated: January 30, 2026*
