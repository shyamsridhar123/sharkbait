/**
 * Unit Tests - Progress Tracker
 */

import { describe, test, expect } from "bun:test";
import { ProgressTracker, type TaskLedger, type ProgressLedger } from "../../src/agent/progress";

describe("ProgressTracker", () => {
  function createTaskLedger(): TaskLedger {
    return {
      taskId: "test-123",
      objective: "Test objective",
      facts: [],
      assumptions: [],
      plan: ["Step 1", "Step 2", "Step 3"],
      createdAt: new Date(),
      lastReplanAt: new Date(),
      replanCount: 0,
    };
  }

  function createProgressLedger(): ProgressLedger {
    return {
      currentStep: 0,
      stepHistory: [],
      stallCount: 0,
      lastProgressAt: new Date(),
      agentAssignments: new Map(),
    };
  }

  test("returns continue for normal progress", () => {
    const tracker = new ProgressTracker();
    const task = createTaskLedger();
    const progress = createProgressLedger();
    
    const result = tracker.checkProgress(progress, task);
    expect(result.type).toBe("continue");
  });

  test("detects stall and triggers replan", () => {
    const tracker = new ProgressTracker();
    const task = createTaskLedger();
    const progress = createProgressLedger();
    progress.stallCount = 3;
    
    const result = tracker.checkProgress(progress, task);
    expect(result.type).toBe("replan");
  });

  test("escalates after max replans", () => {
    const tracker = new ProgressTracker();
    const task = createTaskLedger();
    task.replanCount = 2;
    const progress = createProgressLedger();
    progress.stallCount = 3;
    
    const result = tracker.checkProgress(progress, task);
    expect(result.type).toBe("escalate");
  });

  test("detects completion when plan finished", () => {
    const tracker = new ProgressTracker();
    const task = createTaskLedger();
    const progress = createProgressLedger();
    progress.currentStep = 3;
    
    const result = tracker.checkProgress(progress, task);
    expect(result.type).toBe("complete");
  });

  test("recordStep updates progress", () => {
    const tracker = new ProgressTracker();
    const progress = createProgressLedger();
    
    tracker.recordStep(progress, "read_file", true);
    
    expect(progress.currentStep).toBe(1);
    expect(progress.stepHistory.length).toBe(1);
    expect(progress.stallCount).toBe(0);
  });

  test("recordStep increments stall count on failure", () => {
    const tracker = new ProgressTracker();
    const progress = createProgressLedger();
    
    tracker.recordStep(progress, "read_file", false, "File not found");
    
    expect(progress.stallCount).toBe(1);
    expect(progress.stepHistory[0]?.error).toBe("File not found");
  });

  test("addFact adds unique facts", () => {
    const tracker = new ProgressTracker();
    const task = createTaskLedger();
    
    tracker.addFact(task, "Fact 1");
    tracker.addFact(task, "Fact 1"); // Duplicate
    tracker.addFact(task, "Fact 2");
    
    expect(task.facts.length).toBe(2);
  });
});
