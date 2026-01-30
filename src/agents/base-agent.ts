/**
 * Base Agent - Abstract base class for all agents
 */

import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { Message, ToolCall } from "../llm/types";
import type { 
  AgentConfig, 
  AgentRole, 
  PromptingMode, 
  AgentResult,
  AgentStreamEvent 
} from "./types";
import { log } from "../utils/logger";

/**
 * Abstract base class for all Sharkbait agents
 */
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

  /**
   * Get the agent's role
   */
  get role(): AgentRole {
    return this.config.name;
  }

  /**
   * Get the agent's display color
   */
  get color(): string {
    return this.config.color;
  }

  /**
   * Get supported prompting modes
   */
  get supportedModes(): PromptingMode[] {
    return this.config.modes ?? [];
  }

  /**
   * Check if agent supports a specific mode
   */
  supportsMode(mode: PromptingMode): boolean {
    return this.config.modes?.includes(mode) ?? false;
  }

  /**
   * Set the current prompting mode
   */
  setMode(mode: PromptingMode): void {
    if (!this.supportsMode(mode)) {
      throw new Error(`Agent ${this.role} does not support mode: ${mode}`);
    }
    this.currentMode = mode;
  }

  /**
   * Build the system prompt, optionally including mode-specific instructions
   */
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

  /**
   * Get mode-specific prompt additions (override in subclasses)
   */
  protected getModePrompt(mode: PromptingMode): string | undefined {
    return undefined;
  }

  /**
   * Get tools available to this agent
   */
  protected getTools(): any[] {
    if (this.config.tools.includes("*")) {
      return this.toolRegistry.getDefinitions();
    }
    return this.toolRegistry.getDefinitions().filter(
      tool => this.config.tools.includes(tool.name)
    );
  }

  /**
   * Execute the agent with given input
   */
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
      
      // Build messages with system prompt
      const systemPrompt = this.buildSystemPrompt();
      const messagesToSend: Message[] = [
        { role: "system", content: systemPrompt },
        ...this.messages
      ];
      
      // Stream LLM response
      let fullContent = "";
      let toolCalls: ToolCall[] = [];
      
      try {
        for await (const chunk of this.llm.chat(messagesToSend, this.getTools())) {
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
      
      // Execute tool calls
      this.messages.push({
        role: "assistant",
        content: fullContent,
        tool_calls: toolCalls,
      });
      
      for (const call of toolCalls) {
        const toolName = call.function.name;
        toolsCalled.push(toolName);
        
        yield { type: "tool_start", name: toolName };
        
        try {
          const result = await this.toolRegistry.execute(
            toolName,
            JSON.parse(call.function.arguments)
          );
          
          yield { type: "tool_result", name: toolName, result };
          
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: typeof result === "string" ? result : JSON.stringify(result),
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          
          this.messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: errorMessage }),
          });
        }
      }
      
      output = fullContent;
    }
    
    // Max iterations reached
    yield { 
      type: "error", 
      message: `Max iterations (${maxIterations}) reached` 
    };
  }

  /**
   * Accumulate streaming tool calls
   */
  private accumulateToolCalls(existing: ToolCall[], incoming: Partial<ToolCall>[]): ToolCall[] {
    for (const chunk of incoming) {
      if (chunk.index !== undefined) {
        while (existing.length <= chunk.index) {
          existing.push({
            id: "",
            type: "function",
            function: { name: "", arguments: "" },
          });
        }
        
        const current = existing[chunk.index];
        if (current) {
          if (chunk.id) current.id = chunk.id;
          if (chunk.function?.name) current.function.name += chunk.function.name;
          if (chunk.function?.arguments) current.function.arguments += chunk.function.arguments;
        }
      }
    }
    return existing;
  }

  /**
   * Reset agent state for a new conversation
   */
  reset(): void {
    this.messages = [];
    this.currentMode = undefined;
  }
}
