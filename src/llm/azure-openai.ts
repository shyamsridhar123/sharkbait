/**
 * Azure OpenAI Client - Wrapper for Azure OpenAI Responses API with streaming support
 *
 * Authentication strategy (in order):
 * 1. Default → Azure Identity (DefaultAzureCredential)
 *    - Supports: managed identity, Azure CLI, VS Code, environment creds
 *    - Token refresh/caching handled by @azure/identity internally
 * 2. Fallback → API key auth (if AZURE_OPENAI_API_KEY is explicitly set)
 */

import { AzureOpenAI } from "openai";
import { DefaultAzureCredential } from "@azure/identity";
import type { ChatChunk, ToolDefinition, Message } from "./types";
import { log } from "../utils/logger";
import { LLMError } from "../utils/errors";
import { withRetry } from "./retry";

const AZURE_COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default";

export interface LLMConfig {
  endpoint: string;
  apiKey?: string;           // Optional fallback — Azure Identity is used by default
  deployment: string;
  apiVersion: string;
}

export class AzureOpenAIClient {
  private client: AzureOpenAI;
  private deployment: string;
  private authMethod: "api-key" | "azure-identity";

  constructor(config: LLMConfig) {
    if (!config.endpoint) {
      throw new LLMError("Azure OpenAI endpoint is required");
    }

    if (config.apiKey) {
      // Fallback: use API key when explicitly provided
      this.client = new AzureOpenAI({
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        apiVersion: config.apiVersion,
      });
      this.authMethod = "api-key";
      log.info("Azure OpenAI client initialized with API key auth (fallback)");
    } else {
      // Default: Azure Identity (DefaultAzureCredential)
      const credential = new DefaultAzureCredential();
      const tokenProvider = async (): Promise<string> => {
        const tokenResponse = await credential.getToken(AZURE_COGNITIVE_SCOPE);
        return tokenResponse.token;
      };

      this.client = new AzureOpenAI({
        endpoint: config.endpoint,
        azureADTokenProvider: tokenProvider,
        apiVersion: config.apiVersion,
      });
      this.authMethod = "azure-identity";
      log.info("Azure OpenAI client initialized with Azure Identity (DefaultAzureCredential)");
    }

    this.deployment = config.deployment;
  }

  getAuthMethod(): "api-key" | "azure-identity" {
    return this.authMethod;
  }

  async *chat(
    messages: Message[],
    tools?: ToolDefinition[]
  ): AsyncGenerator<ChatChunk> {
    const systemMessages = messages.filter(m => m.role === "system");
    const nonSystemMessages = messages.filter(m => m.role !== "system");
    const instructions = systemMessages.map(m => m.content).join("\n\n") || undefined;

    const input = this.convertMessagesToInput(nonSystemMessages);

    // Use withRetry for stream creation. Cast through `any` to handle
    // OpenAI SDK Responses-API type strictness (input/tool shapes).
    const stream = await withRetry(
      async () => {
        const toolsConfig = tools ? tools.map(t => ({
          type: "function" as const,
          name: t.name,
          description: t.description,
          parameters: t.parameters as Record<string, unknown>,
          strict: false,
        })) : undefined;

        return await (this.client.responses as any).create({
          model: this.deployment,
          input,
          instructions,
          tools: toolsConfig,
          stream: true,
          reasoning: { effort: "medium", summary: "auto" },
        });
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 60000,
        onRetry: (error, attempt, delay) => {
          const message = error instanceof Error ? error.message : String(error);
          log.warn(`LLM request failed: ${message}. Retry ${attempt}/3 after ${delay}ms`);
        },
      }
    );

    let currentToolCallId = "";
    let currentToolCallName = "";
    let currentToolCallArgs = "";
    let toolCallIndex = 0;
    let streamedTextLength = 0;

    try {
      // Cast to AsyncIterable<any> — Responses API streaming events
      // don't have stable TS types across openai SDK versions.
      for await (const event of stream as AsyncIterable<any>) {
        log.debug(`LLM event: ${event.type}`);

        switch (event.type) {
          case "response.output_text.delta": {
            const textDelta: string = event.delta || event.text || "";
            if (textDelta) {
              streamedTextLength += textDelta.length;
              yield { content: textDelta, toolCalls: undefined, finishReason: null };
            }
            break;
          }

          case "response.function_call_arguments.delta":
            currentToolCallArgs += event.delta || "";
            break;

          case "response.output_item.added": {
            const item = event.item;
            if (item?.type === "function_call") {
              currentToolCallId = item.call_id || "";
              currentToolCallName = item.name || "";
              currentToolCallArgs = "";
            }
            break;
          }

          case "response.output_item.done": {
            const doneItem = event.item;
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
                  index: toolCallIndex++,
                }],
                finishReason: "tool_calls",
              };
              currentToolCallId = "";
              currentToolCallName = "";
              currentToolCallArgs = "";
            }
            break;
          }

          case "response.reasoning_summary_text.delta": {
            const reasoningDelta: string = event.delta || "";
            if (reasoningDelta) {
              yield { content: "", reasoning: reasoningDelta, toolCalls: undefined, finishReason: null };
            }
            break;
          }

          case "response.reasoning_summary_text.done":
            // All reasoning summary text already streamed via deltas
            break;

          case "response.completed": {
            const resp = event.response;
            if (streamedTextLength === 0 && resp?.output) {
              for (const outputItem of resp.output) {
                if (outputItem.type === "message" && outputItem.content) {
                  for (const part of outputItem.content) {
                    if (part.type === "output_text" && part.text) {
                      yield { content: part.text, toolCalls: undefined, finishReason: null };
                    }
                  }
                }
              }
            }
            yield { content: "", toolCalls: undefined, finishReason: "stop" };
            break;
          }

          default:
            log.debug(`Unhandled LLM event type: ${event.type}`);
            break;
        }
      }
    } catch (error) {
      throw this.wrapError(error);
    }
  }

  private convertMessagesToInput(messages: Message[]): any {
    if (messages.length === 1 && messages[0]?.role === "user") {
      return messages[0].content as string;
    }

    const inputItems: any[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        inputItems.push({
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: msg.content || "" }],
        });
      } else if (msg.role === "assistant") {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
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
      }
    }

    return inputItems;
  }

  private wrapError(error: unknown): LLMError {
    if (error instanceof LLMError) return error;
    const message = error instanceof Error ? error.message : "Unknown LLM error";
    return new LLMError(message, this.extractStatusCode(error));
  }

  private extractStatusCode(error: unknown): number | undefined {
    if (error && typeof error === "object" && "status" in error) {
      return error.status as number;
    }
    return undefined;
  }
}
