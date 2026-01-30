/**
 * Refactor Workflow - Large-scale code refactoring with validation
 * Analyze → Plan → Execute → Verify → Document
 */

import { BaseWorkflow, type WorkflowPhase, type WorkflowOptions, type WorkflowResult } from "./base-workflow";
import type { AzureOpenAIClient } from "../../llm/azure-openai";
import type { ToolRegistry } from "../../tools";
import { log } from "../../utils/logger";

/**
 * Refactor Workflow Options
 */
export interface RefactorOptions extends WorkflowOptions {
  targetFiles?: string[];
  refactorType?: "extract" | "rename" | "restructure" | "optimize" | "cleanup";
  preserveBehavior?: boolean;
  runTests?: boolean;
}

/**
 * Refactor Workflow - Safe, validated refactoring
 */
export class RefactorWorkflow extends BaseWorkflow {
  name = "refactor";
  description = "Large-scale code refactoring with safety checks";

  phases: WorkflowPhase[] = [
    {
      id: "analyze",
      name: "Analyze",
      description: "Analyze code structure and identify refactoring opportunities",
      agent: "explorer",
      mode: "patterns",
      required: true,
      maxIterations: 1,
    },
    {
      id: "plan",
      name: "Plan",
      description: "Create detailed refactoring plan with steps",
      agent: "planner",
      mode: "tasks",
      required: true,
      maxIterations: 1,
    },
    {
      id: "execute",
      name: "Execute",
      description: "Perform the refactoring changes",
      agent: "coder",
      mode: "refactor",
      required: true,
      maxIterations: 3,
    },
    {
      id: "verify",
      name: "Verify",
      description: "Verify refactoring maintains behavior",
      agent: "reviewer",
      mode: "bugs",
      required: true,
      maxIterations: 1,
    },
    {
      id: "optimize",
      name: "Optimize",
      description: "Check for performance improvements",
      agent: "reviewer",
      mode: "performance",
      required: false,
      maxIterations: 1,
    },
    {
      id: "document",
      name: "Document",
      description: "Update documentation for changes",
      agent: "coder",
      mode: "docs",
      required: false,
      maxIterations: 1,
    },
  ];

  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry);
  }

  /**
   * Execute refactoring workflow
   */
  async execute(refactorRequest: string, options: RefactorOptions = {}): Promise<WorkflowResult> {
    log.info(`Starting refactor: ${refactorRequest.substring(0, 50)}...`);

    const refactorOptions: WorkflowOptions = {
      maxIterationsPerPhase: 3,
      parallelReview: true,
      reviewModes: ["bugs", "performance"],
      ...options,
    };

    // Build enhanced input with refactor context
    const enhancedInput = this.buildRefactorInput(refactorRequest, options);

    return super.execute(enhancedInput, refactorOptions);
  }

  /**
   * Build enhanced input with refactor context
   */
  private buildRefactorInput(description: string, options: RefactorOptions): string {
    let input = `## Refactoring Request\n\n${description}`;

    if (options.refactorType) {
      input += `\n\n### Refactor Type\n${options.refactorType}`;
    }

    if (options.targetFiles && options.targetFiles.length > 0) {
      input += `\n\n### Target Files\n- ${options.targetFiles.join("\n- ")}`;
    }

    if (options.preserveBehavior !== false) {
      input += "\n\n### Constraints\n- Must preserve existing behavior (no breaking changes)";
    }

    if (options.runTests) {
      input += "\n- Run existing tests after refactoring to verify behavior";
    }

    return input;
  }

  /**
   * Refactor workflow refines the execute phase
   */
  protected shouldRefine(phase: WorkflowPhase): boolean {
    return phase.id === "execute";
  }
}
