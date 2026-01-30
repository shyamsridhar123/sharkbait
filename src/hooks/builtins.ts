/**
 * Built-in Hooks - Default hook implementations
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
import { log } from "../utils/logger";

/**
 * Dangerous command patterns for shell execution
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+[\/~]/i,           // rm -rf with root or home
  /rm\s+-rf\s+\*/,               // rm -rf *
  />\s*\/dev\/sd[a-z]/i,         // Write to disk devices
  /mkfs\./i,                     // Format filesystem
  /dd\s+if=.*of=\/dev/i,         // dd to device
  /chmod\s+-R\s+777/i,           // Dangerous permissions
  /:\(\)\{\s*:\|:\s*&\s*\}/,     // Fork bomb
];

/**
 * Sensitive file patterns
 */
const SENSITIVE_FILES = [
  /\.env$/i,
  /\.env\.(local|prod|production)/i,
  /\.ssh\//i,
  /id_rsa/i,
  /\.aws\/credentials/i,
  /\.npmrc$/i,
  /passwords?\.(txt|json|yaml)/i,
  /secrets?\.(txt|json|yaml)/i,
];

/**
 * Register safety hook for dangerous shell commands
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

      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(command)) {
          log.warn(`Blocked dangerous command: ${command}`);
          return {
            proceed: false,
            reason: `Blocked potentially dangerous command matching pattern: ${pattern.source}`,
          };
        }
      }

      return { proceed: true };
    },
    10 // High priority
  );
}

/**
 * Register hook to warn about sensitive file access
 */
export function registerSensitiveFileHook(): string {
  return globalHooks.register<PreToolUseContext, PreToolUseResult>(
    "PreToolUse",
    "sensitive-file-warning",
    async (context) => {
      if (!["read_file", "write_file", "edit_file"].includes(context.toolName)) {
        return { proceed: true };
      }

      const filePath = String(context.args["path"] || context.args["filePath"] || "");

      for (const pattern of SENSITIVE_FILES) {
        if (pattern.test(filePath)) {
          log.warn(`Accessing sensitive file: ${filePath}`);
          // Allow but log - could be changed to block
          return { proceed: true };
        }
      }

      return { proceed: true };
    },
    20
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
      // Only cache read operations
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
        // Critical - aggressive compaction
        return {
          compact: true,
          summarize: true,
          dropOldest: Math.max(5, Math.floor(context.messageCount * 0.3)),
        };
      } else if (usage > 0.8) {
        // Warning - moderate compaction
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
  registerIterationLimitHook();
  registerTokenLimitHook();
  registerRetryHook();
  registerCompactionHook();
  
  log.info("Registered built-in hooks");
}
