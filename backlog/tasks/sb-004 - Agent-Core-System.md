# Agent Core System

| Field | Value |
|-------|-------|
| ID | SB-004 |
| Status | todo |
| Priority | high |
| Created | 2025-01-13 |

## Description

Implement the core agent infrastructure:
- Main agent loop (perceive → think → act)
- Context management with token limits
- Tool execution framework
- Message history management
- Streaming response handling

## Acceptance Criteria

- [ ] Agent base class with lifecycle methods
- [ ] Context window management (128K tokens)
- [ ] Tool registration and execution pipeline
- [ ] Message history with summarization
- [ ] Integration with Azure OpenAI streaming
