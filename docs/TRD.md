# Sharkbait - Technical Requirements Document (TRD)

**Version:** 1.0  
**Date:** January 28, 2026  
**Author:** Shyam Sridhar  
**Status:** Draft

---

## 1. System Overview

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              SHARKBAIT                                  │
│                         CLI Coding Agent                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐         │
│  │    CLI Layer    │  │   Agent Core    │  │   Tool System   │         │
│  │   (commander)   │──│  (Agent Loop)   │──│   (Executors)   │         │
│  └─────────────────┘  └────────┬────────┘  └────────┬────────┘         │
│                                │                    │                   │
│  ┌─────────────────┐  ┌────────┴────────┐  ┌────────┴────────┐         │
│  │   Terminal UI   │  │   LLM Client    │  │  Tool Registry  │         │
│  │     (ink)       │  │ (Azure OpenAI)  │  │                 │         │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘         │
│                                                                         │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  File System  │          │   Git / gh    │          │    Beads      │
│               │          │               │          │   (bd CLI)    │
└───────────────┘          └───────────────┘          └───────────────┘
```

### 1.2 Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Runtime** | Bun | Fast startup, native TypeScript, single binary compile |
| **Language** | TypeScript | Type safety, excellent LLM SDK support |
| **LLM** | Azure OpenAI (GPT Codex 5.2) | Enterprise compliance, tool calling |
| **Memory** | Beads (bd CLI) | Purpose-built for AI agents, git-backed |
| **GitHub** | git + gh CLI | Full GitHub features, single auth |
| **Terminal UI** | ink | React-like components for CLI |
| **CLI Framework** | commander | Mature, well-documented |

---

## 2. Component Specifications

### 2.1 Project Structure

```
sharkbait/
├── src/
│   ├── cli.ts                    # Entry point, argument parsing
│   ├── agent/
│   │   ├── index.ts              # Agent class
│   │   ├── loop.ts               # Agentic loop implementation
│   │   └── context.ts            # Context management
│   ├── llm/
│   │   ├── azure-openai.ts       # Azure OpenAI client
│   │   ├── streaming.ts          # Stream handling
│   │   └── types.ts              # Message types
│   ├── tools/
│   │   ├── index.ts              # Tool registry
│   │   ├── definitions.ts        # Tool JSON schemas
│   │   ├── file-ops.ts           # read, write, edit, search
│   │   ├── shell.ts              # Command execution
│   │   ├── beads.ts              # Beads integration
│   │   └── github.ts             # Git + gh CLI wrapper
│   ├── ui/
│   │   ├── app.tsx               # Main ink app
│   │   ├── message.tsx           # Message rendering
│   │   └── spinner.tsx           # Loading states
│   └── utils/
│       ├── config.ts             # Configuration loading
│       ├── platform.ts           # Cross-platform helpers
│       └── logger.ts             # Logging
├── tests/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
├── bunfig.toml
├── .env.example
└── README.md
```

### 2.2 Entry Point (cli.ts)

```typescript
#!/usr/bin/env bun

import { Command } from "commander";
import { version } from "../package.json";
import { startChat } from "./agent";
import { initProject } from "./commands/init";

const program = new Command();

program
  .name("sharkbait")
  .description("AI coding assistant for the command line")
  .version(version);

program
  .command("chat")
  .description("Start interactive chat session")
  .option("-c, --context <files...>", "Include specific files in context")
  .option("--no-beads", "Disable Beads task tracking")
  .action(startChat);

program
  .command("init")
  .description("Initialize Sharkbait in current project")
  .action(initProject);

program
  .command("ask <question>")
  .description("Ask a one-off question")
  .action(askQuestion);

program
  .command("run <task>")
  .description("Execute a task autonomously")
  .option("--dry-run", "Show what would be done without doing it")
  .action(runTask);

program.parse();
```

---

## 3. Core Components

### 3.1 LLM Client (Azure OpenAI)

```typescript
// src/llm/azure-openai.ts

import { AzureOpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export class AzureOpenAIClient {
  private client: AzureOpenAI;
  private deployment: string;

  constructor(config: LLMConfig) {
    this.client = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
    });
    this.deployment = config.deployment;
  }

  async *chat(
    messages: ChatCompletionMessageParam[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<ChatChunk> {
    const stream = await this.client.chat.completions.create({
      model: this.deployment,
      messages,
      tools: tools?.map(t => ({
        type: "function" as const,
        function: t,
      })),
      stream: true,
    });

    for await (const chunk of stream) {
      yield {
        content: chunk.choices[0]?.delta?.content ?? "",
        toolCalls: chunk.choices[0]?.delta?.tool_calls,
        finishReason: chunk.choices[0]?.finish_reason,
      };
    }
  }
}

interface ChatChunk {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: string | null;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: object;
}
```

### 3.2 Agent Loop

```typescript
// src/agent/loop.ts

import { AzureOpenAIClient } from "../llm/azure-openai";
import { ToolRegistry } from "../tools";
import type { Message } from "../llm/types";

export class AgentLoop {
  private llm: AzureOpenAIClient;
  private tools: ToolRegistry;
  private messages: Message[] = [];
  private systemPrompt: string;

  constructor(llm: AzureOpenAIClient, tools: ToolRegistry) {
    this.llm = llm;
    this.tools = tools;
    this.systemPrompt = this.buildSystemPrompt();
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.messages.push({ role: "user", content: userMessage });

    while (true) {
      // Stream LLM response
      let fullContent = "";
      let toolCalls: ToolCall[] = [];

      for await (const chunk of this.llm.chat(
        [{ role: "system", content: this.systemPrompt }, ...this.messages],
        this.tools.getDefinitions()
      )) {
        if (chunk.content) {
          fullContent += chunk.content;
          yield { type: "text", content: chunk.content };
        }
        if (chunk.toolCalls) {
          toolCalls = this.accumulateToolCalls(toolCalls, chunk.toolCalls);
        }
      }

      // No tool calls = done
      if (toolCalls.length === 0) {
        this.messages.push({ role: "assistant", content: fullContent });
        yield { type: "done" };
        return;
      }

      // Execute tool calls
      this.messages.push({
        role: "assistant",
        content: fullContent,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        yield { type: "tool_start", name: call.function.name };
        
        const result = await this.tools.execute(
          call.function.name,
          JSON.parse(call.function.arguments)
        );
        
        yield { type: "tool_result", name: call.function.name, result };
        
        this.messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
      
      // Loop continues - LLM will process tool results
    }
  }

  private buildSystemPrompt(): string {
    return `You are Sharkbait, an expert AI coding assistant.

You have access to tools for:
- Reading, writing, and editing files
- Running shell commands
- Managing tasks with Beads (bd)
- Interacting with GitHub (gh)

Guidelines:
1. Always read files before editing to understand context
2. Make precise, minimal edits
3. Create Beads tasks for multi-step work
4. Ask for confirmation before destructive operations
5. Explain your reasoning

Current working directory: ${process.cwd()}
Platform: ${process.platform}
`;
  }
}

type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "done" };
```

### 3.3 Tool Registry

```typescript
// src/tools/index.ts

import { fileTools } from "./file-ops";
import { shellTools } from "./shell";
import { beadsTools } from "./beads";
import { githubTools } from "./github";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerAll(fileTools);
    this.registerAll(shellTools);
    this.registerAll(beadsTools);
    this.registerAll(githubTools);
  }

  private registerAll(tools: Tool[]) {
    for (const tool of tools) {
      this.tools.set(tool.name, tool);
    }
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return tool.execute(args);
  }
}

export interface Tool {
  name: string;
  description: string;
  parameters: object;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}
```

---

## 4. Tool Implementations

### 4.1 File Operations

```typescript
// src/tools/file-ops.ts

import { readdir, stat } from "fs/promises";
import { join, relative } from "path";
import type { Tool } from "./index";

