/**
 * Progress Tracker - Dual-ledger progress tracking with stall detection
 * Inspired by Microsoft Research Magentic-One
 */

export interface TaskLedger {
  taskId: string;
  objective: string;
  facts: string[];
  assumptions: string[];
  plan: string[];
  createdAt: Date;
  lastReplanAt: Date;
  replanCount: number;
}

export interface StepRecord {
  step: number;
  action: string;
  timestamp: Date;
  success: boolean;
  error?: string | undefined;
}

export interface ProgressLedger {
  currentStep: number;
  stepHistory: StepRecord[];
  stallCount: number;
  lastProgressAt: Date;
  agentAssignments: Map<string, string>;
}

export type ProgressCheckResult = 
  | { type: "continue" }
  | { type: "complete" }
  | { type: "replan"; reason: string }
  | { type: "escalate"; reason: string };

const STALL_THRESHOLD = 3;
const MAX_REPLANS = 2;
const STALE_PROGRESS_MS = 60000; // 1 minute without progress

export class ProgressTracker {
  checkProgress(progress: ProgressLedger, task: TaskLedger): ProgressCheckResult {
    // Check if we're stalled
    if (progress.stallCount >= STALL_THRESHOLD) {
      if (task.replanCount >= MAX_REPLANS) {
        return {
          type: "escalate",
          reason: `Stalled after ${progress.stallCount} failed attempts and ${task.replanCount} re-planning attempts`,
        };
      }
      
      return {
        type: "replan",
        reason: `Stalled after ${progress.stallCount} consecutive failures`,
      };
    }

    // Check for stale progress
    const timeSinceProgress = Date.now() - progress.lastProgressAt.getTime();
    if (timeSinceProgress > STALE_PROGRESS_MS && progress.stepHistory.length > 0) {
      return {
        type: "replan",
        reason: `No progress for ${Math.round(timeSinceProgress / 1000)} seconds`,
      };
    }

    // Check if objective appears complete
    if (this.isObjectiveComplete(progress, task)) {
      return { type: "complete" };
    }

    return { type: "continue" };
  }

  private isObjectiveComplete(progress: ProgressLedger, task: TaskLedger): boolean {
    // Check if all plan items are completed
    if (task.plan.length > 0 && progress.currentStep >= task.plan.length) {
      return true;
    }

    // Check for explicit completion signals in step history
    const lastSteps = progress.stepHistory.slice(-3);
    for (const step of lastSteps) {
      if (step.action.includes("complete") || step.action.includes("done")) {
        return true;
      }
    }

    return false;
  }

  recordStep(progress: ProgressLedger, action: string, success: boolean, error?: string): void {
    const record: StepRecord = {
      step: progress.currentStep++,
      action,
      timestamp: new Date(),
      success,
      error,
    };

    progress.stepHistory.push(record);

    if (success) {
      progress.stallCount = 0;
      progress.lastProgressAt = new Date();
    } else {
      progress.stallCount++;
    }
  }

  updatePlan(task: TaskLedger, newPlan: string[]): void {
    task.plan = newPlan;
    task.lastReplanAt = new Date();
    task.replanCount++;
  }

  addFact(task: TaskLedger, fact: string): void {
    if (!task.facts.includes(fact)) {
      task.facts.push(fact);
    }
  }

  addAssumption(task: TaskLedger, assumption: string): void {
    if (!task.assumptions.includes(assumption)) {
      task.assumptions.push(assumption);
    }
  }
}
