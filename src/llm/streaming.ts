/**
 * Stream Handler - Utilities for handling SSE streaming responses
 */

import type { ChatChunk, ToolCall } from "./types";

export class StreamHandler {
  private buffer: string = "";
  private toolCallAccumulator: Map<number, Partial<ToolCall>> = new Map();

  /**
   * Process a streaming chunk and return accumulated content
   */
  processChunk(chunk: ChatChunk): {
    text: string;
    toolCalls: ToolCall[] | null;
    isComplete: boolean;
  } {
    this.buffer += chunk.content;

    // Accumulate tool calls
    if (chunk.toolCalls) {
      for (const tc of chunk.toolCalls) {
        const index = tc.index ?? 0;
        const existing = this.toolCallAccumulator.get(index);
        
        if (!existing) {
          this.toolCallAccumulator.set(index, {
            id: tc.id ?? "",
            type: "function",
            function: {
              name: tc.function?.name ?? "",
              arguments: tc.function?.arguments ?? "",
            },
            index,
          });
        } else {
          // Accumulate arguments
          if (tc.function?.arguments) {
            existing.function = existing.function ?? { name: "", arguments: "" };
            existing.function.arguments += tc.function.arguments;
          }
        }
      }
    }

    const isComplete = chunk.finishReason !== null;
    
    return {
      text: chunk.content,
      toolCalls: isComplete ? this.getAccumulatedToolCalls() : null,
      isComplete,
    };
  }

  /**
   * Get all accumulated tool calls
   */
  getAccumulatedToolCalls(): ToolCall[] | null {
    if (this.toolCallAccumulator.size === 0) {
      return null;
    }

    const toolCalls: ToolCall[] = [];
    for (const [, tc] of this.toolCallAccumulator) {
      if (tc.id && tc.function?.name) {
        toolCalls.push({
          id: tc.id,
          type: "function",
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments ?? "",
          },
          index: tc.index ?? 0,
        });
      }
    }

    return toolCalls.length > 0 ? toolCalls : null;
  }

  /**
   * Get the full accumulated text
   */
  getFullText(): string {
    return this.buffer;
  }

  /**
   * Reset the handler for a new stream
   */
  reset(): void {
    this.buffer = "";
    this.toolCallAccumulator.clear();
  }
}
