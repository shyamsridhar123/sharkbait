/**
 * Utils Module - exports utility functions and classes
 */

export { loadConfig, type Config } from "./config";
export { 
  log, 
  Logger,
  type LogLevel, 
  type LogContext, 
  type LogEntry, 
  type LoggerOptions 
} from "./logger";
export { 
  SharkbaitError, 
  LLMError, 
  ToolError, 
  ConfigError 
} from "./errors";
export { 
  isWindows, 
  isMac, 
  isLinux, 
  getHomeDir, 
  normalizePath 
} from "./platform";
export { isCommandSafe, BLOCKED_COMMANDS } from "./security";

// Telemetry (opt-in analytics)
export {
  telemetry,
  trackSessionStart,
  trackSessionEnd,
  trackAgent,
  trackTool,
  trackLLM,
  trackCommand,
  trackError,
  type TelemetryEvent,
  type TelemetryConfig,
  type TelemetryStats,
} from "./telemetry";

// Performance monitoring
export {
  perf,
  PerformanceMonitor,
  Counter,
  Histogram,
  Gauge,
  type MetricSample,
  type MetricStats,
  type PerformanceReport,
  type TimerHandle,
} from "./perf";

// Distributed tracing
export {
  tracer,
  traceAgent,
  traceTool,
  traceLLM,
  traceMemory,
  traceCommand,
  Tracer,
  SpanBuilder,
  type Span,
  type SpanKind,
  type SpanStatus,
  type SpanAttributes,
  type SpanEvent,
  type TraceContext,
  type TraceExport,
} from "./tracer";
