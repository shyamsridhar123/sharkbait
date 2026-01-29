/**
 * LLM Types - Type definitions for LLM interactions
 */

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
  index?: number;
}

export interface ChatChunk {
  content: string;
  toolCalls?: Partial<ToolCall>[] | undefined;
  finishReason: string | null;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object;
}
