# Sharkbait 🦈

<p align="center">
  <img src="public/images/Nemo-FN.png" alt="Sharkbait Logo" width="300">
</p>

<p align="center">
  <strong>"Sharkbait, ooh ha ha!"</strong><br>
  <em>An AI coding assistant that won't leave you swimming in circles</em>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#features">Features</a> •
  <a href="#usage">Usage</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License">
  <img src="https://img.shields.io/badge/runtime-Bun-orange.svg" alt="Bun">
  <img src="https://img.shields.io/badge/language-TypeScript-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/status-experimental-red.svg" alt="Experimental">
  <img src="https://img.shields.io/badge/fish_are_friends-not_food-brightgreen.svg" alt="Fish are friends">
</p>

---

> ⚠️ **Experimental**: This project is under active development. APIs may change, features may break, and Dory might forget what she was doing. Use at your own risk!

> *"Just keep coding, just keep coding..."* — Dory, probably

Sharkbait is a CLI-based AI coding assistant built with Bun and TypeScript. Like Nemo escaping the dentist's fish tank, it helps you break free from tedious coding tasks.

### 🧠 The Memory Problem

Most AI coding assistants have the memory of... well, Dory. They forget context between sessions, lose track of what you were working on, and make you repeat yourself constantly.

**Sharkbait is different.** Built-in **Beads** provide persistent, git-backed memory that survives across sessions:

- **Task Memory**: Create a bead for a feature, and Sharkbait remembers the context, decisions, and progress — even after you close the terminal
- **Git-Native**: Beads are stored alongside your code in git, so your AI's memory travels with your repo
- **No External Services**: Your context stays local. No cloud sync, no API calls for memory — just git

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/images/terminal-welcome.png">
    <source media="(prefers-color-scheme: light)" srcset="public/images/terminal-welcome.png">
    <img src="public/images/terminal-welcome.png" alt="Sharkbait Terminal" width="700" style="border-radius: 8px;">
  </picture>
</p>

## Features

- 🐠 **Fast** — Built on Bun. Swims through code faster than Marlin crossing the EAC
- 🔧 **Tool-equipped** — File ops, shell commands, Git, GitHub. Everything but the Ring of Fire
- 🧠 **Persistent Memory** — Beads give your AI long-term memory that survives sessions (unlike Dory)
- 📋 **Git-backed Context** — Your AI's memory lives in your repo. Clone it, branch it, merge it
- 🎨 **Beautiful UI** — Ink-based terminal interface. P. Sherman would approve
- 🔒 **Safe** — Confirms dangerous operations before executing. No surprise `rm -rf` moments

## Installation

```bash
# Using npm
npm install -g sharkbait

# Using bun
bun add -g sharkbait

# From source
git clone https://github.com/shyamsridhar123/sharkbait.git
cd sharkbait
bun install
bun run build:binary
```

## Prerequisites

- **Bun** >= 1.0.0
- **Git** >= 2.30
- **gh** (GitHub CLI) >= 2.40 (optional, for GitHub features)
- Azure OpenAI API access

## Configuration

1. Set up your Azure OpenAI credentials:

```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_API_KEY="your-api-key"
export AZURE_OPENAI_DEPLOYMENT="gpt-codex-5.2"
```

2. Or create a `.env` file:

```bash
cp .env.example .env
# Edit .env with your credentials
```

## Usage

### Interactive Chat

```bash
sharkbait chat
```

### One-off Question

```bash
sharkbait ask "How do I refactor this function?"
```

### Autonomous Task Execution

```bash
sharkbait run "Add input validation to the login endpoint"
```

### Initialize in Project

```bash
cd your-project
sharkbait init
```

## Slash Commands

During an interactive chat session, use slash commands for quick actions:

### Navigation
| Command | Description |
|---------|-------------|
| `/cd <path>` | Change working directory (creates if needed) |
| `/pwd` | Show current working directory |

### Session
| Command | Description |
|---------|-------------|
| `/clear` | Clear message history |
| `/exit` | Exit Sharkbait (aliases: `/quit`, `/q`) |

### Configuration
| Command | Description |
|---------|-------------|
| `/beads [on\|off]` | Toggle or check Beads task tracking |
| `/model [name]` | Show or switch the LLM model |
| `/tasks` | Show Beads task status |
| `/context [add\|remove\|list]` | Manage context files |

### Actions
| Command | Description |
|---------|-------------|
| `/setup` | Launch interactive setup wizard |
| `/init` | Initialize Sharkbait in current directory |
| `/ask <question>` | Ask a one-off question |
| `/run <task>` | Execute a task autonomously |
| `/review <file>` | Run parallel code review (bugs, security, style, performance) |

### Information
| Command | Description |
|---------|-------------|
| `/version` | Show Sharkbait version |
| `/help [command]` | Show available commands or help for a specific command |

**Example:** Run a parallel code review:
```
> /review src/auth.ts
🔀 Starting parallel review: bugs, security, style, performance on src/auth.ts
[Progress bars for each reviewer mode]
📋 Parallel Review Complete (12.3s)
```

