/**
 * Agents Module - Exports all agent components
 */

// Types
export type {
  AgentRole,
  PromptingMode,
  AgentConfig,
  AgentInvocation,
  AgentResult,
  AgentHandoff,
  IntentClassification,
  IntentPattern,
  AgentState,
  AgentStreamEvent,
  ParallelStrategy,
  ConsolidationStrategy,
  ParallelExecutionOptions,
  ParallelExecutionResult,
} from "./types";

// Base classes
export { BaseAgent } from "./base-agent";

// Primary Agents
export { OrchestratorAgent } from "./orchestrator";
export { CoderAgent } from "./coder";
export { ReviewerAgent } from "./reviewer";
export { PlannerAgent } from "./planner";
export { DebuggerAgent } from "./debugger";
export { ExplorerAgent } from "./explorer";

// Factory and utilities
export { AgentFactory } from "./factory";
export { ParallelExecutor, parallelReview } from "./parallel-executor";

// Workflows
export {
  BaseWorkflow,
  FeatureDevWorkflow,
  PRWorkflow,
  BugFixWorkflow,
  RefactorWorkflow,
  type WorkflowPhase,
  type WorkflowOptions,
  type WorkflowResult,
  type PhaseStatus,
  type PhaseResult,
  type PRWorkflowOptions,
  type BugFixOptions,
  type RefactorOptions,
} from "./workflows";

// Prompts
export { 
  getAgentPrompt, 
  getModePrompt,
  BASE_PROMPT,
  ORCHESTRATOR_PROMPT,
  CODER_PROMPT,
  REVIEWER_PROMPT,
  PLANNER_PROMPT,
  DEBUGGER_PROMPT,
  EXPLORER_PROMPT,
  MODE_PROMPTS,
} from "./prompts";
