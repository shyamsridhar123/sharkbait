# Workflow Agents

| Field | Value |
|-------|-------|
| ID | SB-006 |
| Status | todo |
| Priority | high |
| Created | 2025-01-13 |

## Description

Implement the 4 workflow agents for complex multi-step operations:

1. **Feature Development** - End-to-end feature implementation
2. **PR Workflow** - Create/review/merge pull requests
3. **Bug Fix** - Diagnose and fix bugs
4. **Refactor** - Large-scale code refactoring

Each workflow coordinates multiple primary agents and subagents.

## Acceptance Criteria

- [ ] All 4 workflow agents implemented
- [ ] Multi-agent coordination working
- [ ] Beads integration for state persistence
- [ ] Progress reporting at each step
- [ ] Rollback capability on failures
