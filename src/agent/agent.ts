/**
 * Agent class - main entry point for the AI coding assistant
 * Now with orchestrator-based routing for specialized agent delegation
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
} from "../agents";
import { globalHooks, registerBuiltinHooks } from "../hooks";
import { globalSkills } from "../skills";
import { log } from "../utils/logger";

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

    // Initialize orchestrator if enabled
    if (this.useOrchestrator) {
      const factory = new AgentFactory(this.llm, this.tools);
      this.orchestrator = factory.createOrchestrator();
      log.info("Orchestrator-based routing enabled");
    }

    // Register built-in hooks if enabled
    if (options.enableHooks !== false) {
      registerBuiltinHooks();
    }
  }

  /**
   * Run a single query and return the response
   */
  async ask(question: string): Promise<string> {
    let response = "";
    for await (const event of this.run(question)) {
      if (event.type === "text") {
        response += event.content;
      }
    }
    return response;
  }

  /**
   * Run a query with streaming events
   * Uses orchestrator routing when enabled
   */
  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    // Execute user input hooks
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

    // Check for workflow triggers
    const workflowResult = this.detectWorkflow(processedInput);
    if (workflowResult) {
      yield* this.runWorkflow(workflowResult.workflow, workflowResult.input);
      return;
    }

    // Use orchestrator routing if enabled
    if (this.useOrchestrator && this.orchestrator) {
      yield* this.runWithOrchestrator(processedInput);
      return;
    }

    // Default: use agent loop directly
    yield* this.loop.run(processedInput);
  }

  /**
   * Run with orchestrator-based agent routing
   */
  private async *runWithOrchestrator(input: string): AsyncGenerator<AgentEvent> {
    if (!this.orchestrator) {
      yield* this.loop.run(input);
      return;
    }

    // Classify intent
    const classification = this.orchestrator.classifyIntent(input);
    log.debug(`Intent: ${classification.suggestedAgent} (${classification.confidence}%)`);

    // If confidence is low or it's a general request, use default loop
    if (classification.confidence < 70 || classification.suggestedAgent === "orchestrator") {
      yield* this.loop.run(input);
      return;
    }

    // Delegate to specialized agent
    const agent = this.orchestrator.getAgent(classification.suggestedAgent);
    if (!agent) {
      yield* this.loop.run(input);
      return;
    }

    // Set mode if detected
    if (classification.suggestedMode && agent.supportsMode(classification.suggestedMode)) {
      agent.setMode(classification.suggestedMode);
    }

    yield { 
      type: "agent_switch", 
      agent: classification.suggestedAgent,
      mode: classification.suggestedMode,
    };

    // Run the specialized agent
    for await (const event of agent.run(input)) {
      yield event;
    }
  }

  /**
   * Detect if input should trigger a workflow
   */
  private detectWorkflow(input: string): { workflow: string; input: string } | null {
    const lowerInput = input.toLowerCase();

    // Feature development patterns
    if (/\b(implement|add|create|build)\s+(a\s+)?(new\s+)?feature\b/i.test(input)) {
      return { workflow: "feature-dev", input };
    }

    // PR patterns
    if (/\b(create|open|submit)\s+(a\s+)?(pull request|pr)\b/i.test(input)) {
      return { workflow: "pr", input };
    }

    // Bug fix patterns
    if (/\b(fix|debug|diagnose|troubleshoot)\s+(the\s+|this\s+)?(bug|error|issue)\b/i.test(input)) {
      return { workflow: "bug-fix", input };
    }

    // Refactor patterns
    if (/\b(refactor|restructure|reorganize|cleanup)\b/i.test(input)) {
      return { workflow: "refactor", input };
    }

    return null;
  }

  /**
   * Run a specific workflow
   */
  private async *runWorkflow(workflowName: string, input: string): AsyncGenerator<AgentEvent> {
    yield { type: "workflow_start", workflow: workflowName };

    try {
      let result;

      switch (workflowName) {
        case "feature-dev": {
          const workflow = new FeatureDevWorkflow(this.llm, this.tools);
          result = await workflow.execute(input, {
            onPhaseStart: (phase) => {
              log.debug(`Phase started: ${phase.name}`);
            },
            onPhaseComplete: (phase, phaseResult) => {
              log.debug(`Phase completed: ${phase.name} - ${phaseResult.status}`);
            },
          });
          break;
        }
        case "pr": {
          const workflow = new PRWorkflow(this.llm, this.tools);
          result = await workflow.execute(input);
          break;
        }
        case "bug-fix": {
          const workflow = new BugFixWorkflow(this.llm, this.tools);
          result = await workflow.execute(input);
          break;
        }
        case "refactor": {
          const workflow = new RefactorWorkflow(this.llm, this.tools);
          result = await workflow.execute(input);
          break;
        }
        default:
          yield { type: "error", message: `Unknown workflow: ${workflowName}` };
          return;
      }

      // Report workflow result
      if (result.success) {
        const phasesSummary = result.phases
          .map(p => `- ${p.phase}: ${p.status}`)
          .join("\n");
        yield { 
          type: "text", 
          content: `✅ Workflow "${workflowName}" completed successfully!\n\n**Phases:**\n${phasesSummary}\n\nDuration: ${(result.totalDurationMs / 1000).toFixed(1)}s` 
        };
      } else {
        yield { 
          type: "text", 
          content: `❌ Workflow "${workflowName}" failed: ${result.error}` 
        };
      }

      yield { type: "workflow_complete", workflow: workflowName, success: result.success };
      yield { type: "done" };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      yield { type: "error", message: `Workflow failed: ${msg}` };
    }
  }

  /**
   * Reset the agent state for a new conversation
   */
  reset(): void {
    this.loop = new AgentLoop(this.llm, this.tools);
    
    if (this.useOrchestrator) {
      const factory = new AgentFactory(this.llm, this.tools);
      this.orchestrator = factory.createOrchestrator();
    }
  }

  /**
   * Get relevant skills for current context
   */
  getRelevantSkills(context: { language?: string; keywords?: string[] }) {
    return globalSkills.findRelevant(context);
  }
}
