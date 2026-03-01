/**
 * Agent class - main entry point for the AI coding assistant
 * Now with:
 * - Orchestrator-based routing for specialized agent delegation
 * - Workflow registry (Open/Closed principle — no more switch statements)
 * - Hooks properly initialized
 */

import { AzureOpenAIClient } from "../llm/azure-openai";
import { ToolRegistry } from "../tools";
import { AgentLoop } from "./loop";
import { loadConfig } from "../utils/config";
import type { AgentEvent } from "./types";
import {
  AgentFactory,
  OrchestratorAgent,
  FeatureDevWorkflow,
  PRWorkflow,
  BugFixWorkflow,
  RefactorWorkflow,
  type BaseWorkflow,
} from "../agents";
import { globalHooks, registerBuiltinHooks } from "../hooks";
import { globalSkills } from "../skills";
import { log } from "../utils/logger";
import { getErrorMessage } from "../utils/security";

// ─── Workflow Registry ─────────────────────────────────────────────────────────

interface WorkflowRegistration {
  patterns: RegExp[];
  create: (llm: AzureOpenAIClient, tools: ToolRegistry) => BaseWorkflow;
}

const WORKFLOW_REGISTRY: Map<string, WorkflowRegistration> = new Map([
  [
    "feature-dev",
    {
      patterns: [/\b(implement|add|create|build)\s+(a\s+)?(new\s+)?feature\b/i],
      create: (llm, tools) => new FeatureDevWorkflow(llm, tools),
    },
  ],
  [
    "pr",
    {
      patterns: [/\b(create|open|submit)\s+(a\s+)?(pull request|pr)\b/i],
      create: (llm, tools) => new PRWorkflow(llm, tools),
    },
  ],
  [
    "bug-fix",
    {
      patterns: [/\b(fix|debug|diagnose|troubleshoot)\s+(the\s+|this\s+)?(bug|error|issue)\b/i],
      create: (llm, tools) => new BugFixWorkflow(llm, tools),
    },
  ],
  [
    "refactor",
    {
      patterns: [/\b(refactor|restructure|reorganize|cleanup)\b/i],
      create: (llm, tools) => new RefactorWorkflow(llm, tools),
    },
  ],
]);

// ─── Agent Class ───────────────────────────────────────────────────────────────

export interface AgentOptions {
  contextFiles?: string[] | undefined;
  enableBeads?: boolean | undefined;
  useOrchestrator?: boolean | undefined;
  enableHooks?: boolean | undefined;
}

export class Agent {
  private llm: AzureOpenAIClient;
  private tools: ToolRegistry;
  private loop: AgentLoop;
  private orchestrator: OrchestratorAgent | null = null;
  private useOrchestrator: boolean;

  constructor(options: AgentOptions = {}) {
    const config = loadConfig();

    this.llm = new AzureOpenAIClient({
      endpoint: config.azure.endpoint,
      apiKey: config.azure.apiKey,
      deployment: config.azure.deployment,
      apiVersion: config.azure.apiVersion,
    });

    this.tools = new ToolRegistry({
      enableBeads: options.enableBeads ?? config.features.beads,
    });

    this.loop = new AgentLoop(this.llm, this.tools);
    this.useOrchestrator = options.useOrchestrator ?? false;

    if (this.useOrchestrator) {
      const factory = new AgentFactory(this.llm, this.tools);
      this.orchestrator = factory.createOrchestrator();
      log.info("Orchestrator-based routing enabled");
    }

    if (options.enableHooks !== false) {
      registerBuiltinHooks();
    }
  }

  /**
   * Register a custom workflow. Allows extending available workflows
   * without modifying this class (Open/Closed principle).
   */
  static registerWorkflow(
    name: string,
    patterns: RegExp[],
    create: (llm: AzureOpenAIClient, tools: ToolRegistry) => BaseWorkflow
  ): void {
    WORKFLOW_REGISTRY.set(name, { patterns, create });
  }

