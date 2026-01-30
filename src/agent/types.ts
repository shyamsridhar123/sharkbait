/**
 * Agent Types - Type definitions for agent events and messages
 */

/**
 * Parallel execution agent progress
 */
export interface ParallelAgentProgress {
  name: string;
  mode?: string;
  status: "pending" | "running" | "complete" | "error";
  progress?: number;  // 0-100
  duration?: number;  // ms
  error?: string;
}

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; name: string; args?: Record<string, unknown> }
  | { type: "tool_result"; name: string; result: unknown; duration?: number }
  | { type: "tool_error"; name: string; error: string; duration?: number }
  | { type: "agent_start"; agent: string; mode?: string }
  | { type: "handoff"; from: string; to: string; reason?: string }
  | { type: "replan"; reason: string }
  | { type: "thinking"; agent: string; message?: string }
  | { type: "token_usage"; inputTokens: number; outputTokens: number; totalTokens: number }
  | { type: "parallel_start"; agents: ParallelAgentProgress[]; strategy: "all" | "race" | "quorum" }
  | { type: "parallel_progress"; agents: ParallelAgentProgress[] }
  | { type: "parallel_complete"; results: ParallelAgentProgress[]; consolidated: string }
  | { type: "error"; message: string }
  | { type: "done"; stats?: { duration?: number; toolsUsed?: string[] } };
