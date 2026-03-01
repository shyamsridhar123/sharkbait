/**
 * Agent Loop - The agentic loop implementation with stall detection
 * Inspired by Microsoft Research Magentic-One and Anthropic's "Building Effective Agents"
 *
 * Changes from original:
 * - Uses shared accumulateToolCalls from stream-utils (eliminated duplication)
 * - Parallel tool execution via Promise.allSettled
 * - Bounded messages array to prevent OOM
 * - Hooks wired automatically via ToolRegistry.execute()
 * - Uses getErrorMessage utility
 */

import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import { ContextManager } from "./context";
import { ProgressTracker, type TaskLedger, type ProgressLedger } from "./progress";
import type { Message, ToolCall } from "../llm/types";
import { accumulateToolCalls } from "../llm/stream-utils";
import type { AgentEvent } from "./types";
import { log } from "../utils/logger";
import { getErrorMessage } from "../utils/security";

const STALL_THRESHOLD = 3;
const MAX_REPLANS = 2;
const MAX_ITERATIONS = 50;
const MAX_MESSAGES = 200;
const BEADS_FAIL_LIMIT = 2;  // After 2 beads write failures, inject "stop trying beads"

// Only write operations count toward the circuit breaker — reads should always be attempted
const BEADS_WRITE_TOOLS = new Set([
  "beads_init", "beads_create", "beads_done", "beads_add_dependency",
]);
const BEADS_TOOL_NAMES = new Set([
  "beads_status", "beads_init", "beads_create", "beads_ready",
  "beads_show", "beads_done", "beads_list", "beads_add_dependency",
]);

export class AgentLoop {
  private llm: AzureOpenAIClient;
  private tools: ToolRegistry;
  private messages: Message[] = [];
  private systemPrompt: string;
  private contextManager: ContextManager;
  private progressTracker: ProgressTracker;

  constructor(llm: AzureOpenAIClient, tools: ToolRegistry) {
    this.llm = llm;
    this.tools = tools;
    this.systemPrompt = this.buildSystemPrompt();
    this.contextManager = new ContextManager({
      maxTokens: 128000,
      reservedForResponse: 16000,
      compactionThreshold: 0.85,
    });
    this.progressTracker = new ProgressTracker();
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    this.messages.push({ role: "user", content: userMessage });
    this.boundMessages();

    const taskLedger: TaskLedger = {
      taskId: crypto.randomUUID(),
      objective: userMessage,
      facts: [],
      assumptions: [],
      plan: [],
      createdAt: new Date(),
      lastReplanAt: new Date(),
      replanCount: 0,
    };

    const progressLedger: ProgressLedger = {
      currentStep: 0,
      stepHistory: [],
      stallCount: 0,
      lastProgressAt: new Date(),
      agentAssignments: new Map(),
    };

    let iteration = 0;
    let summaryRequested = false;
    let beadsFailCount = 0;
    let beadsAbandoned = false;

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      log.debug(`Agent loop iteration ${iteration}`);

      const progressCheck = this.progressTracker.checkProgress(progressLedger, taskLedger);

      if (progressCheck.type === "complete") {
        yield { type: "done" };
        return;
      }

      if (progressCheck.type === "escalate") {
        yield { type: "error", message: progressCheck.reason ?? "Task escalated" };
        return;
      }

      if (progressCheck.type === "replan") {
        yield { type: "replan", reason: progressCheck.reason ?? "Re-planning required" };
        taskLedger.replanCount++;
        taskLedger.lastReplanAt = new Date();
        this.messages.push({
          role: "system",
          content: `[Re-planning triggered: ${progressCheck.reason}]\nRevise your approach based on what we've learned.`,
        });
      }

      const contextMessages = await this.contextManager.checkAndCompact(
        {
          systemPrompt: this.systemPrompt,
          taskLedger,
          recentMessages: this.messages.slice(-10),
          activeFiles: [],
          errorContext: [],
        },
        {
          olderMessages: this.messages.slice(0, -10),
          toolResults: [],
          explorationFindings: [],
        }
      );

      let fullContent = "";
      let toolCalls: ToolCall[] = [];

      try {
        for await (const chunk of this.llm.chat(
          [{ role: "system", content: this.systemPrompt }, ...contextMessages],
          this.tools.getDefinitions()
        )) {
          if (chunk.reasoning) {
            yield { type: "reasoning", content: chunk.reasoning };
          }
          if (chunk.content) {
            fullContent += chunk.content;
            yield { type: "text", content: chunk.content };
          }
          if (chunk.toolCalls) {
            toolCalls = accumulateToolCalls(toolCalls, chunk.toolCalls);
          }
        }
      } catch (error) {
        yield { type: "error", message: getErrorMessage(error) };
        return;
      }

      if (toolCalls.length === 0) {
        if (!fullContent.trim() && progressLedger.stepHistory.length > 0 && !summaryRequested) {
          summaryRequested = true;
          this.messages.push({
            role: "user",
            content: "What did you just do? Please summarize.",
          });
          continue;
        }

        if (!fullContent.trim() && progressLedger.stepHistory.length > 0) {
          const toolNames = [...new Set(progressLedger.stepHistory.map((s) => s.action))].join(", ");
          fullContent = `Task completed! I used: ${toolNames}`;
        }

        this.messages.push({ role: "assistant", content: fullContent });
        yield { type: "done" };
        return;
      }

      // Execute tool calls in PARALLEL using Promise.allSettled
      this.messages.push({
        role: "assistant",
        content: fullContent,
        tool_calls: toolCalls,
      });

      const toolResults = await Promise.allSettled(
        toolCalls.map(async (call) => {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(call.function.arguments);
          } catch (parseErr) {
            throw new Error(`Invalid tool arguments for ${call.function.name}: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`);
          }
          return {
            call,
            args,
            result: await this.tools.execute(call.function.name, args),
          };
        })
      );

