/**
 * Agent Types - Type definitions for the agent system
 */

import type { Message } from "../llm/types";
import type { ToolDefinition } from "../llm/types";

/**
 * Agent role classification
 */
export type AgentRole = 
  | "orchestrator"
  | "coder"
  | "reviewer"
  | "planner"
  | "debugger"
  | "explorer";

/**
 * Prompting modes for agents - specialized behavior without creating separate agents
 */
export type PromptingMode = 
  // Coder modes
  | "write"
  | "refactor"
  | "test"
  | "docs"
  // Reviewer modes
  | "bugs"
  | "security"
  | "style"
  | "performance"
  // Planner modes
  | "architecture"
  | "tasks"
  | "estimate"
  // Debugger modes
  | "trace"
  | "hypothesis"
  | "fix"
  // Explorer modes
  | "map"
  | "dependencies"
  | "patterns";

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: AgentRole;
  description: string;
  color: string;
  tools: string[];           // Tool names this agent can use ("*" for all)
  model?: string;            // Optional model override
  maxIterations?: number;    // Max loop iterations (default: 50)
  systemPrompt: string;      // Base system prompt
  modes?: PromptingMode[];   // Supported prompting modes
}

/**
 * Agent invocation options
 */
export interface AgentInvocation {
  agent: AgentRole;
  mode?: PromptingMode;
  input: string;
  context?: string[];        // File paths for additional context
  weight?: number;           // For parallel execution weighting
}

/**
 * Agent execution result
 */
export interface AgentResult {
  agent: AgentRole;
  mode?: PromptingMode;
  success: boolean;
  output: string;
  toolsCalled: string[];
  tokenCount: number;
  durationMs: number;
  error?: string;
}

/**
 * Handoff definition - for agent-to-agent delegation
 */
export interface AgentHandoff {
  label: string;             // User-visible label
  targetAgent: AgentRole;
  prompt: string;            // Prompt to send to target
  sendContext: boolean;      // Include current context
}

/**
 * Intent classification result
 */
export interface IntentClassification {
  primaryIntent: string;
  suggestedAgent: AgentRole;
  suggestedMode?: PromptingMode;
  confidence: number;        // 0-100
  reasoning: string;
}

/**
 * Intent patterns for routing
 */
export interface IntentPattern {
  patterns: RegExp[];
  agent: AgentRole;
  mode?: PromptingMode;
}

/**
 * Agent state for tracking execution
 */
export interface AgentState {
  currentAgent: AgentRole;
  mode?: PromptingMode;
  messageHistory: Message[];
  iteration: number;
  startTime: Date;
}

/**
 * Agent event types for streaming
 */
export type AgentStreamEvent =
  | { type: "agent_start"; agent: AgentRole; mode?: PromptingMode }
  | { type: "text"; content: string }
  | { type: "tool_start"; name: string }
  | { type: "tool_result"; name: string; result: unknown }
  | { type: "handoff"; from: AgentRole; to: AgentRole }
  | { type: "replan"; reason: string }
  | { type: "error"; message: string }
  | { type: "done"; result: AgentResult };

/**
 * Parallel execution strategy
 */
export type ParallelStrategy = "all" | "race" | "quorum";

/**
 * Consolidation strategy for parallel results
 */
export type ConsolidationStrategy = "merge" | "vote" | "best";

/**
 * Parallel execution options
 */
export interface ParallelExecutionOptions {
  agents: AgentInvocation[];
  strategy: ParallelStrategy;
  consolidation: ConsolidationStrategy;
  timeout?: number;          // Timeout in ms
  quorumThreshold?: number;  // For quorum strategy (0-1)
}

/**
 * Parallel execution result
 */
export interface ParallelExecutionResult {
  results: AgentResult[];
  consolidated: string;
  strategy: ParallelStrategy;
  durationMs: number;
  timedOut: boolean;
}
