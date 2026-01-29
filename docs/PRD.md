# Sharkbait - Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** January 28, 2026  
**Author:** Shyam Sridhar  
**Status:** Draft

---

## 1. Executive Summary

Sharkbait is a command-line AI coding assistant that helps developers write, edit, debug, and manage code through natural language interaction. It combines the power of Azure OpenAI's GPT Codex 5.2 with persistent task memory (Beads) and GitHub integration to provide a seamless developer experience.

### Vision
> "A CLI coding agent that thinks, remembers, and collaborates — like having a senior developer always available in your terminal."

---

## 2. Problem Statement

### Current Pain Points

| Pain Point | Description |
|------------|-------------|
| **Context Loss** | AI assistants forget context between sessions |
| **Manual Workflow** | Developers manually create PRs, track tasks, manage dependencies |
| **Tool Switching** | Constant context switching between editor, terminal, GitHub, task tracker |
| **Complex Codebases** | Hard to understand and navigate large projects |

### Opportunity
A CLI agent that:
- Maintains persistent memory across sessions
- Automates GitHub workflows (PRs, issues)
- Understands codebase structure
- Executes multi-step tasks autonomously

---

## 3. Target Users

### Primary Persona: Professional Developer
- Works on medium-to-large codebases
- Uses Git/GitHub daily
- Comfortable with CLI tools
- Values automation and efficiency

### Secondary Persona: Open Source Maintainer
- Manages multiple repositories
- Reviews PRs and triages issues
- Needs help with repetitive tasks

---

## 4. Product Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| **Reduce coding time** | 30% faster task completion | P0 |
| **Persistent context** | Zero re-explanation across sessions | P0 |
| **Seamless GitHub integration** | PR creation in <10 seconds | P1 |
| **Cross-platform support** | Works on Windows, macOS, Linux | P1 |
| **Minimal dependencies** | Install in <2 minutes | P2 |

---

## 5. Core Features

### 5.1 Natural Language Coding Assistant

**Description:** Users interact with the agent using natural language to perform coding tasks.

**User Stories:**
- As a developer, I want to ask the agent to "fix the bug in auth.ts" and have it propose a fix
- As a developer, I want to say "add input validation to the API" and have it implement it
- As a developer, I want to ask "explain how the payment module works" and get a clear answer

**Acceptance Criteria:**
- [ ] Agent understands coding requests in plain English
- [ ] Agent reads and understands codebase context
- [ ] Agent proposes changes before applying them
- [ ] Agent streams responses in real-time

---

### 5.2 File Operations

**Description:** Agent can read, write, and edit files in the project.

**Capabilities:**
| Operation | Description |
|-----------|-------------|
| Read file | View contents of any file |
| Write file | Create new files with content |
| Edit file | Make surgical edits to existing files |
| Search files | Find files by name or pattern |
| Grep search | Search for text across codebase |

**Acceptance Criteria:**
- [ ] Agent can read files of any size (with chunking for large files)
- [ ] Agent makes precise edits without corrupting files
- [ ] Agent creates proper directory structure for new files
- [ ] Agent respects .gitignore patterns

---

### 5.3 Shell Command Execution

**Description:** Agent can execute shell commands to build, test, and run code.

**Capabilities:**
- Run build commands (npm, cargo, go build, etc.)
- Execute test suites
- Run linters and formatters
- Start/stop development servers
- Install dependencies

**Acceptance Criteria:**
- [ ] Commands execute in the correct working directory
- [ ] Output is captured and returned to agent
- [ ] Long-running processes supported (background mode)
- [ ] Dangerous commands require confirmation
- [ ] Cross-platform command adaptation (PowerShell on Windows, bash on Unix)

---

### 5.4 Persistent Memory (Beads Integration)

**Description:** Agent maintains task context across sessions using Beads.

**Capabilities:**
| Feature | Description |
|---------|-------------|
| Task creation | Break down requests into trackable tasks |
| Dependencies | Understand and manage task dependencies |
| Ready queue | Know what tasks can be worked on next |
| History | Remember what was done and why |
| Epic hierarchy | Group related tasks together |

**Acceptance Criteria:**
- [ ] Tasks persist after agent exits
- [ ] Agent resumes work from where it left off
- [ ] Dependencies are respected (blocked tasks wait)
- [ ] Completed tasks are marked done with notes
- [ ] Agent can show task status on demand

---

### 5.5 GitHub Integration

**Description:** Agent can interact with GitHub for collaboration features.

**Capabilities:**
| Feature | Description |
|---------|-------------|
| Create PRs | Open pull requests with title, description, labels |
| Merge PRs | Merge with squash/rebase/merge commit |
| Create issues | File issues for bugs or features |
| View PR status | Check CI status, reviews, comments |
| Code search | Search code across GitHub |

**Acceptance Criteria:**
- [ ] PRs created with proper base branch
- [ ] PR descriptions include summary of changes
- [ ] Issues include reproduction steps when applicable
- [ ] Uses existing `gh` auth (no separate login)

---

### 5.6 Interactive Terminal UI

**Description:** Beautiful, responsive terminal interface for the agent.

