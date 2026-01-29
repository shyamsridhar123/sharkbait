/**
 * Azure OpenAI Client - Wrapper for Azure OpenAI API with streaming support
 */

import { AzureOpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatChunk, ToolDefinition, Message, ToolCall } from "./types";
import { log } from "../utils/logger";
import { LLMError } from "../utils/errors";

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export class AzureOpenAIClient {
  private client: AzureOpenAI;
  private deployment: string;
  private maxRetries: number = 3;
  private baseDelay: number = 1000;

  constructor(config: LLMConfig) {
    if (!config.endpoint || !config.apiKey) {
      throw new LLMError("Azure OpenAI endpoint and API key are required");
    }

    this.client = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
    });
    this.deployment = config.deployment;
  }

  async *chat(
    messages: Message[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<ChatChunk> {
    const openAIMessages: ChatCompletionMessageParam[] = messages.map(this.convertMessage);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const toolsParam = tools ? tools.map(t => ({
          type: "function" as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters as Record<string, unknown>,
          },
        })) : undefined;
        
        const stream = await this.client.chat.completions.create({
          model: this.deployment,
          messages: openAIMessages,
          tools: toolsParam,
          stream: true,
        });

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;

          const toolCallsData = choice.delta?.tool_calls?.map(tc => ({
            id: tc.id ?? "",
            type: "function" as const,
            function: {
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            },
            index: tc.index,
          }));

          yield {
            content: choice.delta?.content ?? "",
            toolCalls: toolCallsData && toolCallsData.length > 0 ? toolCallsData : undefined,
            finishReason: choice.finish_reason,
          };
        }
        
        return; // Success, exit retry loop
        
      } catch (error) {
        lastError = error as Error;
        
        if (this.isRetryableError(error)) {
          const delay = this.calculateBackoff(attempt);
          log.warn(`LLM request failed (attempt ${attempt + 1}/${this.maxRetries}), retrying in ${delay}ms...`);
          await this.sleep(delay);
          continue;
        }
        
        throw this.wrapError(error);
      }
    }
    
    throw this.wrapError(lastError);
  }

  private convertMessage(msg: Message): ChatCompletionMessageParam {
    if (msg.role === "tool") {
      return {
        role: "tool",
        tool_call_id: msg.tool_call_id ?? "",
        content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
      };
    }

    if (msg.role === "assistant" && msg.tool_calls) {
      return {
        role: "assistant",
        content: msg.content ?? null,
        tool_calls: msg.tool_calls.map(tc => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      };
    }

    return {
      role: msg.role as "system" | "user" | "assistant",
      content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
    };
  }

  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Rate limiting
      if (message.includes("429") || message.includes("rate limit")) {
        return true;
      }
      
      // Server errors
      if (message.includes("500") || message.includes("502") || 
          message.includes("503") || message.includes("504")) {
        return true;
      }
      
      // Network errors
      if (message.includes("network") || message.includes("timeout") ||
          message.includes("econnreset") || message.includes("econnrefused")) {
        return true;
      }
    }
    
    return false;
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, 60000); // Max 60 seconds
  }

  private wrapError(error: unknown): LLMError {
    if (error instanceof LLMError) {
      return error;
    }
    
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    const statusCode = this.extractStatusCode(error);
    
    return new LLMError(message, statusCode);
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (error && typeof error === "object" && "status" in error) {
      return error.status as number;
    }
    return undefined;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
