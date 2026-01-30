# CLI and Terminal UI

| Field | Value |
|-------|-------|
| ID | SB-011 |
| Status | in-progress |
| Priority | high |
| Created | 2025-01-13 |
| Updated | 2026-01-29 |

## Description

Build the terminal UI using ink (React for CLI):
- Interactive prompt with syntax highlighting
- Streaming response display
- Tool execution visualization
- Progress indicators
- Color-coded output
- Keyboard shortcuts

## Subtasks

### Phase 1: Wire Existing Components (HIGH PRIORITY)
| ID | Task | Status | Priority |
|----|------|--------|----------|
| SB-011.04 | Wire ToolCallView component to app.tsx | todo | HIGH |
| SB-011.05 | Wire StatusBar token tracking | todo | HIGH |
| SB-011.09 | Handle agent system events in UI | todo | HIGH |
| SB-011.12 | Fix Ctrl+C to cancel instead of exit | todo | HIGH |

### Phase 2: Core UX Features (HIGH PRIORITY)
| ID | Task | Status | Priority |
|----|------|--------|----------|
| SB-011.07 | Implement diff view for code changes | todo | HIGH |
| SB-011.08 | Implement confirmation dialogs | todo | HIGH |

### Phase 3: Enhanced Features (MEDIUM PRIORITY)
| ID | Task | Status | Priority |
|----|------|--------|----------|
| SB-011.06 | Implement syntax highlighting | todo | MEDIUM |
| SB-011.10 | Implement parallel execution UI | todo | MEDIUM |
| SB-011.13 | Implement Beads task display | todo | MEDIUM |
| SB-011.14 | Implement GitHub PR/Issue UI | todo | MEDIUM |

### Phase 4: Polish (LOW PRIORITY)
| ID | Task | Status | Priority |
|----|------|--------|----------|
| SB-011.11 | Implement command history + autocomplete | todo | LOW |
| SB-011.15 | Implement progress bars | todo | LOW |

### Already Complete
| ID | Task | Status |
|----|------|--------|
| SB-011.01 | CLI entry point with Commander | ✅ done |
| SB-011.02 | Ink UI components | ✅ done |
| SB-011.03 | Integrate CLI commands into UI | ✅ done |

## Acceptance Criteria

- [x] Beautiful terminal UI
- [x] Streaming text rendering
- [ ] Tool call visualization (component exists, not wired)
- [x] Spinner/progress components
- [x] Responsive layout
- [ ] Ctrl+C handling (exits instead of cancel)
- [ ] Syntax highlighted code blocks
- [ ] Diff view for changes
- [ ] Confirmation dialogs
- [ ] Token/cost tracking display
- [ ] Agent routing display
- [ ] Parallel execution UI

## Current Status: ~40% Complete

Foundation is solid. Missing key UX features from PRD.
