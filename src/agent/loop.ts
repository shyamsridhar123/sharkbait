/**
 * Agent Loop - The agentic loop implementation with stall detection
 * Inspired by Microsoft Research Magentic-One and Anthropic's "Building Effective Agents"
 */

import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import { ContextManager } from "./context";
import { ProgressTracker, type TaskLedger, type ProgressLedger } from "./progress";
import type { Message, ToolCall } from "../llm/types";
import type { AgentEvent } from "./types";
import { log } from "../utils/logger";

// Constants for stall detection (inspired by Magentic-One)
const STALL_THRESHOLD = 3;      // Consecutive steps without progress
const MAX_REPLANS = 2;          // Maximum re-planning attempts
const MAX_ITERATIONS = 50;      // Absolute limit on loop iterations

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
    
    // Initialize task ledger for this request
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

    while (iteration < MAX_ITERATIONS) {
      iteration++;
      log.debug(`Agent loop iteration ${iteration}`);
      
      // Check for stalls and handle recovery
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
        // Add re-planning context to messages
        this.messages.push({
          role: "system",
          content: `[Re-planning triggered: ${progressCheck.reason}]\nRevise your approach based on what we've learned.`,
        });
      }
      
      // Context management - compact if needed
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
      
      // Stream LLM response
      let fullContent = "";
      let toolCalls: ToolCall[] = [];

      try {
        for await (const chunk of this.llm.chat(
          [{ role: "system", content: this.systemPrompt }, ...contextMessages],
          this.tools.getDefinitions()
        )) {
          if (chunk.content) {
            fullContent += chunk.content;
            yield { type: "text", content: chunk.content };
          }
          if (chunk.toolCalls) {
            toolCalls = this.accumulateToolCalls(toolCalls, chunk.toolCalls);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown LLM error";
        yield { type: "error", message: errorMessage };
        return;
      }

      // No tool calls = done
      if (toolCalls.length === 0) {
        this.messages.push({ role: "assistant", content: fullContent });
        yield { type: "done" };
        return;
      }

      // Execute tool calls and track progress
      this.messages.push({
        role: "assistant",
        content: fullContent,
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        yield { type: "tool_start", name: call.function.name };
        
        try {
          const result = await this.tools.execute(
            call.function.name,
            JSON.parse(call.function.arguments)
          );
          
          yield { type: "tool_result", name: call.function.name, result };
          
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
          
          // Update progress tracking
          progressLedger.stepHistory.push({
            step: progressLedger.currentStep++,
            action: call.function.name,
            timestamp: new Date(),
            success: true,
          });
          progressLedger.stallCount = 0;
          progressLedger.lastProgressAt = new Date();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Tool execution failed";
          
          yield { type: "tool_error", name: call.function.name, error: errorMessage };
          
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: errorMessage }),
          });
          
          // Track failed step
          progressLedger.stepHistory.push({
            step: progressLedger.currentStep++,
            action: call.function.name,
            timestamp: new Date(),
            success: false,
            error: errorMessage,
          });
          progressLedger.stallCount++;
        }
      }
      
      // Check for stall condition
      if (progressLedger.stallCount >= STALL_THRESHOLD) {
        if (taskLedger.replanCount >= MAX_REPLANS) {
          yield { type: "error", message: "Maximum re-planning attempts reached. Task cannot be completed." };
          return;
        }
      }
    }
    
    yield { type: "error", message: `Maximum iterations (${MAX_ITERATIONS}) reached` };
  }

  private accumulateToolCalls(existing: ToolCall[], deltas: Partial<ToolCall>[]): ToolCall[] {
    for (const delta of deltas) {
      const index = delta.index ?? 0;
      
      if (!existing[index]) {
        existing[index] = {
          id: delta.id ?? "",
          type: "function",
          function: {
            name: delta.function?.name ?? "",
            arguments: delta.function?.arguments ?? "",
          },
          index,
        };
      } else {
        if (delta.function?.arguments) {
          existing[index].function.arguments += delta.function.arguments;
        }
      }
    }
    
    return existing;
  }

  private buildSystemPrompt(): string {
    return `You are Sharkbait, an expert AI coding assistant.

You have access to tools for:
- Reading, writing, and editing files
- Running shell commands
- Managing tasks with Beads (bd)
- Interacting with GitHub (gh)

Guidelines:
1. Always read files before editing to understand context
2. Make precise, minimal edits
3. Create Beads tasks for multi-step work
4. Ask for confirmation before destructive operations
5. Explain your reasoning

Current working directory: ${process.cwd()}
Platform: ${process.platform}
`;
  }
}
