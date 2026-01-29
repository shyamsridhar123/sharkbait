/**
 * Azure OpenAI Client - Wrapper for Azure OpenAI Responses API with streaming support
 */

import { AzureOpenAI } from "openai";
import type { ChatChunk, ToolDefinition, Message } from "./types";
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
    // Extract system message for instructions
    const systemMessages = messages.filter(m => m.role === "system");
    const nonSystemMessages = messages.filter(m => m.role !== "system");
    const instructions = systemMessages.map(m => m.content).join("\n\n") || undefined;
    
    // Convert messages to Responses API input format
    const input = this.convertMessagesToInput(nonSystemMessages);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Build tools config for Responses API
        const toolsConfig = tools ? tools.map(t => ({
          type: "function" as const,
          name: t.name,
          description: t.description,
          parameters: t.parameters as Record<string, unknown>,
        })) : undefined;
        
        // Use the Responses API with streaming
        const stream = await this.client.responses.create({
          model: this.deployment,
          input: input,
          instructions: instructions,
          tools: toolsConfig,
          stream: true,
        });

        let currentToolCallId = "";
        let currentToolCallName = "";
        let currentToolCallArgs = "";
        let streamedTextLength = 0; // Track how much text we've already streamed

        for await (const event of stream) {
          // Debug logging for all events
          log.debug(`LLM event: ${event.type}`, event);
          
          // Handle different event types from Responses API
          switch (event.type) {
            case "response.output_text.delta":
            case "response.content_part.delta":
            case "response.text.delta":
              // Handle various text delta event types
              const textDelta = (event as any).delta || (event as any).text || "";
              if (textDelta) {
                streamedTextLength += textDelta.length;
                yield {
                  content: textDelta,
                  toolCalls: undefined,
                  finishReason: undefined,
                };
              }
              break;

            case "response.function_call_arguments.delta":
              // Accumulate function call arguments
              currentToolCallArgs += (event as any).delta || "";
              break;

            case "response.output_item.added":
              // Track new function call
              const item = (event as any).item;
              if (item?.type === "function_call") {
                currentToolCallId = item.call_id || "";
                currentToolCallName = item.name || "";
                currentToolCallArgs = "";
              }
              break;

            case "response.output_item.done":
              // Function call completed
              const doneItem = (event as any).item;
              if (doneItem?.type === "function_call" && currentToolCallName) {
                yield {
                  content: "",
                  toolCalls: [{
                    id: currentToolCallId,
                    type: "function" as const,
                    function: {
                      name: currentToolCallName,
                      arguments: currentToolCallArgs || doneItem.arguments || "",
                    },
                    index: 0,
                  }],
                  finishReason: "tool_calls",
                };
                currentToolCallId = "";
                currentToolCallName = "";
                currentToolCallArgs = "";
              }
              break;

            case "response.completed":
              // Only extract final text if nothing was streamed (fallback for non-streaming responses)
              const completedResponse = (event as any).response;
              if (streamedTextLength === 0 && completedResponse?.output) {
                for (const outputItem of completedResponse.output) {
                  if (outputItem.type === "message" && outputItem.content) {
                    for (const contentPart of outputItem.content) {
                      if (contentPart.type === "output_text" && contentPart.text) {
                        yield {
                          content: contentPart.text,
                          toolCalls: undefined,
                          finishReason: undefined,
                        };
                      }
                    }
                  }
                }
              }
              yield {
                content: "",
                toolCalls: undefined,
                finishReason: "stop",
              };
              break;
              
            default:
              // Log unhandled event types for debugging
              log.debug(`Unhandled LLM event type: ${event.type}`);
              break;
          }
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

  private convertMessagesToInput(messages: Message[]): string | object[] {
    // For simple cases, just use the last user message as input
    // For complex multi-turn, build conversation array
    if (messages.length === 1 && messages[0].role === "user") {
      return messages[0].content as string;
    }

    // Convert to Responses API format for multi-turn
    // The Responses API uses a different format than Chat Completions
    const inputItems: object[] = [];
    
    for (const msg of messages) {
      if (msg.role === "user") {
        inputItems.push({
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: msg.content || "" }],
        });
      } else if (msg.role === "assistant") {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          // Add function calls as separate items
          for (const tc of msg.tool_calls) {
            inputItems.push({
              type: "function_call",
              call_id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            });
          }
        }
        if (msg.content) {
          inputItems.push({
            type: "message",
            role: "assistant",
            content: [{ type: "output_text", text: msg.content }],
          });
        }
      } else if (msg.role === "tool") {
        inputItems.push({
          type: "function_call_output",
          call_id: msg.tool_call_id,
          output: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
        });
      } else if (msg.role === "system") {
        // System messages become part of instructions, handled separately
        // Skip here as we pass instructions parameter
      }
    }
    
    return inputItems;
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
