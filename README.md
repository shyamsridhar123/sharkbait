# Sharkbait 🦈

**AI coding assistant for the command line**

Sharkbait is a powerful CLI-based AI coding assistant built with Bun and TypeScript. It leverages Azure OpenAI to help you write, edit, and understand code directly from your terminal.

## Features

- 🚀 **Fast**: Built on Bun for instant startup and native TypeScript support
- 🔧 **Tool-equipped**: File operations, shell commands, Git, GitHub integration
- 🧠 **Smart context**: Intelligent context management with token optimization
- 📋 **Task tracking**: Beads integration for persistent memory across sessions
- 🎨 **Beautiful UI**: Ink-based terminal interface with colors and spinners
- 🔒 **Safe**: Command reversibility classification and dangerous command blocking

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
- **bd** (Beads) >= 0.49 (optional, for task tracking)
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
| `SHARKBAIT_MAX_CONTEXT_TOKENS` | Max context window tokens | `100000` |
| `SHARKBAIT_CONFIRM_DESTRUCTIVE` | Require confirmation for destructive commands | `true` |

## Security

Sharkbait includes multiple layers of security:

1. **Blocked commands**: Dangerous patterns like `rm -rf /` are blocked
2. **Reversibility classification**: Commands are classified by how easy they are to undo
3. **Confirmation prompts**: Destructive operations require confirmation
4. **Secret redaction**: API keys and passwords are not logged

## License

MIT

## Contributing

Contributions welcome! Please see the backlog in `backlog/tasks/` for open items.