export const fileTools: Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        startLine: { type: "number", description: "Start line (1-indexed)" },
        endLine: { type: "number", description: "End line (1-indexed)" },
      },
      required: ["path"],
    },
    async execute({ path, startLine, endLine }) {
      const content = await Bun.file(path as string).text();
      if (startLine && endLine) {
        const lines = content.split("\n");
        return lines.slice((startLine as number) - 1, endLine as number).join("\n");
      }
      return content;
    },
  },

  {
    name: "write_file",
    description: "Write content to a file (creates directories if needed)",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
    async execute({ path, content }) {
      await Bun.write(path as string, content as string);
      return { success: true, path };
    },
  },

  {
    name: "edit_file",
    description: "Replace a specific string in a file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to edit" },
        oldString: { type: "string", description: "Exact text to replace" },
        newString: { type: "string", description: "Replacement text" },
      },
      required: ["path", "oldString", "newString"],
    },
    async execute({ path, oldString, newString }) {
      const content = await Bun.file(path as string).text();
      if (!content.includes(oldString as string)) {
        throw new Error(`String not found in file: ${oldString}`);
      }
      const newContent = content.replace(oldString as string, newString as string);
      await Bun.write(path as string, newContent);
      return { success: true, path };
    },
  },

  {
    name: "list_directory",
    description: "List contents of a directory",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path" },
        recursive: { type: "boolean", description: "List recursively" },
      },
      required: ["path"],
    },
    async execute({ path, recursive }) {
      const entries: string[] = [];
      
      async function walk(dir: string) {
        const items = await readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = join(dir, item.name);
          const relativePath = relative(process.cwd(), fullPath);
          entries.push(item.isDirectory() ? `${relativePath}/` : relativePath);
          if (recursive && item.isDirectory()) {
            await walk(fullPath);
          }
        }
      }
      
      await walk(path as string);
      return entries;
    },
  },

  {
    name: "search_files",
    description: "Search for text in files using grep-like pattern matching",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern (regex supported)" },
        path: { type: "string", description: "Directory to search" },
        filePattern: { type: "string", description: "File glob pattern (e.g., *.ts)" },
      },
      required: ["pattern"],
    },
    async execute({ pattern, path, filePattern }) {
      const { $ } = await import("bun");
      const dir = (path as string) || ".";
      const glob = (filePattern as string) || "*";
      
      try {
        // Use ripgrep if available, otherwise fallback to grep
        const result = await $`rg ${pattern} ${dir} -g ${glob} --json`.text();
        return result;
      } catch {
        const result = await $`grep -r ${pattern} ${dir} --include=${glob}`.text();
        return result;
      }
    },
  },

  {
    name: "grep_search",
    description: "Fast text search with regex support (uses ripgrep)",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search pattern (regex supported)" },
        path: { type: "string", description: "Directory or file to search" },
        caseSensitive: { type: "boolean", description: "Case sensitive search" },
        maxResults: { type: "number", description: "Maximum results to return" },
      },
      required: ["query"],
    },
    async execute({ query, path, caseSensitive, maxResults }) {
      const { $ } = await import("bun");
      const searchPath = (path as string) || ".";
      const args = ["rg", query as string, searchPath, "--json"];
      if (!caseSensitive) args.push("-i");
      if (maxResults) args.push("-m", String(maxResults));
      
      const result = await $`${args}`.text();
      return result;
    },
  },

  {
    name: "create_directory",
    description: "Create a directory (with parents if needed)",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to create" },
      },
      required: ["path"],
    },
    async execute({ path }) {
      const { mkdir } = await import("fs/promises");
      await mkdir(path as string, { recursive: true });
      return { success: true, path };
    },
  },
];
```

### 4.2 Shell Execution

```typescript
// src/tools/shell.ts

import type { Tool } from "./index";

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/,
  />\s*\/dev\/sd/,
  /mkfs/,
  /dd\s+if=/,
  /:(){ :|:& };:/,  // Fork bomb
  /git\s+push\s+.*--force/,
];

export const shellTools: Tool[] = [
  {
    name: "run_command",
    description: "Execute a shell command",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute" },
        cwd: { type: "string", description: "Working directory" },
        background: { type: "boolean", description: "Run in background" },
      },
      required: ["command"],
    },
    async execute({ command, cwd, background }) {
      const cmd = command as string;
      
      // Check for dangerous commands
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(cmd)) {
          throw new Error(`Potentially dangerous command blocked: ${cmd}`);
        }
      }

      const { $ } = await import("bun");
      const workingDir = (cwd as string) || process.cwd();

      if (background) {
        // Start background process
        const proc = Bun.spawn(["sh", "-c", cmd], {
          cwd: workingDir,
          stdout: "pipe",
          stderr: "pipe",
        });
        return { pid: proc.pid, message: "Started in background" };
      }

      try {
        const result = await $`${{ raw: cmd }}`.cwd(workingDir).text();
        return { stdout: result, exitCode: 0 };
      } catch (error: any) {
        return { 
          stdout: error.stdout?.toString() || "",
          stderr: error.stderr?.toString() || "",
          exitCode: error.exitCode || 1,
        };
      }
    },
  },
];
```

### 4.3 Beads Integration

```typescript
// src/tools/beads.ts