  async ask(question: string): Promise<string> {
    let response = "";
    for await (const event of this.run(question)) {
      if (event.type === "text") {
        response += event.content;
      }
    }
    return response;
  }

  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    const inputResult = await globalHooks.executeOnUserInput({
      input: userMessage,
      sessionId: crypto.randomUUID(),
    });

    if (inputResult.skipProcessing) {
      yield { type: "text", content: inputResult.reason || "Processing skipped by hook" };
      yield { type: "done" };
      return;
    }

    const processedInput = inputResult.modifiedInput || userMessage;

    // Check for workflow triggers (uses registry, not switch)
    const workflowMatch = this.detectWorkflow(processedInput);
    if (workflowMatch) {
      yield* this.runWorkflow(workflowMatch.name, workflowMatch.input);
      return;
    }

    if (this.useOrchestrator && this.orchestrator) {
      yield* this.runWithOrchestrator(processedInput);
      return;
    }

    yield* this.loop.run(processedInput);
  }

  private async *runWithOrchestrator(input: string): AsyncGenerator<AgentEvent> {
    if (!this.orchestrator) {
      yield* this.loop.run(input);
      return;
    }

    const classification = this.orchestrator.classifyIntent(input);
    log.debug(`Intent: ${classification.suggestedAgent} (${classification.confidence}%)`);

    if (classification.confidence < 70 || classification.suggestedAgent === "orchestrator") {
      yield* this.loop.run(input);
      return;
    }

    const agent = this.orchestrator.getAgent(classification.suggestedAgent);
    if (!agent) {
      yield* this.loop.run(input);
      return;
    }

    if (classification.suggestedMode && agent.supportsMode(classification.suggestedMode)) {
      agent.setMode(classification.suggestedMode);
    }

    yield {
      type: "agent_switch",
      agent: classification.suggestedAgent,
      mode: classification.suggestedMode,
    };

    for await (const event of agent.run(input)) {
      yield event;
    }
  }

  /**
   * Detect if input should trigger a workflow (uses registry)
   */
  private detectWorkflow(input: string): { name: string; input: string } | null {
    for (const [name, registration] of WORKFLOW_REGISTRY) {
      for (const pattern of registration.patterns) {
        if (pattern.test(input)) {
          return { name, input };
        }
      }
    }
    return null;
  }

  /**
   * Run a specific workflow (uses registry — no more switch statement)
   */
  private async *runWorkflow(workflowName: string, input: string): AsyncGenerator<AgentEvent> {
    yield { type: "workflow_start", workflow: workflowName };

    const registration = WORKFLOW_REGISTRY.get(workflowName);
    if (!registration) {
      yield { type: "error", message: `Unknown workflow: ${workflowName}` };
      return;
    }

    try {
      const workflow = registration.create(this.llm, this.tools);
      const result = await workflow.execute(input, {
        onPhaseStart: (phase) => log.debug(`Phase started: ${phase.name}`),
        onPhaseComplete: (phase, phaseResult) =>
          log.debug(`Phase completed: ${phase.name} - ${phaseResult.status}`),
      });

      if (result.success) {
        const phasesSummary = result.phases
          .map((p) => `- ${p.phase}: ${p.status}`)
          .join("\n");
        yield {
          type: "text",
          content: `Workflow "${workflowName}" completed!\n\n**Phases:**\n${phasesSummary}\n\nDuration: ${(result.totalDurationMs / 1000).toFixed(1)}s`,
        };
      } else {
        yield {
          type: "text",
          content: `Workflow "${workflowName}" failed: ${result.error}`,
        };
      }

      yield { type: "workflow_complete", workflow: workflowName, success: result.success };
      yield { type: "done" };
    } catch (error) {
      yield { type: "error", message: `Workflow failed: ${getErrorMessage(error)}` };
    }
  }

  reset(): void {
    this.loop = new AgentLoop(this.llm, this.tools);

    if (this.useOrchestrator) {
      const factory = new AgentFactory(this.llm, this.tools);
      this.orchestrator = factory.createOrchestrator();
    }
  }

  getRelevantSkills(context: { language?: string; keywords?: string[] }) {
    return globalSkills.findRelevant(context);
  }
}
