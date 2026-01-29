/**
 * Telemetry - Opt-in anonymous usage analytics for Sharkbait
 * 
 * This module provides opt-in telemetry collection for understanding
 * usage patterns and improving the product. No PII, file contents,
 * or sensitive data is ever collected.
 * 
 * Enable with: SHARKBAIT_TELEMETRY=true
 */

import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from "fs";
import { randomUUID } from "crypto";

// ============================================================================
// Types
// ============================================================================

export interface TelemetryEvent {
  /** Event name (e.g., "agent.started", "tool.executed") */
  event: string;
  /** Event properties (no PII allowed) */
  properties?: Record<string, unknown>;
  /** Unix timestamp */
  timestamp: number;
  /** Session ID for grouping events */
  sessionId: string;
  /** Anonymous installation ID */
  installId: string;
}

export interface TelemetryConfig {
  /** Whether telemetry is enabled */
  enabled: boolean;
  /** Anonymous installation ID */
  installId: string;
  /** Endpoint for sending events (future use) */
  endpoint?: string;
}

export interface TelemetryStats {
  /** Total events collected */
  totalEvents: number;
  /** Events by type */
  eventCounts: Record<string, number>;
  /** Session count */
  sessionCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const TELEMETRY_DIR = join(homedir(), ".sharkbait", "telemetry");
const CONFIG_FILE = join(TELEMETRY_DIR, "config.json");
const EVENTS_FILE = join(TELEMETRY_DIR, "events.jsonl");
const MAX_EVENTS_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Events that are safe to collect (no PII)
const ALLOWED_EVENTS = [
  "session.started",
  "session.ended",
  "agent.started",
  "agent.completed",
  "agent.failed",
  "tool.executed",
  "tool.failed",
  "llm.request",
  "llm.response",
  "llm.error",
  "command.executed",
  "memory.saved",
  "memory.loaded",
  "error.occurred",
] as const;

type AllowedEvent = typeof ALLOWED_EVENTS[number];

// ============================================================================
// Telemetry Class
// ============================================================================

class Telemetry {
  private config: TelemetryConfig;
  private sessionId: string;
  private eventBuffer: TelemetryEvent[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.sessionId = randomUUID();
    this.config = this.loadConfig();
    
    // Start flush interval if enabled
    if (this.config.enabled) {
      this.startFlushInterval();
    }
  }

  private ensureDir(): void {
    if (!existsSync(TELEMETRY_DIR)) {
      try {
        mkdirSync(TELEMETRY_DIR, { recursive: true });
      } catch {
        // Silently fail
      }
    }
  }

  private loadConfig(): TelemetryConfig {
    // Check environment variable first
    const envEnabled = process.env["SHARKBAIT_TELEMETRY"] === "true";
    
    // Try to load existing config
    if (existsSync(CONFIG_FILE)) {
      try {
        const data = readFileSync(CONFIG_FILE, "utf-8");
        const config = JSON.parse(data) as TelemetryConfig;
        // Environment variable overrides stored config
        config.enabled = envEnabled;
        return config;
      } catch {
        // Fall through to create new config
      }
    }

    // Create new config
    const config: TelemetryConfig = {
      enabled: envEnabled,
      installId: randomUUID(),
    };

    this.saveConfig(config);
    return config;
  }

  private saveConfig(config: TelemetryConfig): void {
    this.ensureDir();
    try {
      writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
    } catch {
      // Silently fail
    }
  }

  private startFlushInterval(): void {
    // Flush events every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 30000);

    // Don't block process exit
    if (this.flushInterval.unref) {
      this.flushInterval.unref();
    }
  }

  private stopFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  /**
   * Track an event (only if telemetry is enabled)
   */
  track(event: AllowedEvent | string, properties?: Record<string, unknown>): void {
    if (!this.config.enabled) return;

    // Validate event name
    if (!ALLOWED_EVENTS.includes(event as AllowedEvent)) {
      // Allow custom events but prefix them
      event = `custom.${event}`;
    }

    // Sanitize properties - remove any potential PII
    const sanitizedProps = properties ? this.sanitizeProperties(properties) : undefined;

    const telemetryEvent: TelemetryEvent = {
      event,
      properties: sanitizedProps,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      installId: this.config.installId,
    };

    this.eventBuffer.push(telemetryEvent);

    // Auto-flush if buffer is large
    if (this.eventBuffer.length >= 100) {
      this.flush();
    }
  }

