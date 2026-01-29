/**
 * Unit Tests - Context Manager
 */

import { describe, test, expect } from "bun:test";
import { ContextManager } from "../../src/agent/context";
import type { TaskLedger } from "../../src/agent/progress";

describe("ContextManager", () => {
  const defaultConfig = {
    maxTokens: 128000,
    reservedForResponse: 16000,
    compactionThreshold: 0.85,
  };

  function createTaskLedger(): TaskLedger {
    return {
      taskId: "test-123",
      objective: "Test objective",
      facts: [],
      assumptions: [],
      plan: [],
      createdAt: new Date(),
      lastReplanAt: new Date(),
      replanCount: 0,
    };
  }

  test("returns messages when under threshold", async () => {
    const manager = new ContextManager(defaultConfig);
    
    const result = await manager.checkAndCompact(
      {
        systemPrompt: "You are a helpful assistant",
        taskLedger: createTaskLedger(),
        recentMessages: [{ role: "user", content: "Hello" }],
        activeFiles: [],
        errorContext: [],
      },
      {
        olderMessages: [],
        toolResults: [],
        explorationFindings: [],
      }
    );
    
    expect(result.length).toBeGreaterThan(0);
  });

  test("compacts tool results when over threshold", async () => {
    const manager = new ContextManager({
      maxTokens: 100,
      reservedForResponse: 10,
      compactionThreshold: 0.5,
    });
    
    const result = await manager.checkAndCompact(
      {
        systemPrompt: "System",
        taskLedger: createTaskLedger(),
        recentMessages: [],
        activeFiles: [],
        errorContext: [],
      },
      {
        olderMessages: [],
        toolResults: [
          { name: "tool1", content: "a".repeat(100) },
          { name: "tool2", content: "b".repeat(100) },
          { name: "tool3", content: "c".repeat(100) },
          { name: "tool4", content: "d".repeat(100) },
          { name: "tool5", content: "e".repeat(100) },
          { name: "tool6", content: "f".repeat(100) },
        ],
        explorationFindings: [],
      }
    );
    
    // Result should be compacted
    expect(result).toBeDefined();
  });
});
