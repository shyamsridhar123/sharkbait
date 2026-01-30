/**
 * Agent Types - Type definitions for agent events and messages
 */

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; name: string; args?: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown; duration?: number }
  | { type: "tool_error"; name: string; error: string; duration?: number }
  | { type: "agent_start"; agent: string; mode?: string }
  | { type: "handoff"; from: string; to: string; reason?: string }
  | { type: "replan"; reason: string }
  | { type: "token_usage"; inputTokens: number; outputTokens: number; totalTokens: number }
  | { type: "error"; message: string }
  | { type: "done"; stats?: { duration?: number; toolsUsed?: string[] } };