import type { Tool } from "./index";

export const beadsTools: Tool[] = [
  {
    name: "beads_ready",
    description: "Get tasks ready to work on (no blockers)",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      const { $ } = await import("bun");
      return await $`bd ready --json`.json();
    },
  },

  {
    name: "beads_create",
    description: "Create a new task",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        priority: { type: "number", description: "Priority (0=highest)" },
        parent: { type: "string", description: "Parent task ID for subtasks" },
      },
      required: ["title"],
    },
    async execute({ title, priority, parent }) {
      const { $ } = await import("bun");
      const args = ["bd", "create", title as string];
      if (priority !== undefined) args.push("-p", String(priority));
      if (parent) args.push("--parent", parent as string);
      args.push("--json");
      
      return await $`${args}`.json();
    },
  },

  {
    name: "beads_show",
    description: "Get details of a specific task",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID (e.g., bd-a1b2)" },
      },
      required: ["id"],
    },
    async execute({ id }) {
      const { $ } = await import("bun");
      return await $`bd show ${id} --json`.json();
    },
  },

  {
    name: "beads_done",
    description: "Mark a task as complete",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" },
        message: { type: "string", description: "Completion message" },
      },
      required: ["id"],
    },
    async execute({ id, message }) {
      const { $ } = await import("bun");
      const msg = (message as string) || "Completed";
      await $`bd done ${id} ${msg}`;
      return { success: true, id };
    },
  },

  {
    name: "beads_add_dependency",
    description: "Add a dependency between tasks",
    parameters: {
      type: "object",
      properties: {
        childId: { type: "string", description: "Blocked task ID" },
        parentId: { type: "string", description: "Blocking task ID" },
      },
      required: ["childId", "parentId"],
    },
    async execute({ childId, parentId }) {
      const { $ } = await import("bun");
      await $`bd dep add ${childId} ${parentId}`;
      return { success: true };
    },
  },

  {
    name: "beads_list",
    description: "List all tasks",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "closed", "all"] },
      },
      required: [],
    },
    async execute({ status }) {
      const { $ } = await import("bun");
      const args = ["bd", "list", "--json"];
      if (status && status !== "all") args.push(`--${status}`);
      return await $`${args}`.json();
    },
  },
];
```

### 4.4 GitHub Integration

```typescript
// src/tools/github.ts

import type { Tool } from "./index";

