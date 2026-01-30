/**
 * Hooks System - Lifecycle hooks for extensibility
 * Implements: PreToolUse, PostToolUse, Stop, OnError, PreAgentSwitch, PostAgentSwitch, OnTokenLimit, OnUserInput
 */

import { log } from "../utils/logger";

/**
 * Hook types supported by the system
 */
export type HookType =
  | "PreToolUse"
  | "PostToolUse"
  | "Stop"
  | "OnError"
  | "PreAgentSwitch"
  | "PostAgentSwitch"
  | "OnTokenLimit"
  | "OnUserInput"
  | "SessionStart"
  | "SessionEnd";

/**
 * Context passed to PreToolUse hooks
 */
export interface PreToolUseContext {
  toolName: string;
  args: Record<string, unknown>;
  agentName: string;
}

/**
 * Result from PreToolUse hooks
 */
export interface PreToolUseResult {
  proceed: boolean;
  modifiedArgs?: Record<string, unknown>;
  reason?: string;
}

/**
 * Context passed to PostToolUse hooks
 */
export interface PostToolUseContext {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
}

/**
 * Result from PostToolUse hooks
 */
export interface PostToolUseResult {
  modifiedResult?: unknown;
  cache?: boolean;
  cacheKey?: string;
}

/**
 * Context passed to Stop hooks
 */
export interface StopContext {
  currentMessage: string;
  messageHistory: Array<{ role: string; content: string }>;
  tokenCount: number;
  iterationCount: number;
}

/**
 * Result from Stop hooks
 */
export interface StopResult {
  shouldStop: boolean;
  reason?: string;
}

/**
 * Context passed to OnError hooks
 */
export interface OnErrorContext {
  error: Error;
  toolName?: string;
  agentName?: string;
  recoverable: boolean;
}

/**
 * Result from OnError hooks
 */
export interface OnErrorResult {
  handled: boolean;
  retry?: boolean;
  fallbackResult?: unknown;
  message?: string;
}

/**
 * Context passed to agent switch hooks
 */
export interface AgentSwitchContext {
  fromAgent: string;
  toAgent: string;
  reason: string;
  context: Record<string, unknown>;
}

/**
 * Context passed to OnTokenLimit hooks
 */
export interface OnTokenLimitContext {
  currentTokens: number;
  maxTokens: number;
  messageCount: number;
}

/**
 * Result from OnTokenLimit hooks
 */
export interface OnTokenLimitResult {
  compact: boolean;
  summarize: boolean;
  dropOldest?: number;
}

/**
 * Context passed to OnUserInput hooks
 */
export interface OnUserInputContext {
  input: string;
  sessionId: string;
}

/**
 * Result from OnUserInput hooks
 */
export interface OnUserInputResult {
  modifiedInput?: string;
  skipProcessing?: boolean;
  reason?: string;
}

/**
 * Session context for session hooks
 */
export interface SessionContext {
  sessionId: string;
  startTime: Date;
  workingDir: string;
}

/**
 * Generic hook handler function type
 */
export type HookHandler<TContext, TResult> = (context: TContext) => Promise<TResult>;

/**
 * Hook registration entry
 */
interface HookEntry<TContext = unknown, TResult = unknown> {
  id: string;
  name: string;
  priority: number;
  handler: HookHandler<TContext, TResult>;
}

/**
 * Hook Registry - Manages all lifecycle hooks
 */
export class HookRegistry {
  private hooks: Map<HookType, HookEntry[]> = new Map();
  private hookCounter = 0;

  constructor() {
    // Initialize empty arrays for all hook types
    const hookTypes: HookType[] = [
      "PreToolUse",
      "PostToolUse",
      "Stop",
      "OnError",
      "PreAgentSwitch",
      "PostAgentSwitch",
      "OnTokenLimit",
      "OnUserInput",
      "SessionStart",
      "SessionEnd",
    ];

    for (const type of hookTypes) {
      this.hooks.set(type, []);
    }
  }

  /**
   * Register a hook handler
   */
  register<TContext, TResult>(
    type: HookType,
    name: string,
    handler: HookHandler<TContext, TResult>,
    priority: number = 100
  ): string {
    const id = `hook_${++this.hookCounter}`;
    const hooks = this.hooks.get(type) || [];
    
    hooks.push({
      id,
      name,
      priority,
      handler: handler as HookHandler<unknown, unknown>,
    });

    // Sort by priority (lower = earlier)
    hooks.sort((a, b) => a.priority - b.priority);
    this.hooks.set(type, hooks);

    log.debug(`Registered hook: ${type}/${name} (priority: ${priority})`);
    return id;
  }

