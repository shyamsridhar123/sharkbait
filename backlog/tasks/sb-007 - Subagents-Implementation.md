# ~~Subagents Implementation~~ → Prompting Modes System

| Field | Value |
|-------|-------|
| ID | SB-007 |
| Status | Completed |
| Priority | medium |
| Created | 2025-01-13 |
| Updated | 2026-01-28 |

## ⚠️ Architecture Change Notice

**Original plan (19 subagents) has been replaced with Prompting Modes.**

Per Anthropic's "Building Effective Agents" guidance:
> "We recommend finding the simplest solution possible, and only increasing complexity when needed."

**Why the change:**
- Subagents add latency and cost (separate LLM calls)
- Context is lost during handoffs
- Harder to test and debug
- Prompting modes achieve same specialization with single agent

## Description

Implement **prompting modes** for primary agents instead of separate subagents:

| Agent | Modes |
|-------|-------|
| `coder` | `--mode=write`, `--mode=refactor`, `--mode=test`, `--mode=docs` |
| `reviewer` | `--mode=bugs`, `--mode=security`, `--mode=style`, `--mode=performance` |
| `planner` | `--mode=architecture`, `--mode=tasks`, `--mode=estimate` |
| `debugger` | `--mode=trace`, `--mode=hypothesis`, `--mode=fix` |
| `explorer` | `--mode=map`, `--mode=dependencies`, `--mode=patterns` |

**Implementation:**
- Modes are system prompt injections, not separate agents
- Single agent maintains full context
- Same model can run multiple modes in parallel

## Acceptance Criteria

- [ ] Mode system implemented for all 5 primary agents
- [ ] System prompt injection for mode-specific behavior
- [ ] Mode-specific confidence thresholds (reviewer modes)
- [ ] Parallel mode execution support
- [ ] Mode documentation and usage examples

## References

- AGENT_ARCHITECTURE.md Section 6: Prompting Modes