export const githubTools: Tool[] = [
  {
    name: "git_status",
    description: "Get git status of the repository",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      const { $ } = await import("bun");
      return await $`git status --porcelain`.text();
    },
  },

  {
    name: "git_diff",
    description: "Get diff of changes",
    parameters: {
      type: "object",
      properties: {
        staged: { type: "boolean", description: "Show staged changes only" },
        file: { type: "string", description: "Specific file to diff" },
      },
      required: [],
    },
    async execute({ staged, file }) {
      const { $ } = await import("bun");
      const args = ["git", "diff"];
      if (staged) args.push("--staged");
      if (file) args.push(file as string);
      return await $`${args}`.text();
    },
  },

  {
    name: "git_commit",
    description: "Commit staged changes",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message" },
        all: { type: "boolean", description: "Stage all changes before commit" },
      },
      required: ["message"],
    },
    async execute({ message, all }) {
      const { $ } = await import("bun");
      if (all) {
        await $`git add -A`;
      }
      await $`git commit -m ${message}`;
      return { success: true, message };
    },
  },

  {
    name: "git_push",
    description: "Push commits to remote",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Branch to push" },
        setUpstream: { type: "boolean", description: "Set upstream for new branch" },
      },
      required: [],
    },
    async execute({ branch, setUpstream }) {
      const { $ } = await import("bun");
      const args = ["git", "push"];
      if (setUpstream) args.push("-u", "origin", (branch as string) || "HEAD");
      else if (branch) args.push("origin", branch as string);
      await $`${args}`;
      return { success: true };
    },
  },

  {
    name: "git_branch",
    description: "Create, list, or switch branches",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Branch name" },
        action: { type: "string", enum: ["create", "list", "switch", "delete"], description: "Action to perform" },
      },
      required: ["action"],
    },
    async execute({ name, action }) {
      const { $ } = await import("bun");
      switch (action) {
        case "create":
          await $`git checkout -b ${name}`;
          return { success: true, branch: name, action: "created" };
        case "list":
          return await $`git branch -a`.text();
        case "switch":
          await $`git checkout ${name}`;
          return { success: true, branch: name, action: "switched" };
        case "delete":
          await $`git branch -d ${name}`;
          return { success: true, branch: name, action: "deleted" };
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  },

  {
    name: "github_create_pr",
    description: "Create a GitHub pull request",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "PR title" },
        body: { type: "string", description: "PR description" },
        base: { type: "string", description: "Base branch (default: main)" },
        draft: { type: "boolean", description: "Create as draft PR" },
      },
      required: ["title"],
    },
    async execute({ title, body, base, draft }) {
      const { $ } = await import("bun");
      const args = ["gh", "pr", "create", "--title", title as string];
      if (body) args.push("--body", body as string);
      if (base) args.push("--base", base as string);
      if (draft) args.push("--draft");
      args.push("--json", "number,url");
      
      return await $`${args}`.json();
    },
  },

  {
    name: "github_list_prs",
    description: "List open pull requests",
    parameters: {
      type: "object",
      properties: {
        state: { type: "string", enum: ["open", "closed", "merged", "all"] },
        limit: { type: "number", description: "Max results" },
      },
      required: [],
    },
    async execute({ state, limit }) {
      const { $ } = await import("bun");
      const args = ["gh", "pr", "list"];
      if (state) args.push("--state", state as string);
      if (limit) args.push("--limit", String(limit));
      args.push("--json", "number,title,author,url,state");
      
      return await $`${args}`.json();
    },
  },

  {
    name: "github_merge_pr",
    description: "Merge a pull request",
    parameters: {
      type: "object",
      properties: {
        number: { type: "number", description: "PR number" },
        method: { type: "string", enum: ["merge", "squash", "rebase"] },
        deleteRemoteBranch: { type: "boolean", description: "Delete branch after merge" },
      },
      required: ["number"],
    },
    async execute({ number, method, deleteRemoteBranch }) {
      const { $ } = await import("bun");
      const args = ["gh", "pr", "merge", String(number)];
      args.push(`--${(method as string) || "squash"}`);
      if (deleteRemoteBranch) args.push("--delete-branch");
      
      await $`${args}`;
      return { success: true, number };
    },
  },

  {
    name: "github_create_issue",
    description: "Create a GitHub issue",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue description" },
        labels: { type: "array", items: { type: "string" }, description: "Labels" },
      },
      required: ["title"],
    },
    async execute({ title, body, labels }) {
      const { $ } = await import("bun");
      const args = ["gh", "issue", "create", "--title", title as string];
      if (body) args.push("--body", body as string);
      if (labels && (labels as string[]).length > 0) {
        args.push("--label", (labels as string[]).join(","));
      }
      args.push("--json", "number,url");
      
      return await $`${args}`.json();
    },
  },

  {
    name: "github_workflow_status",
    description: "Get status of GitHub Actions workflows",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results" },
      },
      required: [],
    },
    async execute({ limit }) {
      const { $ } = await import("bun");
      const args = ["gh", "run", "list"];
      if (limit) args.push("--limit", String(limit));
      args.push("--json", "status,conclusion,name,createdAt,url");
      
      return await $`${args}`.json();
    },
  },
];
```

---

## 5. Configuration

### 5.1 Environment Variables

```bash
# .env.example

# Azure OpenAI (required)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-codex-5.2
AZURE_OPENAI_API_VERSION=2024-10-21

# Optional
SHARKBAIT_LOG_LEVEL=info
SHARKBAIT_MAX_CONTEXT_TOKENS=100000
SHARKBAIT_CONFIRM_DESTRUCTIVE=true
```

### 5.2 Configuration File

```typescript
// src/utils/config.ts

import { join } from "path";
import { homedir } from "os";

interface Config {
  azure: {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
  };
  features: {
    beads: boolean;
    confirmDestructive: boolean;
  };
  ui: {
    theme: "dark" | "light";
    showSpinner: boolean;
  };
}

