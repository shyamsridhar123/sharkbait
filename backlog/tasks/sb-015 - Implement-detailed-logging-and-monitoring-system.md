---
id: SB-015
title: Implement detailed logging and monitoring system
status: Done
assignee: []
created_date: '2026-01-29 18:13'
labels: [infrastructure, observability]
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create comprehensive logging infrastructure with: structured logging, log levels, file rotation, telemetry (opt-in), performance monitoring, and agent execution tracing
<!-- SECTION:DESCRIPTION:END -->

## Implementation Summary

### Components Created

1. **Enhanced Logger** (`src/utils/logger.ts`)
   - Structured JSON logging with context propagation
   - Multiple log levels (debug, info, warn, error)
   - Console and file output destinations
   - Log file rotation by size (10MB default, 5 files max)
   - Child loggers with inherited context
   - Timing utilities for async/sync operations

2. **Telemetry System** (`src/utils/telemetry.ts`)
   - Opt-in anonymous usage analytics (`SHARKBAIT_TELEMETRY=true`)
   - PII sanitization - no file paths, contents, or user data collected
   - Event buffering with periodic flush
   - Session and install ID tracking
   - Pre-defined safe events for agents, tools, LLM, commands

3. **Performance Monitor** (`src/utils/perf.ts`)
   - Counter, Histogram, and Gauge metric types
   - LLM call latency and token tracking
   - Tool execution timing
   - Memory usage monitoring
   - Performance reports with percentiles (p50, p90, p99)

4. **Distributed Tracer** (`src/utils/tracer.ts`)
   - Span-based tracing (OpenTelemetry-inspired)
   - Trace ID correlation across operations
   - Parent-child span relationships
   - Agent, tool, LLM, memory, and command tracing
   - Trace export for debugging

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SHARKBAIT_LOG_LEVEL` | Log level (debug/info/warn/error) | info |
| `SHARKBAIT_LOG_FILE` | Enable file logging | false |
| `SHARKBAIT_LOG_JSON` | JSON format for console | false |
| `SHARKBAIT_LOG_DIR` | Log file directory | ~/.sharkbait/logs |
| `SHARKBAIT_TELEMETRY` | Enable telemetry | false |

### Usage Examples

```typescript
import { log, perf, tracer, telemetry } from "./utils";

// Structured logging with context
log.info("Agent started", { agent: "coder", correlationId: "abc123" });

// Performance timing
await perf.timeAsync("llm.completion", async () => {
  // ... LLM call
});
perf.recordLLMCall(latencyMs, inputTokens, outputTokens);

// Distributed tracing
await traceAgent("coder", async (span) => {
  span.setAttribute("task", "implement-feature");
  await traceTool("file_write", async (toolSpan) => {
    // ... tool execution
  });
});

// Get performance report
perf.logSummary();
```
