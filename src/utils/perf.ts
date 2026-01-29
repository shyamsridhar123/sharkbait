/**
 * Performance Monitor - Track and report performance metrics for Sharkbait
 * 
 * Features:
 * - Track operation durations (LLM calls, tool execution, etc.)
 * - Memory usage monitoring
 * - Throughput metrics (tokens/sec, operations/min)
 * - Histogram-based latency tracking
 * - Performance reports
 */

import { log } from "./logger";
import { telemetry } from "./telemetry";

// ============================================================================
// Types
// ============================================================================

export interface MetricSample {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface HistogramBucket {
  le: number; // "less than or equal to"
  count: number;
}

export interface MetricStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p90: number;
  p99: number;
}

export interface PerformanceReport {
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  metrics: Record<string, MetricStats>;
  counters: Record<string, number>;
}

export interface TimerHandle {
  stop: () => number;
  label: string;
  startTime: number;
}

// ============================================================================
// Metric Classes
// ============================================================================

class Counter {
  private value = 0;
  private labels: Record<string, number> = {};

  inc(amount = 1, label?: string): void {
    this.value += amount;
    if (label) {
      this.labels[label] = (this.labels[label] || 0) + amount;
    }
  }

  getValue(): number {
    return this.value;
  }

  getByLabel(label: string): number {
    return this.labels[label] || 0;
  }

  getLabels(): Record<string, number> {
    return { ...this.labels };
  }

  reset(): void {
    this.value = 0;
    this.labels = {};
  }
}

class Histogram {
  private samples: number[] = [];
  private sum = 0;
  private count = 0;
  private min = Infinity;
  private max = -Infinity;
  private readonly maxSamples: number;

  constructor(maxSamples = 1000) {
    this.maxSamples = maxSamples;
  }

  observe(value: number): void {
    this.samples.push(value);
    this.sum += value;
    this.count++;
    this.min = Math.min(this.min, value);
    this.max = Math.max(this.max, value);

    // Trim old samples if needed
    if (this.samples.length > this.maxSamples) {
      const removed = this.samples.shift()!;
      this.sum -= removed;
    }
  }

  getStats(): MetricStats {
    if (this.samples.length === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        mean: 0,
        p50: 0,
        p90: 0,
        p99: 0,
      };
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const percentile = (p: number) => {
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    };

    return {
      count: this.count,
      sum: this.sum,
      min: this.min === Infinity ? 0 : this.min,
      max: this.max === -Infinity ? 0 : this.max,
      mean: this.sum / this.samples.length,
      p50: percentile(50),
      p90: percentile(90),
      p99: percentile(99),
    };
  }

  reset(): void {
    this.samples = [];
    this.sum = 0;
    this.count = 0;
    this.min = Infinity;
    this.max = -Infinity;
  }
}

class Gauge {
  private value = 0;
  private history: MetricSample[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  set(value: number): void {
    this.value = value;
    this.history.push({ value, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  inc(amount = 1): void {
    this.set(this.value + amount);
  }

  dec(amount = 1): void {
    this.set(this.value - amount);
  }

  getValue(): number {
    return this.value;
  }

  getHistory(): MetricSample[] {
    return [...this.history];
  }

  reset(): void {
    this.value = 0;
    this.history = [];
  }
}

// ============================================================================
// Performance Monitor Class
// ============================================================================

class PerformanceMonitor {
  private startTime = Date.now();
  private counters: Map<string, Counter> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private activeTimers: Map<string, TimerHandle> = new Map();

  // Pre-defined metrics
  private readonly llmLatency: Histogram;
  private readonly llmTokens: Counter;
  private readonly toolLatency: Histogram;
  private readonly toolCalls: Counter;
  private readonly agentLoops: Counter;
  private readonly errors: Counter;
  private readonly activeOperations: Gauge;

  constructor() {
    // Initialize pre-defined metrics
    this.llmLatency = this.getOrCreateHistogram("llm.latency");
    this.llmTokens = this.getOrCreateCounter("llm.tokens");
    this.toolLatency = this.getOrCreateHistogram("tool.latency");
    this.toolCalls = this.getOrCreateCounter("tool.calls");
    this.agentLoops = this.getOrCreateCounter("agent.loops");
    this.errors = this.getOrCreateCounter("errors");
    this.activeOperations = this.getOrCreateGauge("active.operations");
  }

  // ---- Counter Operations ----

  private getOrCreateCounter(name: string): Counter {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Counter());
    }
    return this.counters.get(name)!;
  }

  incCounter(name: string, amount = 1, label?: string): void {
    this.getOrCreateCounter(name).inc(amount, label);
  }

  getCounter(name: string): number {
    return this.counters.get(name)?.getValue() || 0;
  }

  // ---- Histogram Operations ----

  private getOrCreateHistogram(name: string): Histogram {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Histogram());
    }
    return this.histograms.get(name)!;
  }

  observeHistogram(name: string, value: number): void {
    this.getOrCreateHistogram(name).observe(value);
  }

