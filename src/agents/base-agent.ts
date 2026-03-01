/**
 * Base Agent - Abstract base class for all agents
 *
 * Changes from original:
 * - Uses shared accumulateToolCalls from stream-utils
 * - Yields tool_error events (previously silently swallowed)
 * - Hooks wired automatically via ToolRegistry.execute()
 * - Uses getErrorMessage utility
 */

import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { Message, ToolCall } from "../llm/types";
import { accumulateToolCalls } from "../llm/stream-utils";
import type {
  AgentConfig,
  AgentRole,
  PromptingMode,
  AgentResult,
  AgentStreamEvent,
} from "./types";
import { log } from "../utils/logger";
import { getErrorMessage } from "../utils/security";

export abstract class BaseAgent {
  protected llm: AzureOpenAIClient;
  protected toolRegistry: ToolRegistry;
  protected config: AgentConfig;
  protected messages: Message[] = [];
  protected currentMode?: PromptingMode;

  constructor(
    llm: AzureOpenAIClient,
    toolRegistry: ToolRegistry,
    config: AgentConfig
  ) {
    this.llm = llm;
    this.toolRegistry = toolRegistry;
    this.config = config;
  }

  get role(): AgentRole {
    return this.config.name;
  }

  get color(): string {
    return this.config.color;
  }

  get supportedModes(): PromptingMode[] {
    return this.config.modes ?? [];
  }

  supportsMode(mode: PromptingMode): boolean {
    return this.config.modes?.includes(mode) ?? false;
  }

  setMode(mode: PromptingMode): void {
    if (!this.supportsMode(mode)) {
      throw new Error(`Agent ${this.role} does not support mode: ${mode}`);
    }
    this.currentMode = mode;
  }

  protected buildSystemPrompt(): string {
    let prompt = this.config.systemPrompt;

    if (this.currentMode) {
      const modePrompt = this.getModePrompt(this.currentMode);
      if (modePrompt) {
        prompt += `\n\n## Current Mode: ${this.currentMode}\n${modePrompt}`;
      }
    }

    return prompt;
  }

  protected getModePrompt(_mode: PromptingMode): string | undefined {
    return undefined;
  }

  protected getTools(): any[] {
    if (this.config.tools.includes("*")) {
      return this.toolRegistry.getDefinitions();
    }
    return this.toolRegistry
      .getDefinitions()
      .filter((tool) => this.config.tools.includes(tool.name));
  }

  async *run(input: string): AsyncGenerator<AgentStreamEvent> {
    const startTime = Date.now();
    const toolsCalled: string[] = [];
    let output = "";
    let tokenCount = 0;

    yield { type: "agent_start", agent: this.role, mode: this.currentMode };

    this.messages.push({ role: "user", content: input });

    const maxIterations = this.config.maxIterations ?? 50;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      log.debug(`${this.role} agent iteration ${iteration}`);

      const systemPrompt = this.buildSystemPrompt();
      const messagesToSend: Message[] = [
        { role: "system", content: systemPrompt },
        ...this.messages,
      ];

      let fullContent = "";
      let toolCalls: ToolCall[] = [];

      try {
        for await (const chunk of this.llm.chat(
          messagesToSend,
          this.getTools()
        )) {
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
        this.messages.push({ role: "assistant", content: fullContent });
        output = fullContent;

        const result: AgentResult = {
          agent: this.role,
          mode: this.currentMode,
          success: true,
          output,
          toolsCalled,
          tokenCount,
          durationMs: Date.now() - startTime,
        };

        yield { type: "done", result };
        return;
      }

      this.messages.push({
        role: "assistant",
        content: fullContent,
        tool_calls: toolCalls,
      });

      // Execute tool calls in parallel
      const toolResults = await Promise.allSettled(
        toolCalls.map(async (call) => {
          const args = JSON.parse(call.function.arguments);
          return {
            call,
            result: await this.toolRegistry.execute(
              call.function.name,
              args,
              this.role
            ),
          };
        })
      );

      for (let i = 0; i < toolResults.length; i++) {
        const call = toolCalls[i]!;
        const toolName = call.function.name;
        const settled = toolResults[i]!;

        toolsCalled.push(toolName);

        if (settled.status === "fulfilled") {
          const { result } = settled.value;
          yield { type: "tool_start", name: toolName };
          yield { type: "tool_result", name: toolName, result };

          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content:
              typeof result === "string" ? result : JSON.stringify(result),
          });
        } else {
          // FIX: Now yields tool_error instead of silently swallowing
          const errorMsg = getErrorMessage(settled.reason);
          yield { type: "tool_start", name: toolName };
          yield { type: "tool_error", name: toolName, error: errorMsg };

          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: errorMsg }),
          });
        }
      }

      output = fullContent;
    }

    yield {
      type: "error",
      message: `Max iterations (${maxIterations}) reached`,
    };
  }

  reset(): void {
    this.messages = [];
    this.currentMode = undefined;
  }
}
