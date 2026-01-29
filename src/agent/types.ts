/**
 * Agent Types - Type definitions for agent events and messages
 */

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "tool_error"; name: string; error: string }
  | { type: "replan"; reason: string }
  | { type: "error"; message: string }
  | { type: "done" };