export async function loadConfig(): Promise<Config> {
  // 1. Load from ~/.sharkbait/config.json if exists
  const globalConfigPath = join(homedir(), ".sharkbait", "config.json");
  let globalConfig = {};
  try {
    globalConfig = await Bun.file(globalConfigPath).json();
  } catch {}

  // 2. Load from .sharkbait.json in project if exists
  let projectConfig = {};
  try {
    projectConfig = await Bun.file(".sharkbait.json").json();
  } catch {}

  // 3. Override with environment variables
  return {
    azure: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || "",
      apiKey: process.env.AZURE_OPENAI_API_KEY || "",
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-codex-5.2",
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || "2024-10-21",
    },
    features: {
      beads: true,
      confirmDestructive: process.env.SHARKBAIT_CONFIRM_DESTRUCTIVE !== "false",
    },
    ui: {
      theme: "dark",
      showSpinner: true,
    },
    ...globalConfig,
    ...projectConfig,
  };
}
```

---

## 6. Build & Distribution

### 6.1 Package Configuration

```json
// package.json
{
  "name": "sharkbait",
  "version": "1.0.0",
  "description": "AI coding assistant for the command line",
  "type": "module",
  "bin": {
    "sharkbait": "./dist/cli.js"
  },
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --outdir dist --target bun",
    "build:binary": "bun build src/cli.ts --compile --outfile sharkbait",
    "build:all": "bun run scripts/build-all.ts",
    "test": "bun test",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "openai": "^4.77.0",
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "chalk": "^5.3.0",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

### 6.2 Cross-Platform Build Script

```typescript
// scripts/build-all.ts

import { $ } from "bun";
import { mkdir } from "fs/promises";

const targets = [
  { os: "windows", arch: "x64", ext: ".exe" },
  { os: "darwin", arch: "x64", ext: "" },
  { os: "darwin", arch: "arm64", ext: "" },
  { os: "linux", arch: "x64", ext: "" },
  { os: "linux", arch: "arm64", ext: "" },
];

await mkdir("dist/binaries", { recursive: true });

for (const { os, arch, ext } of targets) {
  const output = `dist/binaries/sharkbait-${os}-${arch}${ext}`;
  console.log(`Building ${output}...`);
  
  await $`bun build src/cli.ts --compile --target=bun-${os}-${arch} --outfile ${output}`;
}

console.log("All binaries built!");
```

### 6.3 TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// tests/unit/tools/file-ops.test.ts

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { fileTools } from "../../../src/tools/file-ops";

describe("file-ops", () => {
  const testDir = "./test-fixtures";
  
  beforeEach(async () => {
    await Bun.write(`${testDir}/test.txt`, "line1\nline2\nline3\n");
  });

  afterEach(async () => {
    await Bun.$`rm -rf ${testDir}`;
  });

  test("read_file reads entire file", async () => {
    const tool = fileTools.find(t => t.name === "read_file")!;
    const result = await tool.execute({ path: `${testDir}/test.txt` });
    expect(result).toBe("line1\nline2\nline3\n");
  });

  test("read_file reads line range", async () => {
    const tool = fileTools.find(t => t.name === "read_file")!;
    const result = await tool.execute({ 
      path: `${testDir}/test.txt`,
      startLine: 2,
      endLine: 2 
    });
    expect(result).toBe("line2");
  });

  test("edit_file replaces string", async () => {
    const tool = fileTools.find(t => t.name === "edit_file")!;
    await tool.execute({
      path: `${testDir}/test.txt`,
      oldString: "line2",
      newString: "modified",
    });
    const content = await Bun.file(`${testDir}/test.txt`).text();
    expect(content).toContain("modified");
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/agent-loop.test.ts

import { describe, test, expect } from "bun:test";
import { AgentLoop } from "../../src/agent/loop";
import { MockLLM } from "../mocks/llm";
import { ToolRegistry } from "../../src/tools";

describe("AgentLoop", () => {
  test("executes tool calls and continues", async () => {
    const mockLlm = new MockLLM([
      // First response: call read_file
      { toolCalls: [{ name: "read_file", arguments: { path: "test.txt" } }] },
      // Second response: final answer
      { content: "The file contains test data." },
    ]);
    
    const agent = new AgentLoop(mockLlm, new ToolRegistry());
    const events = [];
    
    for await (const event of agent.run("What's in test.txt?")) {
      events.push(event);
    }
    
    expect(events).toContainEqual({ type: "tool_start", name: "read_file" });
    expect(events).toContainEqual({ type: "done" });
  });
});
```

---

## 8. Error Handling

### 8.1 Error Types

```typescript
// src/utils/errors.ts

export class SharkbaitError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SharkbaitError";
  }
}

export class LLMError extends SharkbaitError {
  constructor(message: string, public statusCode?: number) {
    super(message, "LLM_ERROR");
  }
}

export class ToolError extends SharkbaitError {
  constructor(message: string, public toolName: string) {
    super(message, "TOOL_ERROR");
  }
}

export class ConfigError extends SharkbaitError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
  }
}
```

### 8.2 Error Recovery

```typescript
// src/agent/loop.ts (error handling section)

async *run(userMessage: string): AsyncGenerator<AgentEvent> {
  try {
    // ... main loop
  } catch (error) {
    if (error instanceof LLMError) {
      if (error.statusCode === 429) {
        yield { type: "error", message: "Rate limited. Waiting 60s..." };
        await Bun.sleep(60000);
        // Retry...
      }
    }
    
    if (error instanceof ToolError) {
      // Tool failed - tell the LLM and let it recover
      this.messages.push({
        role: "tool",
        tool_call_id: currentCallId,
        content: JSON.stringify({ error: error.message }),
      });
      // Continue loop - LLM will handle the error
    }
    
    throw error;
  }
}
```

---

## 9. Security Considerations

### 9.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| API key exposure | Store in env vars, never log |
| Malicious file access | Restrict to project directory |
| Command injection | Validate/sanitize command inputs |
| LLM jailbreak | System prompt hardening |
| Sensitive data in context | Respect .gitignore, redact secrets |

### 9.2 Command Blocklist

```typescript
// src/utils/security.ts

export const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+[\/~]/,           // Recursive delete root/home
  /:\(\)\s*\{\s*:\|\:&\s*\}\s*;/, // Fork bomb
  /dd\s+if=.*of=\/dev/,          // Disk overwrite
  /mkfs/,                         // Format filesystem
  /chmod\s+777\s+\//,            // Dangerous permissions
  /curl.*\|\s*sh/,               // Pipe to shell
  /wget.*\|\s*sh/,
];

