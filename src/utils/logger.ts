/**
 * Logger - Comprehensive structured logging for Sharkbait
 * 
 * Features:
 * - Structured JSON logging with context propagation
 * - Multiple log levels (debug, info, warn, error)
 * - Console and file output destinations
 * - Log file rotation by size
 * - Request tracing with correlation IDs
 * - Performance timing utilities
 */

import chalk from "chalk";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, appendFileSync, statSync, renameSync, readdirSync, unlinkSync } from "fs";

// ============================================================================
// Types
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Agent name if within agent context */
  agent?: string;
  /** Tool name if within tool execution */
  tool?: string;
  /** Session ID */
  sessionId?: string;
  /** Additional context properties */
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number;
}

export interface LoggerOptions {
  /** Minimum log level */
  level?: LogLevel;
  /** Enable console output */
  console?: boolean;
  /** Enable file output */
  file?: boolean;
  /** Log file directory */
  logDir?: string;
  /** Max log file size in bytes before rotation */
  maxFileSize?: number;
  /** Max number of rotated files to keep */
  maxFiles?: number;
  /** Use JSON format for console output */
  jsonConsole?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const DEFAULT_OPTIONS: Required<LoggerOptions> = {
  level: "info",
  console: true,
  file: false,
  logDir: join(homedir(), ".sharkbait", "logs"),
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  jsonConsole: false,
};

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  private options: Required<LoggerOptions>;
  private context: LogContext = {};
  private logFileName = "sharkbait.log";

  constructor(options: LoggerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.loadOptionsFromEnv();
    this.ensureLogDir();
  }

  private loadOptionsFromEnv(): void {
    const envLevel = process.env["SHARKBAIT_LOG_LEVEL"]?.toLowerCase();
    if (envLevel && envLevel in LOG_LEVELS) {
      this.options.level = envLevel as LogLevel;
    }

    if (process.env["SHARKBAIT_LOG_FILE"] === "true") {
      this.options.file = true;
    }

    if (process.env["SHARKBAIT_LOG_JSON"] === "true") {
      this.options.jsonConsole = true;
    }

    if (process.env["SHARKBAIT_LOG_DIR"]) {
      this.options.logDir = process.env["SHARKBAIT_LOG_DIR"];
    }
  }

  private ensureLogDir(): void {
    if (this.options.file && !existsSync(this.options.logDir)) {
      try {
        mkdirSync(this.options.logDir, { recursive: true });
      } catch {
        // Silently disable file logging if dir creation fails
        this.options.file = false;
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.options.level];
  }

  private getLogFilePath(): string {
    return join(this.options.logDir, this.logFileName);
  }

  private rotateLogsIfNeeded(): void {
    const logPath = this.getLogFilePath();
    if (!existsSync(logPath)) return;

    try {
      const stats = statSync(logPath);
      if (stats.size >= this.options.maxFileSize) {
        this.rotateLogs();
      }
    } catch {
      // Ignore rotation errors
    }
  }

  private rotateLogs(): void {
    const logPath = this.getLogFilePath();
    const baseName = this.logFileName.replace(".log", "");

    // Shift existing rotated files
    for (let i = this.options.maxFiles - 1; i >= 1; i--) {
      const oldPath = join(this.options.logDir, `${baseName}.${i}.log`);
      const newPath = join(this.options.logDir, `${baseName}.${i + 1}.log`);
      if (existsSync(oldPath)) {
        if (i === this.options.maxFiles - 1) {
          unlinkSync(oldPath);
        } else {
          renameSync(oldPath, newPath);
        }
      }
    }

    // Rotate current log
    renameSync(logPath, join(this.options.logDir, `${baseName}.1.log`));
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.options.file) return;

    try {
      this.rotateLogsIfNeeded();
      const line = JSON.stringify(entry) + "\n";
      appendFileSync(this.getLogFilePath(), line, "utf-8");
    } catch {
      // Silently ignore file write errors
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    if (this.options.jsonConsole) {
      return JSON.stringify(entry);
    }

    const timestamp = entry.timestamp.substring(11, 23);
    const levelColors = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red,
    };

    const levelColor = levelColors[entry.level];
    const prefix = levelColor(`[${timestamp}] [${entry.level.toUpperCase().padEnd(5)}]`);

    let message = `${prefix} ${entry.message}`;

    // Add context info if present
    if (entry.context?.agent) {
      message = `${prefix} ${chalk.cyan(`[${entry.context.agent}]`)} ${entry.message}`;
    }
    if (entry.context?.tool) {
      message = `${prefix} ${chalk.magenta(`[tool:${entry.context.tool}]`)} ${entry.message}`;
    }

    // Add duration if present
    if (entry.duration !== undefined) {
      message += chalk.gray(` (${entry.duration}ms)`);
    }

    // Add error details if present
    if (entry.error) {
      message += `\n${chalk.red(entry.error.stack || entry.error.message)}`;
    }

    return message;
  }

