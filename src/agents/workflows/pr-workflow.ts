/**
 * PR Workflow - Pull Request creation and management
 * Branch → Commit → Push → PR → Review → Merge
 */

import { BaseWorkflow, type WorkflowPhase, type WorkflowOptions, type WorkflowResult } from "./base-workflow";
import type { AzureOpenAIClient } from "../../llm/azure-openai";
import type { ToolRegistry } from "../../tools";
import { log } from "../../utils/logger";

/**
 * PR Workflow Options
 */
export interface PRWorkflowOptions extends WorkflowOptions {
  baseBranch?: string;
  draft?: boolean;
  autoMerge?: boolean;
}

/**
 * PR Workflow - Complete pull request lifecycle
 */
export class PRWorkflow extends BaseWorkflow {
  name = "pr-workflow";
  description = "Create, review, and manage pull requests";

  phases: WorkflowPhase[] = [
    {
      id: "prepare",
      name: "Prepare Changes",
      description: "Review and stage changes for commit",
      agent: "explorer",
      required: true,
      maxIterations: 1,
    },
    {
      id: "commit",
      name: "Commit",
      description: "Create meaningful commit(s)",
      agent: "coder",
      required: true,
      maxIterations: 1,
    },
    {
      id: "push",
      name: "Push",
      description: "Push changes to remote",
      agent: "coder",
      required: true,
      maxIterations: 1,
    },
    {
      id: "create-pr",
      name: "Create PR",
      description: "Create pull request with description",
      agent: "coder",
      required: true,
      maxIterations: 1,
    },
    {
      id: "self-review",
      name: "Self Review",
      description: "Review changes before requesting review",
      agent: "reviewer",
      parallel: true,
      required: false,
      maxIterations: 1,
    },
  ];

  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry);
  }

  /**
   * Execute PR workflow
   */
  async execute(description: string, options: PRWorkflowOptions = {}): Promise<WorkflowResult> {
    log.info(`Starting PR workflow: ${description.substring(0, 50)}...`);

    const prOptions: WorkflowOptions = {
      maxIterationsPerPhase: 1,
      parallelReview: true,
      reviewModes: ["bugs", "security"],
      ...options,
    };

    // Enhance input with PR context
    const enhancedInput = this.buildPRInput(description, options);

    return super.execute(enhancedInput, prOptions);
  }

  /**
   * Build enhanced input for PR workflow
   */
  private buildPRInput(description: string, options: PRWorkflowOptions): string {
    let input = `Create a pull request for the following changes:\n\n${description}`;
    
    if (options.baseBranch) {
      input += `\n\nTarget branch: ${options.baseBranch}`;
    }
    
    if (options.draft) {
      input += "\n\nCreate as draft PR.";
    }

    return input;
  }

  /**
   * PR workflow doesn't need refinement loops
   */
  protected shouldRefine(): boolean {
    return false;
  }
}
