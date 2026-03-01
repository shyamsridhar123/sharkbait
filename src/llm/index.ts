/**
 * LLM Module - exports Azure OpenAI client and related utilities
 */

export { AzureOpenAIClient, type LLMConfig } from "./azure-openai";
export { accumulateToolCalls } from "./stream-utils";
export type { Message, ToolCall, ChatChunk, ToolDefinition } from "./types";
export { withRetry, type RetryOptions, retryUtils } from "./retry";
// StreamHandler removed — use accumulateToolCalls from stream-utils instead
