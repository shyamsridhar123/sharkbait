# Agent Core System

| Field | Value |
|-------|-------|
| ID | SB-004 |
| Status | todo |
| Priority | high |
| Created | 2025-01-13 |
| Updated | 2026-01-28 |

## Description

Implement the core agent infrastructure with **stall detection, context management, parallel execution, and model flexibility**:

**Subtasks:**
- **SB-004.01**: Main agent loop with dual-ledger stall detection
- **SB-004.02**: Context management with intelligent compaction
- **SB-004.03**: Tool execution framework
- **SB-004.04**: Parallel execution coordinator (NEW)
- **SB-004.05**: Heterogeneous model support (NEW)

**Key Design Principles (per Anthropic & Magentic-One):**
- Stall detection with automatic recovery
- Context compaction preserving critical information
- Parallel execution for independent tasks
- Different models for different agent roles

## Acceptance Criteria

- [ ] Agent base class with lifecycle methods
- [ ] **Dual-ledger progress tracking (Task + Progress)**
- [ ] **Stall detection and recovery strategies**
- [ ] Context window management (128K tokens)
- [ ] **Intelligent context compaction**
- [ ] Tool registration and execution pipeline
- [ ] Message history with summarization
- [ ] **Parallel execution coordinator**
- [ ] **Heterogeneous model support**
- [ ] Integration with Azure OpenAI streaming

## References

- TRD Section 3.2-3.4
- AGENT_ARCHITECTURE.md Sections 4.1.1, 6.5, 12.1
