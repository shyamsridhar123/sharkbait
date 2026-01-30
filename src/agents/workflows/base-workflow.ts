/**
 * Base Workflow - Common workflow functionality with iterative refinement
 * Implements the evaluator-optimizer pattern from Anthropic's guidance
 */

import type { BaseAgent } from "../base-agent";
import type { AgentRole, PromptingMode, AgentResult } from "../types";
import type { AzureOpenAIClient } from "../../llm/azure-openai";
import type { ToolRegistry } from "../../tools";
import { AgentFactory } from "../factory";
import { ParallelExecutor } from "../parallel-executor";
import { log } from "../../utils/logger";

/**
 * Workflow phase status
 */
export type PhaseStatus = "pending" | "running" | "completed" | "failed" | "skipped";

/**
 * Workflow phase definition
 */
export interface WorkflowPhase {
  id: string;
  name: string;
  description: string;
  agent: AgentRole;
  mode?: PromptingMode;
  required: boolean;
  maxIterations?: number;
  parallel?: boolean;
}

/**
 * Phase result
 */
export interface PhaseResult {
  phase: string;
  status: PhaseStatus;
  output: string;
  iterations: number;
  durationMs: number;
  error?: string;
}

/**
 * Evaluation result for refinement loops
 */
export interface Evaluation {
  approved: boolean;
  severity: "none" | "minor" | "major" | "critical";
  issues: Issue[];
  suggestions: string[];
}

/**
 * Issue found during evaluation
 */
export interface Issue {
  type: string;
  description: string;
  location?: string;
  severity: "minor" | "major" | "critical";
}

/**
 * Workflow execution options
 */
export interface WorkflowOptions {
  maxIterationsPerPhase?: number;
  parallelReview?: boolean;
  reviewModes?: PromptingMode[];
  dryRun?: boolean;
  onPhaseStart?: (phase: WorkflowPhase) => void;
  onPhaseComplete?: (phase: WorkflowPhase, result: PhaseResult) => void;
  onRefinement?: (iteration: number, evaluation: Evaluation) => void;
}

/**
 * Workflow result
 */
export interface WorkflowResult {
  success: boolean;
  phases: PhaseResult[];
  totalDurationMs: number;
  error?: string;
}

/**
 * Base workflow class with iterative refinement support
 */
export abstract class BaseWorkflow {
  protected llm: AzureOpenAIClient;
  protected toolRegistry: ToolRegistry;
  protected agentFactory: AgentFactory;
  protected agents: Map<AgentRole, BaseAgent>;
  protected parallelExecutor: ParallelExecutor;