📖 [Full Slash Commands Reference](docs/COMMANDS.md)

## Available Tools

Sharkbait has access to 24+ tools across different categories:

| Category | Tools |
|----------|-------|
| **File Operations** | `read_file`, `write_file`, `edit_file`, `list_directory`, `search_files`, `grep_search`, `create_directory` |
| **Shell** | `run_command` |
| **Beads** | `beads_ready`, `beads_create`, `beads_show`, `beads_done`, `beads_add_dependency`, `beads_list` |
| **Git** | `git_status`, `git_diff`, `git_commit`, `git_push`, `git_branch`, `git_log` |
| **GitHub** | `github_create_pr`, `github_list_prs`, `github_merge_pr`, `github_create_issue`, `github_workflow_status`, `github_pr_view`, `github_issue_list` |

## Architecture

Sharkbait implements a sophisticated agentic loop with:

- **Dual-ledger progress tracking**: Inspired by Microsoft's Magentic-One research
- **Intelligent context compaction**: Preserves critical context while managing token limits
- **Action reversibility classification**: Classifies commands as easy/effort/irreversible
- **Stall detection & recovery**: Automatic re-planning when stuck

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun test

# Type check
bun run typecheck

# Build for distribution
bun run build:binary

# Build for all platforms
bun run build:all
```

## Configuration Options

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI endpoint URL | (required) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | (required) |
| `AZURE_OPENAI_DEPLOYMENT` | Model deployment name | `gpt-codex-5.2` |
| `AZURE_OPENAI_API_VERSION` | API version | `2024-10-21` |
| `SHARKBAIT_LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |
| `SHARKBAIT_LOG_FILE` | Enable file logging to ~/.sharkbait/logs | `false` |
| `SHARKBAIT_LOG_JSON` | Use JSON format for console output | `false` |
| `SHARKBAIT_LOG_DIR` | Custom log file directory | `~/.sharkbait/logs` |
| `SHARKBAIT_TELEMETRY` | Enable opt-in anonymous telemetry | `false` |
| `SHARKBAIT_MAX_CONTEXT_TOKENS` | Max context window tokens | `100000` |
| `SHARKBAIT_CONFIRM_DESTRUCTIVE` | Require confirmation for destructive commands | `true` |
| `SHARKBAIT_WORKING_DIR` | Default working directory | (current directory) |

## Logging & Monitoring

Sharkbait includes a comprehensive observability stack:

### Structured Logging

```bash
# Enable debug logging
export SHARKBAIT_LOG_LEVEL=debug

# Enable file logging (writes to ~/.sharkbait/logs/sharkbait.log)
export SHARKBAIT_LOG_FILE=true

# Use JSON format for machine-readable logs
export SHARKBAIT_LOG_JSON=true
```

Log output includes timestamps, levels, and contextual information:
```
[18:55:21.545] [INFO ] [coder] Agent started processing
[18:55:21.560] [INFO ] config.load (8ms)
```

### File Logging

When enabled, logs are written as newline-delimited JSON:
```json
{"timestamp":"2026-01-29T18:55:21.545Z","level":"info","message":"Agent started","context":{"agent":"coder","correlationId":"abc123"}}
```

Features:
- Automatic rotation at 10MB (keeps 5 files)
- Structured JSON for easy parsing
- Context propagation (agent, tool, correlationId)

### Performance Monitoring

Built-in metrics track:
- LLM call latencies (avg, p50, p90, p99)
- Tool execution times
- Memory usage
- Token consumption

### Distributed Tracing

Trace agent execution with OpenTelemetry-inspired spans:
```
✓ [agent] coder (1250ms)
  ✓ [llm] gpt-codex-5.2 (800ms)
  ✓ [tool] file_read (45ms)
  ✓ [tool] file_write (120ms)
```

### Telemetry (Opt-in)

Anonymous usage analytics can be enabled to help improve Sharkbait:
```bash
export SHARKBAIT_TELEMETRY=true
```

**What's collected:** Event counts (sessions, tool usage), latency metrics
**What's NOT collected:** File paths, code content, prompts, personal info

### Configuration File

Sharkbait stores configuration in `~/.sharkbait/config.json`. Example:

```json
{
  "azure": {
    "deployment": "gpt-codex-5.2"
  },
  "features": {
    "beads": true,
    "confirmDestructive": true
  },
  "paths": {
    "defaultWorkingDir": "/path/to/your/project"
  }
}
```

## Security

Sharkbait includes multiple layers of security:

1. **Blocked commands**: Dangerous patterns like `rm -rf /` are blocked
2. **Reversibility classification**: Commands are classified by how easy they are to undo
3. **Confirmation prompts**: Destructive operations require confirmation
4. **Secret redaction**: API keys and passwords are not logged

## License

MIT License

Copyright (c) 2026 Shyam Sridhar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Contributing

Contributions welcome! Please see the backlog in `backlog/tasks/` for open items.
