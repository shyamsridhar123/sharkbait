/**
 * useAgentSession - Custom hook extracting agent event handling from App.tsx
 *
 * Encapsulates:
 * - All 15+ state variables into a single useReducer
 * - The 160-line event dispatch loop
 * - AbortController management
 * - Token estimation
 *
 * The App component becomes a thin renderer over this hook's state.
 */

import { useReducer, useRef, useCallback } from "react";
import { Agent } from "../../agent/agent";
import { getWorkingDir, loadConfig } from "../../utils/config";
import type { AgentEvent, ParallelAgentProgress } from "../../agent/types";
import { basename } from "path";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TrackedToolCall {
  id: string;
  name: string;
  displayName: string;
  status: "running" | "success" | "error";
  startTime: number;
  duration?: number;
  result?: string;
  error?: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  toolCalls?: TrackedToolCall[];
}

interface SessionState {
  messages: Message[];
  input: string;
  isLoading: boolean;
  currentOutput: string;
  showWelcome: boolean;
  tokenCount: number;
  sessionCost: number;
  currentDir: string;
  pendingConfirm: { type: string; data: any } | null;
  beadsEnabled: boolean;
  contextFiles: string[];
  activeToolCalls: TrackedToolCall[];
  currentAgent: string | null;
  isExecuting: boolean;
  parallelProgress: {
    agents: ParallelAgentProgress[];
    strategy: "all" | "race" | "quorum";
  } | null;
  thinkingMessage: string | null;
  currentReasoning: string;
  currentModel: string;
}

// ─── Reducer ───────────────────────────────────────────────────────────────────

