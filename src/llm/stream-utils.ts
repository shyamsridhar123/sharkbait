/**
 * Stream Utilities - Shared tool call accumulation for agent loops
 * Single implementation used by both AgentLoop and BaseAgent
 */

import type { ToolCall } from "./types";

/**
 * Accumulate streaming tool call deltas into complete tool calls.
 * This is the SINGLE implementation — eliminates the 3-copy duplication.
 */
export function accumulateToolCalls(
  existing: ToolCall[],
  deltas: Partial<ToolCall>[]
): ToolCall[] {
  for (const delta of deltas) {
    const index = delta.index ?? 0;

    // Ensure array is large enough
    while (existing.length <= index) {
      existing.push({
        id: "",
        type: "function",
        function: { name: "", arguments: "" },
        index: existing.length,
      });
    }

    const current = existing[index]!;

    if (delta.id) current.id = delta.id;
    if (delta.function?.name) current.function.name += delta.function.name;
    if (delta.function?.arguments)
      current.function.arguments += delta.function.arguments;
  }

  return existing;
}
