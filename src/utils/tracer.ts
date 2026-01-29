/**
 * Tracer - Distributed tracing for agent execution in Sharkbait
 * 
 * Features:
 * - Span-based tracing (similar to OpenTelemetry concepts)
 * - Correlation ID propagation
 * - Parent-child span relationships
 * - Agent loop, tool call, and LLM request tracing
 * - Trace export for debugging
 */

import { randomUUID } from "crypto";
import { log, LogContext } from "./logger";
import { perf } from "./perf";
import { telemetry } from "./telemetry";

// ============================================================================
// Types
// ============================================================================

export type SpanKind = "internal" | "agent" | "tool" | "llm" | "memory" | "command";

export type SpanStatus = "unset" | "ok" | "error";

export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: SpanAttributes;
}

export interface Span {
  /** Unique span ID */
  spanId: string;
  /** Trace ID (shared across all spans in a trace) */
  traceId: string;
  /** Parent span ID (if any) */
  parentSpanId?: string;
  /** Span name/operation */
  name: string;
  /** Kind of span */
  kind: SpanKind;
  /** Start timestamp (ms) */
  startTime: number;
  /** End timestamp (ms) */
  endTime?: number;
  /** Duration (ms) */
  duration?: number;
  /** Status */
  status: SpanStatus;
  /** Error message if status is error */
  error?: string;
  /** Span attributes */
  attributes: SpanAttributes;
  /** Events that occurred during span */
  events: SpanEvent[];
}

export interface TraceContext {
  traceId: string;
  spanId: string;
}

export interface TraceExport {
  traceId: string;
  startTime: number;
  endTime: number;
  duration: number;
  spanCount: number;
  spans: Span[];
}

// ============================================================================
// Span Builder
// ============================================================================

class SpanBuilder {
  private span: Span;
  private tracer: Tracer;
  private ended = false;

  constructor(tracer: Tracer, name: string, kind: SpanKind, parentContext?: TraceContext) {
    this.tracer = tracer;
    this.span = {
      spanId: randomUUID().split("-")[0],
      traceId: parentContext?.traceId || randomUUID(),
      parentSpanId: parentContext?.spanId,
      name,
      kind,
      startTime: Date.now(),
      status: "unset",
      attributes: {},
      events: [],
    };
  }

  /**
   * Set span attributes
   */
  setAttribute(key: string, value: string | number | boolean): SpanBuilder {
    this.span.attributes[key] = value;
    return this;
  }

  /**
   * Set multiple attributes
   */
  setAttributes(attributes: SpanAttributes): SpanBuilder {
    Object.assign(this.span.attributes, attributes);
    return this;
  }

  /**
   * Add an event to the span
   */
  addEvent(name: string, attributes?: SpanAttributes): SpanBuilder {
    this.span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
    return this;
  }

  /**
   * Set span status to OK
   */
  setOk(): SpanBuilder {
    this.span.status = "ok";
    return this;
  }

  /**
   * Set span status to error
   */
  setError(error: string | Error): SpanBuilder {
    this.span.status = "error";
    this.span.error = error instanceof Error ? error.message : error;
    return this;
  }

  /**
   * Get trace context for child spans
   */
  getContext(): TraceContext {
    return {
      traceId: this.span.traceId,
      spanId: this.span.spanId,
    };
  }

  /**
   * Get the span data
   */
  getSpan(): Span {
    return { ...this.span };
  }

  /**
   * End the span
   */
  end(): Span {
    if (this.ended) {
      return this.span;
    }

    this.ended = true;
    this.span.endTime = Date.now();
    this.span.duration = this.span.endTime - this.span.startTime;

    // Set status to OK if unset and no error
    if (this.span.status === "unset") {
      this.span.status = "ok";
    }

    // Register with tracer
    this.tracer.recordSpan(this.span);

    // Log span completion
    const ctx: LogContext = {
      correlationId: this.span.traceId,
      ...this.span.attributes as Record<string, unknown>,
    };

    if (this.span.status === "error") {
      log.error(`Span ended: ${this.span.name} (${this.span.duration}ms) - ${this.span.error}`, undefined, ctx);
    } else {
      log.debug(`Span ended: ${this.span.name} (${this.span.duration}ms)`, ctx);
    }

    // Record to performance monitor
    perf.observeHistogram(`span.${this.span.kind}`, this.span.duration);

    return this.span;
  }
}

