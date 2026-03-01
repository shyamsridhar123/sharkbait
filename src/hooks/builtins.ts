/**
 * Built-in Hooks - Default hook implementations
 * Uses centralized security module — no duplicate pattern lists
 */

import type {
  PreToolUseContext,
  PreToolUseResult,
  PostToolUseContext,
  PostToolUseResult,
  StopContext,
  StopResult,
  OnErrorContext,
  OnErrorResult,
  OnTokenLimitContext,
  OnTokenLimitResult,
} from "./registry";
import { globalHooks } from "./registry";
import { classifyCommand, validatePath, validateUrl } from "../utils/security";
import { log } from "../utils/logger";

/**
 * Register safety hook for shell commands using centralized allowlist
 */
export function registerShellSafetyHook(): string {
  return globalHooks.register<PreToolUseContext, PreToolUseResult>(
    "PreToolUse",
    "shell-safety",
    async (context) => {
      if (context.toolName !== "run_command" && context.toolName !== "shell_execute") {
        return { proceed: true };
      }

      const command = String(context.args["command"] || "");
      const safety = classifyCommand(command);

      if (safety.status === "blocked") {
        log.warn(`Blocked dangerous command: ${command}`);
        return {
          proceed: false,
          reason: safety.reason,
        };
      }

      if (safety.status === "requires_confirmation") {
        log.warn(`Command requires confirmation: ${command} — ${safety.reason}`);
        return {
          proceed: false,
          reason: `${safety.reason} (reversibility: ${safety.reversibility})`,
        };
      }

      return { proceed: true };
    },
    10 // High priority
  );
}

/**
 * Register hook to block writes to sensitive files and warn on reads
 */
export function registerSensitiveFileHook(): string {
  return globalHooks.register<PreToolUseContext, PreToolUseResult>(
    "PreToolUse",
    "sensitive-file-guard",
    async (context) => {
      if (!["read_file", "write_file", "edit_file", "create_directory"].includes(context.toolName)) {
        return { proceed: true };
      }

      const filePath = String(context.args["path"] || context.args["filePath"] || "");
      if (!filePath) return { proceed: true };

      const isWrite = ["write_file", "edit_file", "create_directory"].includes(context.toolName);
      const safety = validatePath(filePath, process.cwd(), isWrite ? "write" : "read");

      if (safety.status === "blocked") {
        log.warn(`Blocked file access: ${filePath} — ${safety.reason}`);
        return {
          proceed: false,
          reason: safety.reason,
        };
      }

      if (safety.status === "sensitive") {
        log.warn(`Sensitive file access: ${filePath} — ${safety.reason}`);
        // Allow reads of sensitive files with logging, but the path sandboxing
        // already blocks writes via validatePath
      }

      return { proceed: true };
    },
    20
  );
}

/**
 * Register SSRF protection hook for fetch tools
 */
export function registerSsrfProtectionHook(): string {
  return globalHooks.register<PreToolUseContext, PreToolUseResult>(
    "PreToolUse",
    "ssrf-protection",
    async (context) => {
      if (!["fetch_webpage", "fetch_json"].includes(context.toolName)) {
        return { proceed: true };
      }

      const url = String(context.args["url"] || "");
      if (!url) return { proceed: true };

      const safety = validateUrl(url);
      if (safety.status === "blocked") {
        log.warn(`SSRF blocked: ${url} — ${safety.reason}`);
        return {
          proceed: false,
          reason: safety.reason,
        };
      }

      return { proceed: true };
    },
    15
  );
}

/**
 * Register tool result caching hook
 */
export function registerCachingHook(): string {
  const cache = new Map<string, { result: unknown; timestamp: number }>();
  const CACHE_TTL = 60000; // 1 minute

  return globalHooks.register<PostToolUseContext, PostToolUseResult>(
    "PostToolUse",
    "result-cache",
    async (context) => {
      if (!context.toolName.startsWith("read_") && context.toolName !== "list_directory") {
        return {};
      }

      if (!context.success) {
        return {};
      }

      const cacheKey = `${context.toolName}:${JSON.stringify(context.args)}`;
      cache.set(cacheKey, {
        result: context.result,
        timestamp: Date.now(),
      });

      // Cleanup old entries
      const now = Date.now();
      for (const [key, value] of cache) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }

      return { cache: true, cacheKey };
    },
    100
  );
}

/**
 * Register iteration limit stop hook
 */
export function registerIterationLimitHook(maxIterations: number = 50): string {
  return globalHooks.register<StopContext, StopResult>(
    "Stop",
    "iteration-limit",
    async (context) => {
      if (context.iterationCount >= maxIterations) {
        return {
          shouldStop: true,
          reason: `Reached maximum iteration limit (${maxIterations})`,
        };
      }
      return { shouldStop: false };
    },
    10
  );
}

/**
 * Register token limit stop hook
 */
export function registerTokenLimitHook(maxTokens: number = 100000): string {
  return globalHooks.register<StopContext, StopResult>(
    "Stop",
    "token-limit",
    async (context) => {
      if (context.tokenCount >= maxTokens) {
        return {
          shouldStop: true,
          reason: `Reached token limit (${context.tokenCount}/${maxTokens})`,
        };
      }
      return { shouldStop: false };
    },
    20
  );
}

/**
 * Register error retry hook for transient failures
 */
export function registerRetryHook(maxRetries: number = 3): string {
  const retryCounts = new Map<string, number>();

  return globalHooks.register<OnErrorContext, OnErrorResult>(
    "OnError",
    "retry-transient",
    async (context) => {
      if (!context.recoverable) {
        return { handled: false };
      }

      const errorType = context.error.name || "unknown";
      const key = `${context.toolName}:${errorType}`;
      const currentRetries = retryCounts.get(key) || 0;

      if (currentRetries < maxRetries) {
        retryCounts.set(key, currentRetries + 1);
        log.info(`Retrying after error (attempt ${currentRetries + 1}/${maxRetries})`);
        return { handled: true, retry: true };
      }

      retryCounts.delete(key);
      return { handled: false };
    },
    50
  );
}

/**
 * Register context compaction hook for token limits
 */
export function registerCompactionHook(): string {
  return globalHooks.register<OnTokenLimitContext, OnTokenLimitResult>(
    "OnTokenLimit",
    "context-compaction",
    async (context) => {
      const usage = context.currentTokens / context.maxTokens;

      if (usage > 0.9) {
        return {
          compact: true,
          summarize: true,
          dropOldest: Math.max(5, Math.floor(context.messageCount * 0.3)),
        };
      } else if (usage > 0.8) {
        return {
          compact: true,
          summarize: false,
          dropOldest: Math.max(3, Math.floor(context.messageCount * 0.1)),
        };
      }

      return { compact: false, summarize: false };
    },
    100
  );
}

/**
 * Register all built-in hooks
 */
export function registerBuiltinHooks(): void {
  registerShellSafetyHook();
  registerSensitiveFileHook();
  registerSsrfProtectionHook();
  registerIterationLimitHook();
  registerTokenLimitHook();
  registerRetryHook();
  registerCompactionHook();

  log.info("Registered built-in hooks (including SSRF protection)");
}