**Features:**
- Streaming LLM responses (character by character)
- Syntax-highlighted code blocks
- Progress indicators for long operations
- Command history and autocomplete
- Colored status messages

**Acceptance Criteria:**
- [ ] Responses stream in real-time
- [ ] Code is syntax highlighted
- [ ] User can interrupt with Ctrl+C
- [ ] Works in standard terminals (no special requirements)

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target |
|--------|--------|
| Startup time | < 500ms |
| Response latency | Limited by LLM API (typically 500ms-5s) |
| File read/write | < 100ms for files up to 1MB |
| Search | < 1s for repos up to 100K files |

### 6.2 Reliability

- Agent should handle network failures gracefully
- Partial responses should be displayed (don't lose progress)
- File edits should be atomic (no corruption on failure)
- Command failures should be reported clearly

### 6.3 Security

| Concern | Mitigation |
|---------|------------|
| API key exposure | Store in environment variables or secure config |
| Dangerous commands | Require confirmation for rm, git push --force, etc. |
| File access | Restrict to project directory by default |
| Credential handling | Never log or display secrets |

### 6.4 Cross-Platform Support

| Platform | Priority | Status |
|----------|----------|--------|
| Windows (x64) | P0 | Required |
| macOS (Intel) | P0 | Required |
| macOS (Apple Silicon) | P0 | Required |
| Linux (x64) | P0 | Required |
| Linux (ARM64) | P1 | Nice to have |
| Windows (ARM64) | P2 | Future |

---

## 7. User Experience

### 7.1 Installation

```bash
# One-line install (goal)
curl -fsSL https://sharkbait.dev/install.sh | bash

# Or via npm
npm install -g sharkbait

# Or download binary from releases
```

### 7.2 First Run

```bash
$ sharkbait init
🦈 Welcome to Sharkbait!

Setting up your agent...
✓ Azure OpenAI configured (AZURE_OPENAI_ENDPOINT detected)
✓ GitHub CLI authenticated (gh auth status OK)
✓ Beads initialized in .beads/

Ready to assist! Run: sharkbait chat
```

### 7.3 Typical Session

```bash
$ sharkbait chat

🦈 Sharkbait v1.0.0
Type your request or 'help' for commands.

You: Fix the authentication bug where users can't log in

🦈 Let me investigate...
   Reading src/auth/login.ts...
   Reading src/auth/session.ts...

I found the issue. In login.ts:42, the session token is not being 
saved after successful authentication.

Here's my proposed fix:
┌─────────────────────────────────────────┐
│ src/auth/login.ts                       │
├─────────────────────────────────────────┤
│ - const token = await authenticate();  │
│ + const token = await authenticate();  │
│ + await saveSession(token);            │
└─────────────────────────────────────────┘

Apply this change? [y/n] y

✓ Applied fix to src/auth/login.ts
✓ Created task: bd-a1b2 "Fix auth session save"

Shall I create a PR? [y/n] y

✓ Created PR #42: "fix: save session token after auth"
  https://github.com/you/repo/pull/42
```

---

## 8. Out of Scope (v1.0)

| Feature | Reason |
|---------|--------|
| GUI/Desktop app | CLI-first approach |
| Web interface | Not needed for v1 |
| Multi-repo support | Single project focus |
| Custom LLM providers | Azure OpenAI only for v1 |
| Plugin system | Complexity, defer to v2 |
| Collaborative/multi-user | Single developer use case |

---

## 9. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Installation success rate | >95% | Analytics |
| Daily active users (DAU) | N/A (local tool) | Opt-in telemetry |
| Task completion rate | >80% | User surveys |
| NPS | >50 | User surveys |
| GitHub stars | 1000+ in first 6 months | GitHub |

---

## 10. Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1: Core** | 4 weeks | File ops, shell, basic chat loop |
| **Phase 2: Memory** | 2 weeks | Beads integration |
| **Phase 3: GitHub** | 2 weeks | Git + gh CLI integration |
| **Phase 4: Polish** | 2 weeks | UI, error handling, docs |
| **Phase 5: Release** | 1 week | Binary distribution, install scripts |

**Total: ~11 weeks to v1.0**

---

## 11. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Azure OpenAI rate limits | High | Medium | Implement backoff, caching |
| LLM hallucinations | Medium | High | Human confirmation for edits |
| Breaking changes in dependencies | Medium | Low | Pin versions, test on update |
| Complex codebases overwhelm context | High | Medium | Smart context selection |

---

## 12. Appendix

### A. Competitive Analysis

| Tool | LLM | Memory | GitHub | CLI | Distribution |
|------|-----|--------|--------|-----|--------------|
| Claude Code | Claude | ❌ | ❌ | ✅ | npm |
| Aider | Various | ❌ | ❌ | ✅ | pip |
| Cursor | GPT-4 | ❌ | ❌ | ❌ | Electron |
| **Sharkbait** | Azure OpenAI | ✅ Beads | ✅ | ✅ | Binary |

### B. Key Differentiators

1. **Persistent memory** via Beads (unique)
2. **Azure OpenAI** for enterprise compliance
3. **Native GitHub** integration
4. **Single binary** distribution
5. **Cross-platform** from day one