// ============================================================================
// Tracer Class
// ============================================================================

class Tracer {
  private activeSpans: Map<string, SpanBuilder> = new Map();
  private completedSpans: Map<string, Span[]> = new Map();
  private currentContext: TraceContext | null = null;
  private maxSpansPerTrace = 1000;
  private maxTraces = 100;

  /**
   * Start a new span
   */
  startSpan(name: string, kind: SpanKind = "internal", parentContext?: TraceContext): SpanBuilder {
    const ctx = parentContext || this.currentContext || undefined;
    const span = new SpanBuilder(this, name, kind, ctx);
    this.activeSpans.set(span.getContext().spanId, span);
    
    log.debug(`Span started: ${name}`, { 
      correlationId: span.getContext().traceId,
      kind,
    });

    return span;
  }

  /**
   * Start a new trace (root span)
   */
  startTrace(name: string, kind: SpanKind = "internal"): SpanBuilder {
    const span = new SpanBuilder(this, name, kind);
    this.currentContext = span.getContext();
    this.activeSpans.set(span.getContext().spanId, span);

    log.info(`Trace started: ${name}`, { 
      correlationId: span.getContext().traceId 
    });

    telemetry.track("agent.started", { 
      traceId: span.getContext().traceId.substring(0, 8),
    });

    return span;
  }

  /**
   * Get current trace context
   */
  getCurrentContext(): TraceContext | null {
    return this.currentContext;
  }

  /**
   * Set current trace context
   */
  setCurrentContext(context: TraceContext | null): void {
    this.currentContext = context;
  }

  /**
   * Run a function within a span context
   */
  async withSpan<T>(
    name: string, 
    kind: SpanKind, 
    fn: (span: SpanBuilder) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(name, kind);
    const prevContext = this.currentContext;
    this.currentContext = span.getContext();

    try {
      const result = await fn(span);
      span.setOk();
      return result;
    } catch (error) {
      span.setError(error instanceof Error ? error : String(error));
      throw error;
    } finally {
      span.end();
      this.currentContext = prevContext;
    }
  }

  /**
   * Run a sync function within a span context
   */
  withSpanSync<T>(
    name: string, 
    kind: SpanKind, 
    fn: (span: SpanBuilder) => T
  ): T {
    const span = this.startSpan(name, kind);
    const prevContext = this.currentContext;
    this.currentContext = span.getContext();

    try {
      const result = fn(span);
      span.setOk();
      return result;
    } catch (error) {
      span.setError(error instanceof Error ? error : String(error));
      throw error;
    } finally {
      span.end();
      this.currentContext = prevContext;
    }
  }

  /**
   * Record a completed span
   */
  recordSpan(span: Span): void {
    this.activeSpans.delete(span.spanId);

    if (!this.completedSpans.has(span.traceId)) {
      this.completedSpans.set(span.traceId, []);
      
      // Limit number of stored traces
      if (this.completedSpans.size > this.maxTraces) {
        const oldestTraceId = this.completedSpans.keys().next().value;
        if (oldestTraceId) {
          this.completedSpans.delete(oldestTraceId);
        }
      }
    }

    const spans = this.completedSpans.get(span.traceId)!;
    if (spans.length < this.maxSpansPerTrace) {
      spans.push(span);
    }
  }

  /**
   * Get all spans for a trace
   */
  getTrace(traceId: string): Span[] {
    return this.completedSpans.get(traceId) || [];
  }