type SessionAction =
  | { type: "SET_INPUT"; value: string }
  | { type: "BACKSPACE" }
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "CLEAR_MESSAGES" }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_EXECUTING"; value: boolean }
  | { type: "SET_CURRENT_OUTPUT"; value: string }
  | { type: "APPEND_OUTPUT"; content: string; tokenDelta: number; costDelta: number }
  | { type: "HIDE_WELCOME" }
  | { type: "SHOW_WELCOME" }
  | { type: "SET_CURRENT_DIR"; value: string }
  | { type: "SET_PENDING_CONFIRM"; value: SessionState["pendingConfirm"] }
  | { type: "SET_BEADS_ENABLED"; value: boolean }
  | { type: "SET_CONTEXT_FILES"; value: string[] }
  | { type: "ADD_TOOL_CALL"; tool: TrackedToolCall }
  | { type: "UPDATE_TOOL_CALL"; name: string; update: Partial<TrackedToolCall> }
  | { type: "COMPLETE_TOOL_CALL"; name: string }
  | { type: "CLEAR_TOOL_CALLS" }
  | { type: "SET_CURRENT_AGENT"; value: string | null }
  | { type: "SET_PARALLEL_PROGRESS"; value: SessionState["parallelProgress"] }
  | { type: "SET_THINKING"; value: string | null }
  | { type: "APPEND_REASONING"; content: string }
  | { type: "SET_MODEL"; value: string }
  | { type: "SET_TOKEN_COUNT"; value: number }
  | { type: "ADD_TOKENS"; delta: number }
  | { type: "CANCEL_OPERATION" }
  | { type: "FINISH_RESPONSE"; content: string; toolCalls: TrackedToolCall[] };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.value };
    case "BACKSPACE":
      return { ...state, input: state.input.slice(0, -1) };
    case "ADD_MESSAGE":
      return { ...state, messages: [...state.messages, action.message] };
    case "CLEAR_MESSAGES":
      return { ...state, messages: [] };
    case "SET_LOADING":
      return { ...state, isLoading: action.value };
    case "SET_EXECUTING":
      return { ...state, isExecuting: action.value };
    case "SET_CURRENT_OUTPUT":
      return { ...state, currentOutput: action.value };
    case "APPEND_OUTPUT":
      return {
        ...state,
        currentOutput: state.currentOutput + action.content,
        tokenCount: state.tokenCount + action.tokenDelta,
        sessionCost: state.sessionCost + action.costDelta,
      };
    case "HIDE_WELCOME":
      return { ...state, showWelcome: false };
    case "SHOW_WELCOME":
      return { ...state, showWelcome: true };
    case "SET_CURRENT_DIR":
      return { ...state, currentDir: action.value };
    case "SET_PENDING_CONFIRM":
      return { ...state, pendingConfirm: action.value };
    case "SET_BEADS_ENABLED":
      return { ...state, beadsEnabled: action.value };
    case "SET_CONTEXT_FILES":
      return { ...state, contextFiles: action.value };
    case "ADD_TOOL_CALL":
      return { ...state, activeToolCalls: [...state.activeToolCalls, action.tool] };
    case "UPDATE_TOOL_CALL":
      return {
        ...state,
        activeToolCalls: state.activeToolCalls.map((tc) =>
          tc.name === action.name && tc.status === "running"
            ? { ...tc, ...action.update }
            : tc
        ),
      };
    case "COMPLETE_TOOL_CALL":
      return {
        ...state,
        activeToolCalls: state.activeToolCalls.filter(
          (tc) => !(tc.name === action.name && tc.status === "success")
        ),
      };
    case "CLEAR_TOOL_CALLS":
      return { ...state, activeToolCalls: [] };
    case "SET_CURRENT_AGENT":
      return { ...state, currentAgent: action.value };
    case "SET_PARALLEL_PROGRESS":
      return { ...state, parallelProgress: action.value };
    case "SET_THINKING":
      return { ...state, thinkingMessage: action.value };
    case "APPEND_REASONING":
      return { ...state, currentReasoning: state.currentReasoning + action.content };
    case "SET_MODEL":
      return { ...state, currentModel: action.value };
    case "SET_TOKEN_COUNT":
      return { ...state, tokenCount: action.value };
    case "ADD_TOKENS":
      return { ...state, tokenCount: state.tokenCount + action.delta };
    case "CANCEL_OPERATION":
      return {
        ...state,
        isLoading: false,
        isExecuting: false,
        currentOutput: "",
        currentReasoning: "",
        activeToolCalls: [],
        messages: [
          ...state.messages,
          { role: "system", content: "Operation cancelled", timestamp: new Date() },
        ],
      };
    case "FINISH_RESPONSE":
      return {
        ...state,
        currentOutput: "",
        currentReasoning: "",
        activeToolCalls: [],
        currentAgent: null,
        thinkingMessage: null,
        parallelProgress: null,
        messages: action.content.trim()
          ? [
              ...state.messages,
              {
                role: "assistant" as const,
                content: action.content.trim(),
                timestamp: new Date(),
                toolCalls: action.toolCalls.length > 0 ? action.toolCalls : undefined,
              },
            ]
          : state.messages,
      };
    default:
      return state;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatToolInfo(name: string, args?: Record<string, unknown>): string {
  if (!args) return name;

  const path = args["path"] || args["filePath"] || args["file"];
  const command = args["command"];
  const taskName = args["name"] || args["task"];

  if (path && typeof path === "string") return `${name} → ${basename(path)}`;
  if (command && typeof command === "string") {
    const short = command.length > 40 ? command.slice(0, 37) + "..." : command;
    return `${name} → ${short}`;
  }
  if (taskName && typeof taskName === "string") return `${name} → "${taskName}"`;

  return name;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface UseAgentSessionOptions {
  contextFiles?: string[];
  enableBeads?: boolean;
  workingDir?: string;
}

export function useAgentSession(options: UseAgentSessionOptions = {}) {
  const config = loadConfig();

  const [state, dispatch] = useReducer(sessionReducer, {
    messages: [],
    input: "",
    isLoading: false,
    currentOutput: "",
    showWelcome: true,
    tokenCount: 0,
    sessionCost: 0,
    currentDir: getWorkingDir(options.workingDir),
    pendingConfirm: null,
    beadsEnabled: options.enableBeads ?? true,
    contextFiles: options.contextFiles || [],
    activeToolCalls: [],
    currentAgent: null,
    isExecuting: false,
    parallelProgress: null,
    thinkingMessage: null,
    currentReasoning: "",
    currentModel: config.azure.deployment,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Process all agent events from a run — the extracted event dispatch loop
   */
  const processAgentEvents = useCallback(
    async (agent: Agent, userMessage: string) => {
      dispatch({ type: "ADD_TOKENS", delta: estimateTokens(userMessage) });

      abortControllerRef.current = new AbortController();

      let assistantContent = "";
      const completedToolCalls: TrackedToolCall[] = [];

      try {
        for await (const event of agent.run(userMessage)) {
          if (abortControllerRef.current?.signal.aborted) break;

          switch (event.type) {
            case "reasoning":
              dispatch({ type: "APPEND_REASONING", content: event.content });
              break;

            case "text": {
              const tokens = estimateTokens(event.content);
              assistantContent += event.content;
              dispatch({
                type: "APPEND_OUTPUT",
                content: event.content,
                tokenDelta: tokens,
                costDelta: tokens * 0.00003,
              });
              break;
            }

            case "agent_start":
            case "agent_switch":
              dispatch({ type: "SET_CURRENT_AGENT", value: event.agent });
              dispatch({
                type: "ADD_MESSAGE",
                message: {
                  role: "system",
                  content: `${event.agent} agent starting${"mode" in event && event.mode ? ` (${event.mode} mode)` : ""}...`,
                  timestamp: new Date(),
                },
              });
              break;

            case "handoff":
              dispatch({
                type: "ADD_MESSAGE",
                message: {
                  role: "system",
                  content: `Delegating to ${event.to}...`,
                  timestamp: new Date(),
                },
              });
              break;

            case "replan":
              dispatch({
                type: "ADD_MESSAGE",
                message: {
                  role: "system",
                  content: `Re-planning: ${event.reason}`,
                  timestamp: new Date(),
                },
              });
              break;

            case "thinking":
              dispatch({ type: "SET_THINKING", value: event.message || `${event.agent} is thinking...` });
              break;

            case "parallel_start":
              dispatch({
                type: "SET_PARALLEL_PROGRESS",
                value: { agents: event.agents, strategy: event.strategy },
              });
              break;

            case "parallel_progress":
              dispatch({
                type: "SET_PARALLEL_PROGRESS",
                value: { agents: event.agents, strategy: "all" },
              });
              break;

            case "parallel_complete":
              dispatch({ type: "SET_PARALLEL_PROGRESS", value: null });
              dispatch({
                type: "ADD_MESSAGE",
                message: {
                  role: "system",
                  content: `Parallel execution complete:\n${event.consolidated}`,
                  timestamp: new Date(),
                },
              });
              break;

            case "tool_start": {
              const toolInfo = formatToolInfo(event.name, event.args);
              dispatch({
                type: "ADD_TOOL_CALL",
                tool: {
                  id: `${event.name}-${Date.now()}`,
                  name: event.name,
                  displayName: toolInfo,
                  status: "running",
                  startTime: Date.now(),
                },
              });
              break;
            }

            case "tool_result": {
              const resultStr = typeof event.result === "string"
                ? event.result.slice(0, 100)
                : JSON.stringify(event.result).slice(0, 100);

              dispatch({
                type: "UPDATE_TOOL_CALL",
                name: event.name,
                update: {
                  status: "success",
                  duration: (event as any).duration,
                  result: resultStr,
                },
              });

              // Move from active to completed
              completedToolCalls.push({
                id: `${event.name}-done`,
                name: event.name,
                displayName: event.name,
                status: "success",
                startTime: Date.now(),
                result: resultStr,
              });
              dispatch({ type: "COMPLETE_TOOL_CALL", name: event.name });
              break;
            }

            case "tool_error":
              dispatch({
                type: "UPDATE_TOOL_CALL",
                name: event.name,
                update: {
                  status: "error",
                  duration: (event as any).duration,
                  error: event.error,
                },
              });
              break;

            case "token_usage":
              dispatch({ type: "SET_TOKEN_COUNT", value: event.totalTokens });
              break;

            case "done":
              dispatch({
                type: "FINISH_RESPONSE",
                content: assistantContent,
                toolCalls: completedToolCalls,
              });
              break;

            case "error":
              dispatch({
                type: "ADD_MESSAGE",
                message: {
                  role: "system",
                  content: `Error: ${event.message}`,
                  timestamp: new Date(),
                },
              });
              break;

            case "workflow_start":
            case "workflow_complete":
              // Handled by the text/done events
              break;
          }
        }
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          const message = error instanceof Error ? error.message : "Unknown error";
          dispatch({
            type: "ADD_MESSAGE",
            message: { role: "system", content: `Error: ${message}`, timestamp: new Date() },
          });
        }
      }

      dispatch({ type: "SET_LOADING", value: false });
      dispatch({ type: "SET_EXECUTING", value: false });
      abortControllerRef.current = null;
    },
    []
  );

  const cancelOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      dispatch({ type: "CANCEL_OPERATION" });
    }
  }, []);

  return {
    state,
    dispatch,
    processAgentEvents,
    cancelOperation,
    abortControllerRef,
  };
}

export type { Message, TrackedToolCall, SessionState, SessionAction };