  abstract name: string;
  abstract description: string;
  abstract phases: WorkflowPhase[];

  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    this.llm = llm;
    this.toolRegistry = toolRegistry;
    this.agentFactory = new AgentFactory(llm, toolRegistry);
    this.agents = this.agentFactory.createAll();
    this.parallelExecutor = new ParallelExecutor(this.agents);
  }

  /**
   * Execute the workflow
   */
  async execute(input: string, options: WorkflowOptions = {}): Promise<WorkflowResult> {
    const startTime = Date.now();
    const results: PhaseResult[] = [];
    let lastOutput = input;

    log.info(`Starting workflow: ${this.name}`);

    for (const phase of this.phases) {
      options.onPhaseStart?.(phase);
      
      try {
        const result = await this.executePhase(phase, lastOutput, options);
        results.push(result);
        options.onPhaseComplete?.(phase, result);

        if (result.status === "failed" && phase.required) {
          return {
            success: false,
            phases: results,
            totalDurationMs: Date.now() - startTime,
            error: `Required phase '${phase.name}' failed: ${result.error}`,
          };
        }

        if (result.status === "completed") {
          lastOutput = result.output;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        results.push({
          phase: phase.id,
          status: "failed",
          output: "",
          iterations: 0,
          durationMs: 0,
          error: errorMsg,
        });

        if (phase.required) {
          return {
            success: false,
            phases: results,
            totalDurationMs: Date.now() - startTime,
            error: `Phase '${phase.name}' threw error: ${errorMsg}`,
          };
        }
      }
    }

    log.info(`Workflow ${this.name} completed successfully`);

    return {
      success: true,
      phases: results,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Execute a single phase with optional refinement loop
   */
  protected async executePhase(
    phase: WorkflowPhase,
    input: string,
    options: WorkflowOptions
  ): Promise<PhaseResult> {
    const startTime = Date.now();
    const maxIterations = phase.maxIterations || options.maxIterationsPerPhase || 3;
    
    log.debug(`Executing phase: ${phase.name}`);

    const agent = this.agents.get(phase.agent);
    if (!agent) {
      throw new Error(`Agent not found: ${phase.agent}`);
    }

    // Set mode if specified
    if (phase.mode && agent.supportsMode(phase.mode)) {
      agent.setMode(phase.mode);
    }

    let output = "";
    let iterations = 0;

    // Initial execution
    for await (const event of agent.run(input)) {
      if (event.type === "text") {
        output += event.content;
      } else if (event.type === "done") {
        break;
      } else if (event.type === "error") {
        return {
          phase: phase.id,
          status: "failed",
          output,
          iterations: 1,
          durationMs: Date.now() - startTime,
          error: event.message,
        };
      }
    }
    iterations++;

    // Refinement loop (if this phase needs review)
    if (this.shouldRefine(phase) && !options.dryRun) {
      const refinementResult = await this.refineOutput(
        phase,
        output,
        maxIterations - 1,
        options
      );
      output = refinementResult.output;
      iterations += refinementResult.iterations;
    }

    return {
      phase: phase.id,
      status: "completed",
      output,
      iterations,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Determine if a phase output should go through refinement
   */
  protected shouldRefine(phase: WorkflowPhase): boolean {
    // Override in subclasses - typically coder phases get refined
    return phase.agent === "coder";
  }

  /**
   * Refine output through evaluator-optimizer loop
   */
  protected async refineOutput(
    phase: WorkflowPhase,
    output: string,
    maxIterations: number,
    options: WorkflowOptions
  ): Promise<{ output: string; iterations: number }> {
    let currentOutput = output;
    let iterations = 0;

    for (let i = 0; i < maxIterations; i++) {
      // Evaluate current output
      const evaluation = await this.evaluate(currentOutput, options);
      iterations++;
      
      options.onRefinement?.(i + 1, evaluation);

      if (evaluation.approved) {
        log.debug(`Output approved after ${iterations} refinement(s)`);
        break;
      }

      if (evaluation.severity !== "critical" && evaluation.severity !== "major") {
        // Minor issues - accept with notes
        log.debug("Minor issues found, accepting output");
        break;
      }

      // Improve based on feedback
      currentOutput = await this.improve(currentOutput, evaluation, phase);
      iterations++;
    }

    return { output: currentOutput, iterations };
  }

  /**
   * Evaluate output using reviewer agent
   */
  protected async evaluate(output: string, options: WorkflowOptions): Promise<Evaluation> {
    const reviewModes = options.reviewModes || ["bugs", "security"];

    if (options.parallelReview && reviewModes.length > 1) {
      // Parallel review execution
      const invocations = reviewModes.map(mode => ({
        agent: "reviewer" as const,
        mode: mode as PromptingMode,
        input: `Review this code:\n\n${output}`,
        weight: mode === "security" ? 1.5 : 1.0,
      }));

      const result = await this.parallelExecutor.execute({
        agents: invocations,
        strategy: "all",
        consolidation: "merge",
        timeout: 60000,
      });

      return this.parseEvaluation(result.consolidated || "");
    } else {
      // Sequential review
      const reviewer = this.agents.get("reviewer");
      if (!reviewer) {
        return { approved: true, severity: "none", issues: [], suggestions: [] };
      }

      let reviewOutput = "";
      for await (const event of reviewer.run(`Review this code for issues:\n\n${output}`)) {
        if (event.type === "text") {
          reviewOutput += event.content;
        }
      }

      return this.parseEvaluation(reviewOutput);
    }
  }

  /**
   * Parse evaluation from reviewer output
   */
  protected parseEvaluation(reviewOutput: string): Evaluation {
    const issues: Issue[] = [];
    const suggestions: string[] = [];
    
    // Simple parsing - look for issue patterns
    const criticalPatterns = [/critical/i, /security vulnerability/i, /injection/i, /crash/i];
    const majorPatterns = [/bug/i, /error/i, /incorrect/i, /wrong/i];
    const minorPatterns = [/style/i, /convention/i, /naming/i, /cleanup/i];

    let severity: "none" | "minor" | "major" | "critical" = "none";

    for (const pattern of criticalPatterns) {
      if (pattern.test(reviewOutput)) {
        severity = "critical";
        issues.push({
          type: "critical",
          description: `Critical issue detected: ${pattern.source}`,
          severity: "critical",
        });
      }
    }

    if (severity !== "critical") {
      for (const pattern of majorPatterns) {
        if (pattern.test(reviewOutput)) {
          severity = "major";
          issues.push({
            type: "major",
            description: `Issue detected: ${pattern.source}`,
            severity: "major",
          });
        }
      }
    }

    if (severity === "none") {
      for (const pattern of minorPatterns) {
        if (pattern.test(reviewOutput)) {
          severity = "minor";
          issues.push({
            type: "minor",
            description: `Minor issue: ${pattern.source}`,
            severity: "minor",
          });
        }
      }
    }

    // Check for approval signals
    const approvalPatterns = [/looks good/i, /approved/i, /no issues/i, /lgtm/i];
    const approved = approvalPatterns.some(p => p.test(reviewOutput)) || severity === "none";

    return { approved, severity, issues, suggestions };
  }

  /**
   * Improve output based on evaluation feedback
   */
  protected async improve(
    output: string,
    evaluation: Evaluation,
    phase: WorkflowPhase
  ): Promise<string> {
    const coder = this.agents.get("coder");
    if (!coder) {
      return output;
    }

    const feedback = evaluation.issues
      .map(i => `- [${i.severity}] ${i.description}`)
      .join("\n");

    const prompt = `Fix the following issues in this code:

**Issues Found:**
${feedback}

**Code to Fix:**
${output}

Provide the corrected code.`;

    let improvedOutput = "";
    for await (const event of coder.run(prompt)) {
      if (event.type === "text") {
        improvedOutput += event.content;
      }
    }

    return improvedOutput || output;
  }
}