export function isCommandSafe(command: string): boolean {
  return !BLOCKED_COMMANDS.some(pattern => pattern.test(command));
}
```

---

## 10. Prerequisites & Dependencies

### 10.1 Required External Tools

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| git | >= 2.30 | Version control | System package manager |
| gh | >= 2.40 | GitHub CLI | `brew install gh` / `winget install gh` |
| bd | >= 0.49 | Beads task tracking | `npm install -g @beads/bd` |

### 10.2 Runtime Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Windows 10, macOS 12, Ubuntu 20.04 | Latest |
| RAM | 512 MB | 2 GB |
| Disk | 100 MB | 500 MB |
| Network | Required for LLM API | Stable connection |

---

## 11. Monitoring & Observability

### 11.1 Logging

```typescript
// src/utils/logger.ts

import chalk from "chalk";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL = (process.env.SHARKBAIT_LOG_LEVEL || "info") as LogLevel;
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export const log = {
  debug: (msg: string) => emit("debug", msg),
  info: (msg: string) => emit("info", msg),
  warn: (msg: string) => emit("warn", msg),
  error: (msg: string) => emit("error", msg),
};

function emit(level: LogLevel, message: string) {
  if (LEVELS[level] < LEVELS[LOG_LEVEL]) return;
  
  const prefix = {
    debug: chalk.gray("[DEBUG]"),
    info: chalk.blue("[INFO]"),
    warn: chalk.yellow("[WARN]"),
    error: chalk.red("[ERROR]"),
  }[level];
  
  console.error(`${prefix} ${message}`);
}
```

### 11.2 Telemetry (Opt-in)

```typescript
// src/utils/telemetry.ts

