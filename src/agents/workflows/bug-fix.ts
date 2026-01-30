/**
 * Bug Fix Workflow - Diagnose, fix, and verify bugs
 * Diagnose → Hypothesize → Fix → Verify → Document
 */

import { BaseWorkflow, type WorkflowPhase, type WorkflowOptions, type WorkflowResult } from "./base-workflow";
import type { AzureOpenAIClient } from "../../llm/azure-openai";
import type { ToolRegistry } from "../../tools";
import { log } from "../../utils/logger";

/**
 * Bug Fix Workflow Options
 */
export interface BugFixOptions extends WorkflowOptions {
  errorMessage?: string;
  stackTrace?: string;
  reproSteps?: string[];
  relatedFiles?: string[];
}

/**
 * Bug Fix Workflow - Systematic bug resolution
 */
export class BugFixWorkflow extends BaseWorkflow {
  name = "bug-fix";
  description = "Diagnose and fix bugs with verification";

  phases: WorkflowPhase[] = [
    {
      id: "diagnose",
      name: "Diagnose",
      description: "Understand the bug and trace its cause",
      agent: "debugger",
      mode: "trace",
      required: true,
      maxIterations: 2,
    },
    {
      id: "hypothesize",
      name: "Hypothesize",
      description: "Form hypothesis about root cause",
      agent: "debugger",
      mode: "hypothesis",
      required: true,
      maxIterations: 1,
    },
    {
      id: "fix",
      name: "Fix",
      description: "Implement the fix",
      agent: "coder",
      mode: "write",
      required: true,
      maxIterations: 3,
    },
    {
      id: "verify",
      name: "Verify",
      description: "Verify the fix works and doesn't introduce regressions",
      agent: "reviewer",
      mode: "bugs",
      required: true,
      maxIterations: 1,
    },
    {
      id: "test",
      name: "Add Test",
      description: "Add regression test for the bug",
      agent: "coder",
      mode: "test",
      required: false,
      maxIterations: 2,
    },
    {
      id: "document",
      name: "Document",
      description: "Document the fix and root cause",
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
   * Execute bug fix workflow
   */
  async execute(bugDescription: string, options: BugFixOptions = {}): Promise<WorkflowResult> {
    log.info(`Starting bug fix: ${bugDescription.substring(0, 50)}...`);

    const bugOptions: WorkflowOptions = {
      maxIterationsPerPhase: 3,
      parallelReview: false, // Sequential for bug fixes
      reviewModes: ["bugs"],
      ...options,
    };

    // Build enhanced input with bug context
    const enhancedInput = this.buildBugInput(bugDescription, options);

    return super.execute(enhancedInput, bugOptions);
  }

  /**
   * Build enhanced input with bug context
   */
  private buildBugInput(description: string, options: BugFixOptions): string {
    let input = `## Bug Report\n\n${description}`;

    if (options.errorMessage) {
      input += `\n\n### Error Message\n\`\`\`\n${options.errorMessage}\n\`\`\``;
    }

    if (options.stackTrace) {
      input += `\n\n### Stack Trace\n\`\`\`\n${options.stackTrace}\n\`\`\``;
    }

    if (options.reproSteps && options.reproSteps.length > 0) {
      input += "\n\n### Steps to Reproduce\n";
      options.reproSteps.forEach((step, i) => {
        input += `${i + 1}. ${step}\n`;
      });
    }

    if (options.relatedFiles && options.relatedFiles.length > 0) {
      input += `\n\n### Possibly Related Files\n- ${options.relatedFiles.join("\n- ")}`;
    }

    return input;
  }

  /**
   * Bug fix refines the fix phase
   */
  protected shouldRefine(phase: WorkflowPhase): boolean {
    return phase.id === "fix";
  }
}