  /**
   * Sanitize properties to remove potential PII
   */
  private sanitizeProperties(props: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(props)) {
      // Skip properties that might contain PII
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("path") ||
        lowerKey.includes("file") ||
        lowerKey.includes("dir") ||
        lowerKey.includes("user") ||
        lowerKey.includes("name") ||
        lowerKey.includes("email") ||
        lowerKey.includes("token") ||
        lowerKey.includes("key") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("content") ||
        lowerKey.includes("message") ||
        lowerKey.includes("prompt") ||
        lowerKey.includes("response")
      ) {
        continue;
      }

      // Only allow primitive values
      if (typeof value === "string") {
        // Truncate long strings and remove potential paths
        const truncated = value.substring(0, 50);
        if (!truncated.includes("/") && !truncated.includes("\\")) {
          sanitized[key] = truncated;
        }
      } else if (typeof value === "number" || typeof value === "boolean") {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Flush buffered events to disk
   */
  flush(): void {
    if (this.eventBuffer.length === 0) return;

    this.ensureDir();

    try {
      // Check file size and rotate if needed
      if (existsSync(EVENTS_FILE)) {
        const stats = require("fs").statSync(EVENTS_FILE);
        if (stats.size >= MAX_EVENTS_FILE_SIZE) {
          // Simple rotation - just rename to backup
          const backupFile = EVENTS_FILE.replace(".jsonl", ".backup.jsonl");
          if (existsSync(backupFile)) {
            require("fs").unlinkSync(backupFile);
          }
          require("fs").renameSync(EVENTS_FILE, backupFile);
        }
      }

      // Append events to file
      const lines = this.eventBuffer.map(e => JSON.stringify(e)).join("\n") + "\n";
      appendFileSync(EVENTS_FILE, lines, "utf-8");
      this.eventBuffer = [];
    } catch {
      // Silently fail - telemetry should never break the app
    }
  }

  /**
   * Enable telemetry
   */
  enable(): void {
    this.config.enabled = true;
    this.saveConfig(this.config);
    this.startFlushInterval();
    this.track("session.started", { enabled: true });
  }

  /**
   * Disable telemetry
   */
  disable(): void {
    this.flush();
    this.stopFlushInterval();
    this.config.enabled = false;
    this.saveConfig(this.config);
    this.eventBuffer = [];
  }

  /**
   * Check if telemetry is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Get install ID
   */
  getInstallId(): string {
    return this.config.installId;
  }

  /**
   * Get telemetry statistics
   */
  getStats(): TelemetryStats {
    const stats: TelemetryStats = {
      totalEvents: 0,
      eventCounts: {},
      sessionCount: 0,
    };

    if (!existsSync(EVENTS_FILE)) return stats;

    try {
      const content = readFileSync(EVENTS_FILE, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      const sessions = new Set<string>();

      for (const line of lines) {
        try {
          const event = JSON.parse(line) as TelemetryEvent;
          stats.totalEvents++;
          stats.eventCounts[event.event] = (stats.eventCounts[event.event] || 0) + 1;
          sessions.add(event.sessionId);
        } catch {
          // Skip invalid lines
        }
      }

      stats.sessionCount = sessions.size;
    } catch {
      // Return empty stats on error
    }

    return stats;
  }

  /**
   * Clear all telemetry data
   */
  clearData(): void {
    this.eventBuffer = [];
    try {
      if (existsSync(EVENTS_FILE)) {
        require("fs").unlinkSync(EVENTS_FILE);
      }
      const backupFile = EVENTS_FILE.replace(".jsonl", ".backup.jsonl");
      if (existsSync(backupFile)) {
        require("fs").unlinkSync(backupFile);
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Shutdown telemetry (call before process exit)
   */
  shutdown(): void {
    this.flush();
    this.stopFlushInterval();
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export const telemetry = new Telemetry();

/**
 * Track a session start
 */
export function trackSessionStart(): void {
  telemetry.track("session.started");
}

/**
 * Track a session end
 */
export function trackSessionEnd(duration?: number): void {
  telemetry.track("session.ended", { duration });
}

/**
 * Track an agent execution
 */
export function trackAgent(agent: string, action: "started" | "completed" | "failed", properties?: Record<string, unknown>): void {
  telemetry.track(`agent.${action}`, { agent, ...properties });
}

/**
 * Track a tool execution
 */
export function trackTool(tool: string, success: boolean, duration?: number): void {
  telemetry.track(success ? "tool.executed" : "tool.failed", { tool, duration });
}

/**
 * Track an LLM call
 */
export function trackLLM(action: "request" | "response" | "error", properties?: Record<string, unknown>): void {
  telemetry.track(`llm.${action}`, properties);
}

/**
 * Track a command execution
 */
export function trackCommand(command: string): void {
  telemetry.track("command.executed", { command });
}

/**
 * Track an error
 */
export function trackError(errorType: string): void {
  telemetry.track("error.occurred", { errorType });
}

// Export class for testing
export { Telemetry };