  /**
   * Export a trace for debugging
   */
  exportTrace(traceId: string): TraceExport | null {
    const spans = this.getTrace(traceId);
    if (spans.length === 0) return null;

    const startTime = Math.min(...spans.map(s => s.startTime));
    const endTime = Math.max(...spans.map(s => s.endTime || s.startTime));

    return {
      traceId,
      startTime,
      endTime,
      duration: endTime - startTime,
      spanCount: spans.length,
      spans,
    };
  }

  /**
   * Get active span count
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }

  /**
   * Get stored trace count
   */
  getTraceCount(): number {
    return this.completedSpans.size;
  }

  /**
   * Clear all stored traces
   */
  clear(): void {
    this.activeSpans.clear();
    this.completedSpans.clear();
    this.currentContext = null;
  }

  /**
   * Log a trace summary
   */
  logTraceSummary(traceId: string): void {
    const trace = this.exportTrace(traceId);
    if (!trace) {
      log.warn(`Trace not found: ${traceId}`);
      return;
    }

    log.info(`=== Trace Summary: ${traceId} ===`);
    log.info(`Duration: ${trace.duration}ms, Spans: ${trace.spanCount}`);

    // Build hierarchy
    const rootSpans = trace.spans.filter(s => !s.parentSpanId);
    const childMap = new Map<string, Span[]>();
    
    for (const span of trace.spans) {
      if (span.parentSpanId) {
        if (!childMap.has(span.parentSpanId)) {
          childMap.set(span.parentSpanId, []);
        }
        childMap.get(span.parentSpanId)!.push(span);
      }
    }

    const printSpan = (span: Span, indent: number) => {
      const prefix = "  ".repeat(indent);
      const status = span.status === "error" ? "❌" : "✓";
      const duration = span.duration ? `${span.duration}ms` : "...";
      log.info(`${prefix}${status} [${span.kind}] ${span.name} (${duration})`);
      
      const children = childMap.get(span.spanId) || [];
      for (const child of children) {
        printSpan(child, indent + 1);
      }
    };

    for (const root of rootSpans) {
      printSpan(root, 0);
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export const tracer = new Tracer();

/**
 * Trace an agent execution
 */
export async function traceAgent<T>(
  agentName: string, 
  fn: (span: SpanBuilder) => Promise<T>
): Promise<T> {
  return tracer.withSpan(agentName, "agent", async (span) => {
    span.setAttribute("agent.name", agentName);
    perf.recordAgentLoop(agentName);
    return fn(span);
  });
}

/**
 * Trace a tool execution
 */
export async function traceTool<T>(
  toolName: string, 
  fn: (span: SpanBuilder) => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await tracer.withSpan(toolName, "tool", async (span) => {
      span.setAttribute("tool.name", toolName);
      return fn(span);
    });
    perf.recordToolCall(toolName, performance.now() - startTime, true);
    return result;
  } catch (error) {
    perf.recordToolCall(toolName, performance.now() - startTime, false);
    throw error;
  }
}

/**
 * Trace an LLM call
 */
export async function traceLLM<T>(
  model: string, 
  fn: (span: SpanBuilder) => Promise<T>
): Promise<T> {
  return tracer.withSpan(`llm:${model}`, "llm", async (span) => {
    span.setAttribute("llm.model", model);
    return fn(span);
  });
}

/**
 * Trace a memory operation
 */
export async function traceMemory<T>(
  operation: string, 
  fn: (span: SpanBuilder) => Promise<T>
): Promise<T> {
  return tracer.withSpan(`memory:${operation}`, "memory", async (span) => {
    span.setAttribute("memory.operation", operation);
    return fn(span);
  });
}

/**
 * Trace a command execution
 */
export async function traceCommand<T>(
  command: string, 
  fn: (span: SpanBuilder) => Promise<T>
): Promise<T> {
  return tracer.withSpan(`command:${command}`, "command", async (span) => {
    span.setAttribute("command.name", command);
    return fn(span);
  });
}

// Export class for testing
export { Tracer, SpanBuilder };
