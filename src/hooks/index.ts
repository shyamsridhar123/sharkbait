/**
 * Hooks Module - Lifecycle hooks for extensibility
 */

export {
  HookRegistry,
  globalHooks,
  type HookType,
  type HookHandler,
  type PreToolUseContext,
  type PreToolUseResult,
  type PostToolUseContext,
  type PostToolUseResult,
  type StopContext,
  type StopResult,
  type OnErrorContext,
  type OnErrorResult,
  type AgentSwitchContext,
  type OnTokenLimitContext,
  type OnTokenLimitResult,
  type OnUserInputContext,
  type OnUserInputResult,
  type SessionContext,
} from "./registry";

export {
  registerBuiltinHooks,
  registerShellSafetyHook,
  registerSensitiveFileHook,
  registerCachingHook,
  registerIterationLimitHook,
  registerTokenLimitHook,
  registerRetryHook,
  registerCompactionHook,
} from "./builtins";