      for (let i = 0; i < toolResults.length; i++) {
        const call = toolCalls[i]!;
        const settled = toolResults[i]!;

        if (settled.status === "fulfilled") {
          const { args, result } = settled.value;
          yield { type: "tool_start", name: call.function.name, args };
          yield { type: "tool_result", name: call.function.name, result };

          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });

          // Track beads failures from tool results that return proceedWithoutBeads
          if (BEADS_TOOL_NAMES.has(call.function.name)) {
            const resultObj = result as Record<string, unknown> | undefined;
            if (resultObj && (resultObj["proceedWithoutBeads"] || resultObj["success"] === false)) {
              beadsFailCount++;
            }
          }

          progressLedger.stepHistory.push({
            step: progressLedger.currentStep++,
            action: call.function.name,
            timestamp: new Date(),
            success: true,
          });
          progressLedger.stallCount = 0;
          progressLedger.lastProgressAt = new Date();
        } else {
          const errorMsg = getErrorMessage(settled.reason);
          yield { type: "tool_start", name: call.function.name, args: {} };
          yield { type: "tool_error", name: call.function.name, error: errorMsg };

          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: errorMsg }),
          });

          // Track beads tool errors
          if (BEADS_TOOL_NAMES.has(call.function.name)) {
            beadsFailCount++;
          }

          progressLedger.stepHistory.push({
            step: progressLedger.currentStep++,
            action: call.function.name,
            timestamp: new Date(),
            success: false,
            error: errorMsg,
          });
          progressLedger.stallCount++;
        }
      }

      // Beads circuit breaker: inject stop message when beads keeps failing
      if (beadsFailCount >= BEADS_FAIL_LIMIT && !beadsAbandoned) {
        beadsAbandoned = true;
        this.messages.push({
          role: "system",
          content: "[SYSTEM] Beads has failed multiple times. STOP using ALL beads tools immediately. Proceed with the user's actual task WITHOUT beads. Do NOT call any beads_ tools again. Inform the user that beads is unavailable.",
        });
        log.debug("Beads circuit breaker triggered — injected stop message");
      }

      this.boundMessages();

      if (progressLedger.stallCount >= STALL_THRESHOLD) {
        if (taskLedger.replanCount >= MAX_REPLANS) {
          yield { type: "error", message: "Maximum re-planning attempts reached." };
          return;
        }
      }
    }

    yield { type: "error", message: `Maximum iterations (${MAX_ITERATIONS}) reached` };
  }

  /**
   * Prevent unbounded message array growth.
   */
  private boundMessages(): void {
    if (this.messages.length > MAX_MESSAGES) {
      const keepFirst = this.messages[0];
      const keepRecent = this.messages.slice(-(MAX_MESSAGES - 1));
      this.messages = keepFirst ? [keepFirst, ...keepRecent] : keepRecent;
      log.debug(`Bounded messages array to ${this.messages.length}`);
    }
  }

  private buildSystemPrompt(): string {
    return `You are Sharkbait, a brave and enthusiastic AI coding assistant!

Just like Nemo, you're small but mighty - ready to take on any challenge with curiosity and determination.

You have access to tools for:
- Reading, writing, and editing files
- Running shell commands
- Managing tasks with Beads (bd) - your memory system
- Interacting with GitHub (gh)

BEADS ARE YOUR MEMORY SYSTEM:
- Use beads_status or beads_list FIRST when the user asks about previous work
- ALWAYS create a Bead task when generating or modifying code
- Use beads_create at the START of any coding task
- Use beads_done when you've completed the work

CRITICAL — BEADS FAILURE POLICY:
If beads WRITE tools fail (beads_create, beads_done, beads_init) or return proceedWithoutBeads:
- Do NOT retry the same beads write operation more than ONCE
- Do NOT try to troubleshoot, fix, or debug beads problems
- Do NOT install dolt, restart services, or run bd commands via run_command
- IMMEDIATELY proceed with the user's actual task
- Inform the user beads is unavailable — their task will proceed without tracking
- The user's task is ALWAYS more important than beads
Exception: When the user EXPLICITLY asks about beads/tasks ("what's on my beads", "list tasks"), ALWAYS try beads_list — it can read local files even when dolt is down.

Guidelines:
1. Always read files before editing
2. Make precise, minimal edits
3. Create a Bead for EVERY code task (but proceed without it if beads fails)
4. Ask for confirmation before destructive operations
5. Explain your reasoning clearly

Current working directory: ${process.cwd()}
Platform: ${process.platform}
`;
  }
}
