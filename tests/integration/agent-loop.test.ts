/**
 * Integration Tests - Agent Loop
 */

import { describe, test, expect, mock } from "bun:test";
import { AgentLoop } from "../../src/agent/loop";
import { ToolRegistry } from "../../src/tools/registry";
import type { AzureOpenAIClient } from "../../src/llm/azure-openai";
import type { ChatChunk, ToolDefinition } from "../../src/llm/types";

// Mock LLM client
function createMockLLM(responses: Array<{ content?: string; toolCalls?: any[] }>): AzureOpenAIClient {
  let responseIndex = 0;
  
  return {
    async *chat(messages: any[], tools?: ToolDefinition[]): AsyncGenerator<ChatChunk> {
      const response = responses[responseIndex++] || { content: "Done" };
      
      if (response.content) {
        yield {
          content: response.content,
          toolCalls: undefined,
          finishReason: response.toolCalls ? null : "stop",
        };
      }
      
      if (response.toolCalls) {
        yield {
          content: "",
          toolCalls: response.toolCalls.map((tc, i) => ({
            id: `call_${i}`,
            type: "function" as const,
            function: tc.function,
            index: i,
          })),
          finishReason: "tool_calls",
        };
      }
    },
  } as unknown as AzureOpenAIClient;
}

describe("AgentLoop Integration", () => {
  test("completes simple query without tools", async () => {
    const mockLLM = createMockLLM([
      { content: "Hello! I'm here to help." },
    ]);
    
    const tools = new ToolRegistry({ enableBeads: false });
    const loop = new AgentLoop(mockLLM, tools);
    
    const events = [];
    for await (const event of loop.run("Hello")) {
      events.push(event);
    }
    
    expect(events.some(e => e.type === "text")).toBe(true);
    expect(events.some(e => e.type === "done")).toBe(true);
  });

  test("executes tool calls", async () => {
    const mockLLM = createMockLLM([
      { 
        content: "Let me read that file for you.",
        toolCalls: [{ 
          function: { 
            name: "read_file", 
            arguments: JSON.stringify({ path: "package.json" }) 
          } 
        }] 
      },
      { content: "The package.json contains your project configuration." },
    ]);
    
    const tools = new ToolRegistry({ enableBeads: false });
    const loop = new AgentLoop(mockLLM, tools);
    
    const events = [];
    for await (const event of loop.run("What's in package.json?")) {
      events.push(event);
    }
    
    expect(events.some(e => e.type === "tool_start" && e.name === "read_file")).toBe(true);
    expect(events.some(e => e.type === "tool_result")).toBe(true);
  });

  test("handles tool errors gracefully", async () => {
    const mockLLM = createMockLLM([
      { 
        toolCalls: [{ 
          function: { 
            name: "read_file", 
            arguments: JSON.stringify({ path: "nonexistent.txt" }) 
          } 
        }] 
      },
      { content: "I couldn't find that file." },
    ]);
    
    const tools = new ToolRegistry({ enableBeads: false });
    const loop = new AgentLoop(mockLLM, tools);
    
    const events = [];
    for await (const event of loop.run("Read nonexistent.txt")) {
      events.push(event);
    }
    
    expect(events.some(e => e.type === "tool_error")).toBe(true);
  });

  test("respects MAX_ITERATIONS limit", async () => {
    // Create a mock that always returns tool calls to trigger iteration limit
    const mockLLM = createMockLLM(
      Array(100).fill({ 
        toolCalls: [{ 
          function: { 
            name: "git_status", 
            arguments: JSON.stringify({}) 
          } 
        }] 
      })
    );
    
    const tools = new ToolRegistry({ enableBeads: false });
    const loop = new AgentLoop(mockLLM, tools);
    
    const events = [];
    for await (const event of loop.run("Keep checking status forever")) {
      events.push(event);
    }
    
    // Should eventually error due to MAX_ITERATIONS
    expect(events.some(e => e.type === "error")).toBe(true);
  });
});