  private emit(level: LogLevel, message: string, extra?: Partial<LogEntry>): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...extra,
    };

    // Merge logger context with entry context
    if (Object.keys(this.context).length > 0 || extra?.context) {
      entry.context = { ...this.context, ...extra?.context };
    }

    if (this.options.console) {
      console.error(this.formatConsoleMessage(entry));
    }

    this.writeToFile(entry);
  }

  // ---- Public Logging Methods ----

  debug(message: string, context?: LogContext): void {
    this.emit("debug", message, { context });
  }

  info(message: string, context?: LogContext): void {
    this.emit("info", message, { context });
  }

  warn(message: string, context?: LogContext): void {
    this.emit("warn", message, { context });
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorObj = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : error
        ? { name: "Error", message: String(error) }
        : undefined;
    
    this.emit("error", message, { error: errorObj, context });
  }

  // ---- Context Management ----

  /**
   * Set global context that will be included in all log entries
   */
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear global context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const child = new Logger(this.options);
    child.context = { ...this.context, ...context };
    return child;
  }

  // ---- Utility Methods ----

  /**
   * Time an async operation and log its duration
   */
  async time<T>(label: string, fn: () => Promise<T>, context?: LogContext): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = Math.round(performance.now() - start);
      this.emit("info", label, { duration, context });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.emit("error", `${label} failed`, { 
        duration, 
        context,
        error: error instanceof Error 
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: "Error", message: String(error) }
      });
      throw error;
    }
  }

  /**
   * Time a sync operation and log its duration
   */
  timeSync<T>(label: string, fn: () => T, context?: LogContext): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = Math.round(performance.now() - start);
      this.emit("info", label, { duration, context });
      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - start);
      this.emit("error", `${label} failed`, { 
        duration, 
        context,
        error: error instanceof Error 
          ? { name: error.name, message: error.message, stack: error.stack }
          : { name: "Error", message: String(error) }
      });
      throw error;
    }
  }

  // ---- User-Facing Output (Not logged to file) ----

  print(message: string): void {
    console.log(message);
  }

  success(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  }

  failure(message: string): void {
    console.log(chalk.red(`✗ ${message}`));
  }

  spinner(message: string): void {
    process.stdout.write(`\r${chalk.cyan("⠋")} ${message}`);
  }

  // ---- Configuration ----

  /**
   * Update logger options at runtime
   */
  configure(options: LoggerOptions): void {
    this.options = { ...this.options, ...options };
    if (options.logDir) {
      this.ensureLogDir();
    }
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.options.level;
  }

  /**
   * Get log directory path
   */
  getLogDir(): string {
    return this.options.logDir;
  }

  /**
   * List all log files
   */
  getLogFiles(): string[] {
    if (!existsSync(this.options.logDir)) return [];
    try {
      return readdirSync(this.options.logDir)
        .filter(f => f.endsWith(".log"))
        .map(f => join(this.options.logDir, f));
    } catch {
      return [];
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const log = new Logger();

// Export class for custom instances
export { Logger };