  /**
   * Unregister a hook by ID
   */
  unregister(id: string): boolean {
    for (const [type, hooks] of this.hooks) {
      const index = hooks.findIndex(h => h.id === id);
      if (index !== -1) {
        hooks.splice(index, 1);
        log.debug(`Unregistered hook: ${id}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Execute PreToolUse hooks
   */
  async executePreToolUse(context: PreToolUseContext): Promise<PreToolUseResult> {
    const hooks = this.hooks.get("PreToolUse") || [];
    let currentArgs = { ...context.args };

    for (const hook of hooks) {
      try {
        const result = await hook.handler({ ...context, args: currentArgs }) as PreToolUseResult;
        
        if (!result.proceed) {
          log.info(`PreToolUse hook '${hook.name}' blocked tool: ${result.reason}`);
          return result;
        }

        if (result.modifiedArgs) {
          currentArgs = result.modifiedArgs;
        }
      } catch (error) {
        log.error(`PreToolUse hook '${hook.name}' failed: ${error}`);
        // Continue with other hooks
      }
    }

    return { proceed: true, modifiedArgs: currentArgs };
  }

  /**
   * Execute PostToolUse hooks
   */
  async executePostToolUse(context: PostToolUseContext): Promise<PostToolUseResult> {
    const hooks = this.hooks.get("PostToolUse") || [];
    let currentResult = context.result;

    for (const hook of hooks) {
      try {
        const result = await hook.handler({ ...context, result: currentResult }) as PostToolUseResult;
        
        if (result.modifiedResult !== undefined) {
          currentResult = result.modifiedResult;
        }
      } catch (error) {
        log.error(`PostToolUse hook '${hook.name}' failed: ${error}`);
      }
    }

    return { modifiedResult: currentResult };
  }

  /**
   * Execute Stop hooks - returns true if any hook says to stop
   */
  async executeStop(context: StopContext): Promise<StopResult> {
    const hooks = this.hooks.get("Stop") || [];

    for (const hook of hooks) {
      try {
        const result = await hook.handler(context) as StopResult;
        
        if (result.shouldStop) {
          log.info(`Stop hook '${hook.name}' triggered: ${result.reason}`);
          return result;
        }
      } catch (error) {
        log.error(`Stop hook '${hook.name}' failed: ${error}`);
      }
    }

    return { shouldStop: false };
  }

  /**
   * Execute OnError hooks
   */
  async executeOnError(context: OnErrorContext): Promise<OnErrorResult> {
    const hooks = this.hooks.get("OnError") || [];

    for (const hook of hooks) {
      try {
        const result = await hook.handler(context) as OnErrorResult;
        
        if (result.handled) {
          log.info(`OnError hook '${hook.name}' handled error`);
          return result;
        }
      } catch (error) {
        log.error(`OnError hook '${hook.name}' failed: ${error}`);
      }
    }

    return { handled: false };
  }

  /**
   * Execute PreAgentSwitch hooks
   */
  async executePreAgentSwitch(context: AgentSwitchContext): Promise<void> {
    const hooks = this.hooks.get("PreAgentSwitch") || [];

    for (const hook of hooks) {
      try {
        await hook.handler(context);
      } catch (error) {
        log.error(`PreAgentSwitch hook '${hook.name}' failed: ${error}`);
      }
    }
  }

  /**
   * Execute PostAgentSwitch hooks
   */
  async executePostAgentSwitch(context: AgentSwitchContext): Promise<void> {
    const hooks = this.hooks.get("PostAgentSwitch") || [];

    for (const hook of hooks) {
      try {
        await hook.handler(context);
      } catch (error) {
        log.error(`PostAgentSwitch hook '${hook.name}' failed: ${error}`);
      }
    }
  }

  /**
   * Execute OnTokenLimit hooks
   */
  async executeOnTokenLimit(context: OnTokenLimitContext): Promise<OnTokenLimitResult> {
    const hooks = this.hooks.get("OnTokenLimit") || [];

    for (const hook of hooks) {
      try {
        const result = await hook.handler(context) as OnTokenLimitResult;
        return result;
      } catch (error) {
        log.error(`OnTokenLimit hook '${hook.name}' failed: ${error}`);
      }
    }

    // Default behavior
    return { compact: true, summarize: false };
  }

  /**
   * Execute OnUserInput hooks
   */
  async executeOnUserInput(context: OnUserInputContext): Promise<OnUserInputResult> {
    const hooks = this.hooks.get("OnUserInput") || [];
    let currentInput = context.input;

    for (const hook of hooks) {
      try {
        const result = await hook.handler({ ...context, input: currentInput }) as OnUserInputResult;
        
        if (result.skipProcessing) {
          return result;
        }

        if (result.modifiedInput) {
          currentInput = result.modifiedInput;
        }
      } catch (error) {
        log.error(`OnUserInput hook '${hook.name}' failed: ${error}`);
      }
    }

    return { modifiedInput: currentInput };
  }

  /**
   * Execute SessionStart hooks
   */
  async executeSessionStart(context: SessionContext): Promise<void> {
    const hooks = this.hooks.get("SessionStart") || [];

    for (const hook of hooks) {
      try {
        await hook.handler(context);
      } catch (error) {
        log.error(`SessionStart hook '${hook.name}' failed: ${error}`);
      }
    }
  }

  /**
   * Execute SessionEnd hooks
   */
  async executeSessionEnd(context: SessionContext): Promise<void> {
    const hooks = this.hooks.get("SessionEnd") || [];

    for (const hook of hooks) {
      try {
        await hook.handler(context);
      } catch (error) {
        log.error(`SessionEnd hook '${hook.name}' failed: ${error}`);
      }
    }
  }

  /**
   * Get count of registered hooks by type
   */
  getHookCount(type: HookType): number {
    return this.hooks.get(type)?.length || 0;
  }

  /**
   * Get all registered hook names by type
   */
  getHookNames(type: HookType): string[] {
    return (this.hooks.get(type) || []).map(h => h.name);
  }

  /**
   * Clear all hooks of a specific type
   */
  clearHooks(type: HookType): void {
    this.hooks.set(type, []);
    log.debug(`Cleared all ${type} hooks`);
  }

  /**
   * Clear all hooks
   */
  clearAllHooks(): void {
    for (const type of this.hooks.keys()) {
      this.hooks.set(type, []);
    }
    log.debug("Cleared all hooks");
  }
}

/**
 * Global hook registry instance
 */
export const globalHooks = new HookRegistry();
