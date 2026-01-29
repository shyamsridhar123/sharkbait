# Workflow Agents

| Field | Value |
|-------|-------|
| ID | SB-006 |
| Status | todo |
| Priority | high |
| Created | 2025-01-13 |
| Updated | 2026-01-28 |

## Description

Implement the 4 workflow agents with **iterative refinement loops**:

1. **Feature Development** - End-to-end feature with reviewer ↔ coder loops
2. **PR Workflow** - Create/review/merge pull requests
3. **Bug Fix** - Diagnose → Fix → Verify with feedback loops
4. **Refactor** - Large-scale code refactoring with validation

**Iterative Refinement Pattern (Evaluator-Optimizer):**
Per Anthropic guidance, workflows should NOT be single-pass:

```
coder writes code → reviewer evaluates → if issues → coder fixes → re-review
```

**Refinement Loop Configuration:**
- Max iterations: 3 per stage
- Critical issues: Always loop back
- Minor issues: Continue with notes
- Review modes: Run in parallel (bugs, security, style)

Each workflow coordinates multiple primary agents using prompting modes.

## Acceptance Criteria

- [ ] All 4 workflow agents implemented
- [ ] **Iterative refinement loops (reviewer ↔ coder)**
- [ ] **Configurable max iterations per stage**
- [ ] **Parallel review mode execution**
- [ ] Multi-agent coordination working
- [ ] Beads integration for state persistence
- [ ] Progress reporting at each step
- [ ] Rollback capability on failures

## References

- AGENT_ARCHITECTURE.md Section 5.0: Iterative Refinement Pattern