  getHistogramStats(name: string): MetricStats | null {
    return this.histograms.get(name)?.getStats() || null;
  }

  // ---- Gauge Operations ----

  private getOrCreateGauge(name: string): Gauge {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Gauge());
    }
    return this.gauges.get(name)!;
  }

  setGauge(name: string, value: number): void {
    this.getOrCreateGauge(name).set(value);
  }

  getGauge(name: string): number {
    return this.gauges.get(name)?.getValue() || 0;
  }

  // ---- Timer Operations ----

  /**
   * Start a timer for an operation
   */
  startTimer(label: string): TimerHandle {
    const startTime = performance.now();
    this.activeOperations.inc();

    const handle: TimerHandle = {
      label,
      startTime,
      stop: () => {
        const duration = performance.now() - startTime;
        this.observeHistogram(label, duration);
        this.activeOperations.dec();
        this.activeTimers.delete(label);
        return duration;
      },
    };

    this.activeTimers.set(label, handle);
    return handle;
  }

  /**
   * Time an async operation
   */
  async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const timer = this.startTimer(label);
    try {
      const result = await fn();
      timer.stop();
      return result;
    } catch (error) {
      timer.stop();
      this.errors.inc(1, label);
      throw error;
    }
  }

  /**
   * Time a sync operation
   */
  timeSync<T>(label: string, fn: () => T): T {
    const timer = this.startTimer(label);
    try {
      const result = fn();
      timer.stop();
      return result;
    } catch (error) {
      timer.stop();
      this.errors.inc(1, label);
      throw error;
    }
  }

  // ---- Pre-defined Metric Shortcuts ----

  /**
   * Record an LLM call
   */
  recordLLMCall(latencyMs: number, inputTokens: number, outputTokens: number): void {
    this.llmLatency.observe(latencyMs);
    this.llmTokens.inc(inputTokens, "input");
    this.llmTokens.inc(outputTokens, "output");
    telemetry.track("llm.request", { 
      latencyMs: Math.round(latencyMs),
      inputTokens,
      outputTokens,
    });
  }

  /**
   * Record a tool execution
   */
  recordToolCall(tool: string, latencyMs: number, success: boolean): void {
    this.toolLatency.observe(latencyMs);
    this.toolCalls.inc(1, success ? "success" : "failure");
    this.toolCalls.inc(1, tool);
    if (!success) {
      this.errors.inc(1, `tool.${tool}`);
    }
  }

  /**
   * Record an agent loop iteration
   */
  recordAgentLoop(agent: string): void {
    this.agentLoops.inc(1, agent);
  }

  /**
   * Record an error
   */
  recordError(category: string): void {
    this.errors.inc(1, category);
  }

  // ---- Reporting ----

  /**
   * Get memory usage statistics
   */
  getMemoryUsage(): PerformanceReport["memory"] {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      rss: mem.rss,
    };
  }

  /**
   * Generate a full performance report
   */
  getReport(): PerformanceReport {
    const metrics: Record<string, MetricStats> = {};
    for (const [name, histogram] of this.histograms) {
      metrics[name] = histogram.getStats();
    }

    const counters: Record<string, number> = {};
    for (const [name, counter] of this.counters) {
      counters[name] = counter.getValue();
      // Also include labeled values
      const labels = counter.getLabels();
      for (const [label, value] of Object.entries(labels)) {
        counters[`${name}.${label}`] = value;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      memory: this.getMemoryUsage(),
      metrics,
      counters,
    };
  }

  /**
   * Log a summary of performance metrics
   */
  logSummary(): void {
    const report = this.getReport();
    const mem = report.memory;

    log.info("=== Performance Summary ===");
    log.info(`Uptime: ${Math.round(report.uptime / 1000)}s`);
    log.info(`Memory: ${Math.round(mem.heapUsed / 1024 / 1024)}MB used / ${Math.round(mem.heapTotal / 1024 / 1024)}MB total`);

    // LLM metrics
    const llmStats = report.metrics["llm.latency"];
    if (llmStats && llmStats.count > 0) {
      log.info(`LLM Calls: ${llmStats.count}, Avg: ${Math.round(llmStats.mean)}ms, P99: ${Math.round(llmStats.p99)}ms`);
    }

    // Tool metrics
    const toolStats = report.metrics["tool.latency"];
    if (toolStats && toolStats.count > 0) {
      log.info(`Tool Calls: ${toolStats.count}, Avg: ${Math.round(toolStats.mean)}ms, P99: ${Math.round(toolStats.p99)}ms`);
    }

    // Counters
    for (const [name, value] of Object.entries(report.counters)) {
      if (value > 0 && !name.includes(".")) {
        log.info(`${name}: ${value}`);
      }
    }
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.startTime = Date.now();
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
    for (const gauge of this.gauges.values()) {
      gauge.reset();
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const perf = new PerformanceMonitor();

// Export class for testing
export { PerformanceMonitor, Counter, Histogram, Gauge };