interface TelemetryEvent {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

// Only if user opts in
const TELEMETRY_ENABLED = process.env.SHARKBAIT_TELEMETRY === "true";

export function track(event: string, properties?: Record<string, unknown>) {
  if (!TELEMETRY_ENABLED) return;
  
  // Send to analytics endpoint (anonymized)
  // No PII, no file contents, no commands
}
```

---

## 12. Future Considerations

### 12.1 v2.0 Features

| Feature | Description | Complexity |
|---------|-------------|------------|
| Plugin system | User-defined tools in JS/TS | High |
| Multi-repo | Work across multiple repositories | Medium |
| Custom LLM providers | Support Anthropic, local models | Medium |
| Voice interface | Speak commands | Medium |
| Web UI | Browser-based interface | High |

### 12.2 Performance Optimizations

| Optimization | Benefit | When to Implement |
|--------------|---------|-------------------|
| Go file search helper | 10x faster on large repos | >50K files |
| Context caching | Reduce API calls | After v1 launch |
| Incremental parsing | Faster file watching | After v1 launch |
| Embedding-based search | Semantic code search | v2.0 |

---

## 13. Appendix

### A. Full Tool Schema (OpenAI Format)

```typescript
export const TOOL_DEFINITIONS = [
  // File Operations (7 tools)
  { type: "function", function: { name: "read_file", /* ... */ } },
  { type: "function", function: { name: "write_file", /* ... */ } },
  { type: "function", function: { name: "edit_file", /* ... */ } },
  { type: "function", function: { name: "list_directory", /* ... */ } },
  { type: "function", function: { name: "search_files", /* ... */ } },
  { type: "function", function: { name: "grep_search", /* ... */ } },
  { type: "function", function: { name: "create_directory", /* ... */ } },
  
  // Shell (1 tool)
  { type: "function", function: { name: "run_command", /* ... */ } },
  
  // Beads (6 tools)
  { type: "function", function: { name: "beads_ready", /* ... */ } },
  { type: "function", function: { name: "beads_create", /* ... */ } },
  { type: "function", function: { name: "beads_show", /* ... */ } },
  { type: "function", function: { name: "beads_done", /* ... */ } },
  { type: "function", function: { name: "beads_add_dependency", /* ... */ } },
  { type: "function", function: { name: "beads_list", /* ... */ } },
  
  // Git (5 tools)
  { type: "function", function: { name: "git_status", /* ... */ } },
  { type: "function", function: { name: "git_diff", /* ... */ } },
  { type: "function", function: { name: "git_commit", /* ... */ } },
  { type: "function", function: { name: "git_push", /* ... */ } },
  { type: "function", function: { name: "git_branch", /* ... */ } },
  
  // GitHub (5 tools)
  { type: "function", function: { name: "github_create_pr", /* ... */ } },
  { type: "function", function: { name: "github_list_prs", /* ... */ } },
  { type: "function", function: { name: "github_merge_pr", /* ... */ } },
  { type: "function", function: { name: "github_create_issue", /* ... */ } },
  { type: "function", function: { name: "github_workflow_status", /* ... */ } },
];

// Total: 24 tools
```

### B. System Prompt Template

```markdown
You are Sharkbait, an expert AI coding assistant running in the terminal.

## Capabilities
You can read, write, and edit files in the user's project.
You can run shell commands to build, test, and run code.
You can manage tasks using Beads (bd command) for persistent memory.
You can interact with GitHub using the gh CLI.

## Guidelines
1. **Understand first**: Always read relevant files before making changes.
2. **Minimal edits**: Make the smallest change that solves the problem.
3. **Track work**: Create Beads tasks for multi-step work.
4. **Be safe**: Ask before destructive operations (delete, force push).
5. **Explain**: Always explain what you're doing and why.

## Context
- Working directory: {{cwd}}
- Platform: {{platform}}
- Current branch: {{gitBranch}}
- Open tasks: {{beadsTasks}}

## Response Format
- Use markdown for formatting
- Show code in fenced blocks with language
- Be concise but complete
```

### C. Example Conversation Flow

```
User: Add input validation to the login endpoint

Agent: [Thinking] I'll need to:
1. Find the login endpoint
2. Understand current validation
3. Add missing validation
4. Test the changes

Let me search for the login endpoint...
[Tool: search_files { pattern: "login", path: "src" }]

Found src/routes/auth.ts. Reading...
[Tool: read_file { path: "src/routes/auth.ts" }]

I see the login endpoint at line 42. It currently has no input validation.
I'll add validation for email format and password requirements.

Creating a task to track this work...
[Tool: beads_create { title: "Add login validation", priority: 1 }]

Created task bd-x7j2. Now applying the fix...
[Tool: edit_file { path: "src/routes/auth.ts", oldString: "...", newString: "..." }]

✓ Added email and password validation to login endpoint.

Should I run the tests to verify? [y/n]
```
