/**
 * Feature Development Workflow
 * End-to-end feature implementation with discovery, planning, coding, and review
 */

import { BaseWorkflow, type WorkflowPhase, type WorkflowOptions, type WorkflowResult } from "./base-workflow";
import type { AzureOpenAIClient } from "../../llm/azure-openai";
import type { ToolRegistry } from "../../tools";
import { log } from "../../utils/logger";

/**
 * Feature Development Workflow
 * Phases: Discover → Plan → Implement → Review → Ship
 */
export class FeatureDevWorkflow extends BaseWorkflow {
  name = "feature-dev";
  description = "End-to-end feature development with discovery, planning, implementation, and review";

  phases: WorkflowPhase[] = [
    {
      id: "discover",
      name: "Discovery",
      description: "Explore codebase and understand requirements",
      agent: "explorer",
      mode: "map",
      required: true,
      maxIterations: 1,
    },
    {
      id: "plan",
      name: "Planning",
      description: "Create implementation plan and architecture",
      agent: "planner",
      mode: "architecture",
      required: true,
      maxIterations: 1,
    },
    {
      id: "implement",
      name: "Implementation",
      description: "Write the feature code",
      agent: "coder",
      mode: "write",
      required: true,
      maxIterations: 3,
    },
    {
      id: "review",
      name: "Code Review",
      description: "Review for bugs, security, and style",
      agent: "reviewer",
      required: true,
      parallel: true,
      maxIterations: 1,
    },
    {
      id: "test",
      name: "Testing",
      description: "Write tests for the feature",
      agent: "coder",
      mode: "test",
      required: false,
      maxIterations: 2,
    },
    {
      id: "document",
      name: "Documentation",
      description: "Document the feature",
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
   * Execute feature development with enhanced context passing
   */
  async execute(featureRequest: string, options: WorkflowOptions = {}): Promise<WorkflowResult> {
    log.info(`Starting feature development: ${featureRequest.substring(0, 50)}...`);

    // Set default options for feature dev
    const featureOptions: WorkflowOptions = {
      maxIterationsPerPhase: 3,
      parallelReview: true,
      reviewModes: ["bugs", "security", "style"],
      ...options,
    };

    return super.execute(featureRequest, featureOptions);
  }

  /**
   * Feature dev refines implementation phases
   */
  protected shouldRefine(phase: WorkflowPhase): boolean {
    return phase.id === "implement" || phase.id === "test";
  }
}
