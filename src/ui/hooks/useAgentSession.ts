/**
 * useAgentSession - Custom hook extracting agent event handling from App.tsx
 *
 * Encapsulates:
 * - All 15+ state variables into a single useReducer (batched state transitions)
 * - Throttled streaming output via refs (prevents per-chunk re-renders)
 * - The event dispatch loop
 * - AbortController management
 * - Token estimation
 *
 * The App component becomes a thin renderer over this hook's state.
 */

import { useReducer, useRef, useCallback, useEffect } from "react";
import { Agent } from "../../agent/agent";
import { getWorkingDir, loadConfig } from "../../utils/config";
import type { ParallelAgentProgress } from "../../agent/types";
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
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "CLEAR_MESSAGES" }
  | { type: "SET_LOADING"; value: boolean }
  | { type: "SET_EXECUTING"; value: boolean }
  | { type: "SET_CURRENT_OUTPUT"; value: string }
  | { type: "FLUSH_STREAMING"; output: string; reasoning: string; tokenDelta: number; costDelta: number; toolCalls: TrackedToolCall[] | null }
  | { type: "HIDE_WELCOME" }
  | { type: "SHOW_WELCOME" }
  | { type: "SET_CURRENT_DIR"; value: string }
  | { type: "SET_PENDING_CONFIRM"; value: SessionState["pendingConfirm"] }
  | { type: "SET_BEADS_ENABLED"; value: boolean }
  | { type: "SET_CONTEXT_FILES"; value: string[] }
  | { type: "SET_CURRENT_AGENT"; value: string | null }
  | { type: "SET_PARALLEL_PROGRESS"; value: SessionState["parallelProgress"] }
  | { type: "SET_THINKING"; value: string | null }
  | { type: "SET_MODEL"; value: string }
  | { type: "SET_TOKEN_COUNT"; value: number }
  | { type: "ADD_TOKENS"; delta: number }
  | { type: "CANCEL_OPERATION" }
  | { type: "FINISH_RESPONSE"; content: string; toolCalls: TrackedToolCall[] };

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
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
    case "FLUSH_STREAMING": {
      const next = { ...state };
      next.currentOutput = action.output;
      next.currentReasoning = action.reasoning;
      if (action.tokenDelta > 0) {
        next.tokenCount = state.tokenCount + action.tokenDelta;
        next.sessionCost = state.sessionCost + action.costDelta;
      }
      if (action.toolCalls !== null) {
        next.activeToolCalls = action.toolCalls;
      }
      return next;
    }
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
    case "SET_CURRENT_AGENT":
      return { ...state, currentAgent: action.value };
    case "SET_PARALLEL_PROGRESS":
      return { ...state, parallelProgress: action.value };
    case "SET_THINKING":
      return { ...state, thinkingMessage: action.value };
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
        thinkingMessage: null,
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
        isLoading: false,
        isExecuting: false,
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

const RENDER_INTERVAL = 200; // ms between streaming UI updates

