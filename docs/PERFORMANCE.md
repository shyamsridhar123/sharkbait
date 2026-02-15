# Sharkbait - Performance Targets

**Version:** 1.0  
**Date:** February 15, 2026  
**Status:** Current

---

## Table of Contents

1. [Overview](#overview)
2. [Response Time Targets](#response-time-targets)
3. [Resource Utilization Targets](#resource-utilization-targets)
4. [Observability Stack](#observability-stack)
5. [Performance Optimization Strategies](#performance-optimization-strategies)
6. [Monitoring and Metrics](#monitoring-and-metrics)

---

## Overview

This document defines performance targets and expectations for Sharkbait across different operational scenarios. These targets ensure a responsive user experience while maintaining reasonable resource consumption.

### Performance Philosophy

1. **Interactive First** - User-facing operations must be fast and responsive
2. **Async Everything** - Never block the UI thread
3. **Streaming by Default** - Show incremental progress for long operations
4. **Smart Caching** - Cache when beneficial, invalidate appropriately
5. **Graceful Degradation** - Maintain functionality under resource constraints

---

## Response Time Targets

### 1. Interactive Operations

These operations require immediate feedback as users are actively waiting.

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| **CLI Startup** | < 100ms | 200ms | Time from command execution to first output |
| **Command Parse** | < 10ms | 50ms | Parsing user input and routing to handler |
| **File Read (< 1MB)** | < 50ms | 100ms | Reading project files for context |
| **Directory List** | < 100ms | 300ms | Listing directory contents |
| **Git Status** | < 200ms | 500ms | Getting repository status |
| **First Token** | < 1s | 2s | Time to first LLM response token |
| **UI Render** | < 16ms | 50ms | Single frame render (60 FPS target) |
| **User Input Response** | < 100ms | 200ms | Responding to keypress/input |

**Rationale:** Interactive operations directly impact perceived performance. Users expect immediate feedback for UI interactions and fast responses for simple queries.

### 2. AI-Dependent Operations

These operations depend on LLM response times and are inherently variable.

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| **Simple Query (< 100 tokens)** | < 2s | 5s | Quick questions without tool use |
| **Code Generation (< 500 tokens)** | < 5s | 10s | Single file creation/edit |
| **Complex Task (multiple tools)** | < 15s | 30s | Tasks requiring 3-5 tool calls |
| **Code Review** | < 10s | 20s | Analyzing and reviewing code changes |
| **Codebase Analysis** | < 5s | 15s | Running codebase analysis tools |
| **LLM Retry (transient error)** | +1-4s | +8s | Additional time for retry with backoff |

**Rationale:** AI operations are constrained by model inference time and API latency. Targets are based on Azure OpenAI typical response times plus network overhead.

### 3. Background Operations

These operations run asynchronously and don't block user interaction.

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| **Context Loading** | < 2s | 5s | Loading files and git context in background |
| **Beads Memory Sync** | < 1s | 3s | Syncing memory to git backend |
| **File Search (< 1000 files)** | < 3s | 10s | Searching across project files |
| **GitHub API Call** | < 2s | 5s | Fetching issues, PRs, etc. |
| **Web Fetch** | < 3s | 10s | Fetching external web content |
| **Log Rotation** | < 100ms | 500ms | Rotating and compressing logs |

**Rationale:** Background operations should complete quickly but won't impact UX if they take longer. Users are notified of progress via spinners.

### 4. Long-Running Operations

These operations are expected to take significant time and show progress indicators.

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| **Autonomous Task** | 30s - 5min | 15min | Full feature implementation with tests |
| **Full Codebase Scan** | < 30s | 2min | Analyzing entire project structure |
| **Test Suite Run** | Variable | 10min | Depends on project test suite |
| **Build & Deploy** | Variable | 15min | Depends on project complexity |
| **Multi-File Refactor** | 1-5min | 10min | Large-scale code changes |

**Rationale:** Long operations require progress indicators and the ability to cancel. Users understand these take time but need visibility into progress.

---

## Resource Utilization Targets

### 1. Memory Usage

| Scenario | Target | Maximum | Notes |
|----------|--------|---------|-------|
| **Idle State** | < 50MB | 100MB | CLI process with no active sessions |
| **Active Chat Session** | < 200MB | 500MB | Single conversation with history |
| **Context Window (Full)** | < 100MB | 200MB | Loaded files and conversation |
| **Multiple Agents** | < 500MB | 1GB | Parallel agent execution |
| **Codebase Cache** | < 100MB | 300MB | Cached file analysis results |
| **Total System Impact** | < 1GB | 2GB | Peak memory usage including all components |

**Memory Management:**
- Context compaction when approaching limits
- LRU cache for file reads
- Stream processing for large files
- Garbage collection tuning for Bun runtime

### 2. CPU Usage

| Scenario | Target | Maximum | Notes |
|----------|--------|---------|-------|
| **Idle** | < 1% | 5% | Background event loop only |
| **Streaming Response** | < 20% | 50% | Rendering streamed LLM output |
| **Tool Execution** | < 30% | 80% | Running git/shell commands |
| **Syntax Highlighting** | < 15% | 40% | Highlighting code blocks |
| **Parallel Agent Work** | < 60% | 90% | Multiple agents executing concurrently |
| **File Search** | < 40% | 70% | Searching across project files |

**CPU Management:**
- Async I/O to avoid blocking
- Streaming to distribute work over time
- Worker threads for CPU-intensive tasks (future)
- Rate limiting for rapid operations

### 3. Disk I/O

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| **Log Write** | < 1MB/min | 10MB/min | Structured logging output |
| **Beads Storage** | < 5MB/session | 50MB/session | Git-backed memory persistence |
| **File Read Cache** | < 100MB | 500MB | Cached file contents |
| **Temp Files** | < 10MB | 100MB | Temporary working files |
| **Total Disk Usage** | < 200MB | 1GB | All persistent storage |

**Disk Management:**
- Buffered writes for logs
- Compression for old logs
- Cleanup of temporary files
- Beads storage pruning (old sessions)

### 4. Network Usage

| Operation | Target | Maximum | Notes |
|-----------|--------|---------|-------|
| **LLM Request (avg)** | < 10KB | 100KB | Message + context per request |
| **LLM Response (avg)** | < 5KB | 50KB | Generated text per response |
| **GitHub API Call** | < 5KB | 20KB | Issue/PR data fetch |
| **Web Fetch** | < 100KB | 1MB | External content fetch |
| **Total Session** | < 1MB | 10MB | Typical interactive session |

**Network Management:**
- Request deduplication
- Response caching where appropriate
- Retry with exponential backoff
- Connection pooling for API calls

---

## Observability Stack

Sharkbait uses a comprehensive observability stack to monitor and improve performance.

### 1. Structured Logging

**Implementation:** Custom logger with multiple levels (DEBUG, INFO, WARN, ERROR, FATAL)

**Log Format:**
```json
{
  "timestamp": "2026-02-15T10:00:00.000Z",
  "level": "INFO",
  "message": "Tool executed successfully",
  "context": {
    "tool": "execute_command",
    "duration_ms": 245,
    "exit_code": 0
  }
}
```

**Log Destinations:**
- Console (formatted for readability)
- File (JSON for analysis)
- Error tracking service (optional)

### 2. Performance Metrics

**Tracked Metrics:**
- **Operation Duration** - Time taken for each operation
- **LLM Token Counts** - Input/output tokens per request
- **Tool Execution Count** - Frequency of tool usage
- **Error Rates** - Failures by type and category
- **Cache Hit Rates** - Effectiveness of caching
- **Memory Pressure** - Heap usage and GC pauses

**Implementation:** See `src/utils/perf.ts`

```typescript
// Example metric collection
const metric = Metrics.timer("llm_request");
await performLLMRequest();
metric.stop();

// Metrics API
Metrics.count("tool.execute", { tool: "git_status" });
Metrics.gauge("memory.heap_used", process.memoryUsage().heapUsed);
Metrics.histogram("response_size", responseBytes);
```

### 3. Distributed Tracing

**Purpose:** Track requests across multiple components and services.

**Implementation:** See `src/utils/tracer.ts`

```typescript
// Create span
const span = Tracer.startSpan("agent_execution", {
  agent: "coder",
  task: "implement_feature"
});

// Add events
span.addEvent("tool_called", { tool: "write_file" });

// End span
span.end();
```

**Trace Context:**
- Trace ID - Unique per session
- Span ID - Unique per operation
- Parent Span ID - For nested operations
- Timing - Start/end timestamps

### 4. Health Checks

**Endpoints:** (for daemon mode, future feature)
- `/health` - Basic health status
- `/metrics` - Prometheus-compatible metrics
- `/ready` - Readiness probe

**Health Indicators:**
- Azure OpenAI connectivity
- File system access
- Git repository status
- Beads memory availability

---

## Performance Optimization Strategies

### 1. Lazy Loading

**What to Lazy Load:**
- Tool definitions (load on first use)
- Skills content (load when needed)
- Large file contents (only load requested sections)
- Agent implementations (instantiate on demand)

**Implementation:**
```typescript
// Lazy tool loading
private tools: Map<string, () => Tool> = new Map();

getTool(name: string): Tool {
  const loader = this.tools.get(name);
  if (!loader) throw new Error(`Unknown tool: ${name}`);
  return loader(); // Load on first access
}
```

### 2. Caching Strategy

**What to Cache:**
- File contents (with TTL and invalidation on write)
- Git status (invalidate on file changes)
- LLM tool definitions (static, cache indefinitely)
- Dependency analysis results (invalidate on package.json change)
- Codebase structure (invalidate on major file changes)

**Cache Implementation:**
```typescript
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class Cache<T> {
  get(key: string): T | undefined;
  set(key: string, value: T, ttl: number): void;
  invalidate(key: string): void;
  clear(): void;
}
```

### 3. Streaming and Incremental Processing

**Benefits:**
- Show progress immediately
- Reduce perceived latency
- Lower memory footprint
- Better user experience

**Where to Stream:**
- LLM responses (token by token)
- File search results (as found)
- Tool execution output (stdout/stderr)
- Large file reads (line by line)

### 4. Parallel Execution

**Opportunities for Parallelism:**
- Multiple file reads
- Independent tool calls
- Agent execution (where tasks are independent)
- File search across directories
- Multiple GitHub API calls

**Example:**
```typescript
// Parallel file reads
const contents = await Promise.all(
  files.map(f => readFile(f))
);

// Fan-out agent execution
const results = await Promise.all(
  subtasks.map(t => agent.execute(t))
);
```

### 5. Context Window Management

**Strategies:**
- **Summarization** - Compress old conversation turns
- **Pruning** - Remove low-value messages
- **Prioritization** - Keep high-value context (errors, user input)
- **Incremental Updates** - Only send changes, not full context

**Target Context Sizes:**
- Max context: 128K tokens
- Optimal context: < 32K tokens
- Trigger compaction at: 64K tokens

---

## Monitoring and Metrics

### Key Performance Indicators (KPIs)

1. **P50 Response Time** - Median operation duration
2. **P95 Response Time** - 95th percentile (acceptable worst case)
3. **P99 Response Time** - 99th percentile (rare slow cases)
4. **Error Rate** - Percentage of failed operations
5. **Retry Rate** - Percentage of operations requiring retry
6. **Cache Hit Rate** - Effectiveness of caching
7. **Memory Peak** - Maximum memory used per session
8. **CPU Average** - Average CPU usage during active work

### Performance Dashboards

**Recommended Tools:**
- **Grafana** - Metrics visualization
- **Prometheus** - Metrics collection (future)
- **Jaeger** - Distributed tracing visualization
- **DataDog / New Relic** - Full observability platform (optional)

**Key Charts:**
- Operation duration histogram
- Error rate over time
- Memory usage timeline
- LLM request latency
- Tool execution frequency

### Performance Testing

**Test Scenarios:**
1. **Cold Start** - Time from CLI invocation to ready
2. **Simple Query** - Single-turn conversation
3. **Complex Task** - Multi-turn with tool calls
4. **Large Codebase** - Operations on 10K+ files
5. **Concurrent Sessions** - Multiple agents executing
6. **Memory Pressure** - Sustained operation at context limits
7. **Network Degradation** - Behavior with high latency/packet loss

**Test Framework:**
```bash
# Run performance tests
bun test:performance

# Benchmark specific operations
bun benchmark --operation llm_request --iterations 100
```

---

## Conclusion

Performance targets are designed to ensure Sharkbait provides a responsive, efficient experience across interactive and autonomous operation modes. The observability stack provides visibility into actual performance, enabling continuous optimization and troubleshooting.

### Performance Priorities

1. **User Experience** - Interactive operations must be fast
2. **Resource Efficiency** - Minimal memory and CPU footprint
3. **Reliability** - Performance should be consistent and predictable
4. **Observability** - Always know what's happening and why

For any performance issues, refer to the logs and metrics to identify bottlenecks, then apply appropriate optimization strategies from this document.