export function useAgentSession(options: UseAgentSessionOptions = {}) {
  const config = loadConfig();

  const [state, dispatch] = useReducer(sessionReducer, {
    messages: [],
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

  // ─── Throttled streaming refs ───────────────────────────────────────────
  const pendingOutputRef = useRef<string>("");
  const pendingReasoningRef = useRef<string>("");
  const pendingTokensRef = useRef<number>(0);
  const pendingCostRef = useRef<number>(0);
  const activeToolCallsRef = useRef<TrackedToolCall[]>([]);
  const toolCallsDirtyRef = useRef(false);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush all pending streaming state into one dispatch
  const flushRender = useCallback(() => {
    const tokens = pendingTokensRef.current;
    const cost = pendingCostRef.current;
    pendingTokensRef.current = 0;
    pendingCostRef.current = 0;
    const toolCallsSnapshot = toolCallsDirtyRef.current
      ? [...activeToolCallsRef.current]
      : null;
    toolCallsDirtyRef.current = false;
    renderTimerRef.current = null;

    dispatch({
      type: "FLUSH_STREAMING",
      output: pendingOutputRef.current,
      reasoning: pendingReasoningRef.current,
      tokenDelta: tokens,
      costDelta: cost,
      toolCalls: toolCallsSnapshot,
    });
  }, []);

  // Schedule a throttled render flush
  const scheduleRender = useCallback(() => {
    if (!renderTimerRef.current) {
      renderTimerRef.current = setTimeout(flushRender, RENDER_INTERVAL);
    }
  }, [flushRender]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, []);

  // Update tool calls via ref + schedule
  const updateToolCalls = useCallback((updater: (prev: TrackedToolCall[]) => TrackedToolCall[]) => {
    activeToolCallsRef.current = updater(activeToolCallsRef.current);
    toolCallsDirtyRef.current = true;
    scheduleRender();
  }, [scheduleRender]);

  /**
   * Process all agent events from a run — the extracted event dispatch loop
   * with throttled streaming to minimize re-renders
   */
  const processAgentEvents = useCallback(
    async (agent: Agent, userMessage: string) => {
      dispatch({ type: "ADD_TOKENS", delta: estimateTokens(userMessage) });
      dispatch({ type: "SET_LOADING", value: true });
      dispatch({ type: "SET_EXECUTING", value: true });
      dispatch({ type: "SET_CURRENT_OUTPUT", value: "" });

      // Reset throttle refs
      pendingOutputRef.current = "";
      pendingReasoningRef.current = "";
      pendingTokensRef.current = 0;
      pendingCostRef.current = 0;
      activeToolCallsRef.current = [];
      toolCallsDirtyRef.current = false;

      abortControllerRef.current = new AbortController();

      let assistantContent = "";
      const completedToolCalls: TrackedToolCall[] = [];

      try {
        for await (const event of agent.run(userMessage)) {
          if (abortControllerRef.current?.signal.aborted) break;

          switch (event.type) {
            case "reasoning":
              pendingReasoningRef.current += event.content;
              scheduleRender();
              break;

            case "text": {
              const tokens = estimateTokens(event.content);
              assistantContent += event.content;
              pendingOutputRef.current = assistantContent;
              pendingTokensRef.current += tokens;
              pendingCostRef.current += tokens * 0.00003;
              scheduleRender();
              break;
            }

            case "agent_start":
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
              dispatch({
                type: "ADD_MESSAGE",
                message: {
                  role: "system",
                  content: `Starting parallel execution (${event.strategy} strategy) with ${event.agents.length} agents...`,
                  timestamp: new Date(),
                },
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
              updateToolCalls(prev => [...prev, {
                id: `${event.name}-${Date.now()}`,
                name: event.name,
                displayName: toolInfo,
                status: "running" as const,
                startTime: Date.now(),
              }]);
              break;
            }

            case "tool_result": {
              const resultStr = typeof event.result === "string"
                ? event.result.slice(0, 100)
                : JSON.stringify(event.result).slice(0, 100);
              const duration = (event as any).duration;

              updateToolCalls(prev => {
                const updated = prev.map(tc =>
                  tc.name === event.name && tc.status === "running"
                    ? { ...tc, status: "success" as const, duration, result: resultStr }
                    : tc
                );
                const completed = updated.find(tc => tc.name === event.name && tc.status === "success");
                if (completed) {
                  completedToolCalls.push(completed);
                }
                return updated.filter(tc => !(tc.name === event.name && tc.status === "success"));
              });
              break;
            }

            case "tool_error": {
              const duration = (event as any).duration;
              updateToolCalls(prev => prev.map(tc =>
                tc.name === event.name && tc.status === "running"
                  ? { ...tc, status: "error" as const, duration, error: event.error }
                  : tc
              ));
              break;
            }

            case "token_usage":
              dispatch({ type: "SET_TOKEN_COUNT", value: event.totalTokens });
              break;

            case "done": {
              // Cancel pending throttled render and flush final state
              if (renderTimerRef.current) {
                clearTimeout(renderTimerRef.current);
                renderTimerRef.current = null;
              }
              // Flush any remaining pending tokens
              if (pendingTokensRef.current > 0) {
                dispatch({ type: "ADD_TOKENS", delta: pendingTokensRef.current });
                pendingTokensRef.current = 0;
              }
              // Clear refs
              pendingOutputRef.current = "";
              pendingReasoningRef.current = "";
              pendingCostRef.current = 0;
              activeToolCallsRef.current = [];
              toolCallsDirtyRef.current = false;

              dispatch({
                type: "FINISH_RESPONSE",
                content: assistantContent,
                toolCalls: completedToolCalls,
              });
              break;
            }

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
        dispatch({ type: "SET_LOADING", value: false });
        dispatch({ type: "SET_EXECUTING", value: false });
      }

      abortControllerRef.current = null;
    },
    [scheduleRender, updateToolCalls]
  );

  const cancelOperation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Cancel pending throttled render
    if (renderTimerRef.current) {
      clearTimeout(renderTimerRef.current);
      renderTimerRef.current = null;
    }
    pendingOutputRef.current = "";
    pendingReasoningRef.current = "";
    activeToolCallsRef.current = [];
    toolCallsDirtyRef.current = false;
    dispatch({ type: "CANCEL_OPERATION" });
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
