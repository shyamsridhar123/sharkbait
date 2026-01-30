/**
 * Parallel Executor - Fan-out/fan-in execution coordinator
 * Implements parallel agent execution with multiple strategies
 */

import type { 
  AgentInvocation, 
  AgentResult,
  ParallelExecutionOptions,
  ParallelExecutionResult,
  AgentRole,
  PromptingMode
} from "./types";
import type { BaseAgent } from "./base-agent";
import { log } from "../utils/logger";

/**
 * Execute agents in parallel with configurable strategies
 */
export class ParallelExecutor {
  private agents: Map<AgentRole, BaseAgent>;

  constructor(agents: Map<AgentRole, BaseAgent>) {
    this.agents = agents;
  }

  /**
   * Execute multiple agents in parallel
   */
  async execute(options: ParallelExecutionOptions): Promise<ParallelExecutionResult> {
    const startTime = Date.now();
    const { agents, strategy, consolidation, timeout = 30000, quorumThreshold = 0.5 } = options;

    log.info(`Starting parallel execution: ${agents.length} agents, strategy=${strategy}`);

    // Create promises for each agent
    const promises = agents.map(invocation => 
      this.executeOne(invocation, timeout)
    );

    let results: AgentResult[];
    let timedOut = false;

    switch (strategy) {
      case "all":
        // Wait for all agents to complete
        results = await Promise.all(promises);
        break;

      case "race":
        // Return first successful result
        const firstResult = await this.raceWithTimeout(promises, timeout);
        results = firstResult ? [firstResult] : [];
        timedOut = !firstResult;
        break;

      case "quorum":
        // Wait for majority to complete
        results = await this.waitForQuorum(promises, quorumThreshold, timeout);
        break;

      default:
        throw new Error(`Unknown parallel strategy: ${strategy}`);
    }

    // Consolidate results
    const consolidated = this.consolidate(results, consolidation, agents);

    return {
      results,
      consolidated,
      strategy,
      durationMs: Date.now() - startTime,
      timedOut,
    };
  }

  /**
   * Execute a single agent invocation
   */
  private async executeOne(
    invocation: AgentInvocation,
    timeout: number
  ): Promise<AgentResult> {
    const agent = this.agents.get(invocation.agent);
    
    if (!agent) {
      return {
        agent: invocation.agent,
        mode: invocation.mode,
        success: false,
        output: "",
        toolsCalled: [],
        tokenCount: 0,
        durationMs: 0,
        error: `Agent not found: ${invocation.agent}`,
      };
    }

    const startTime = Date.now();

    // Set mode if specified
    if (invocation.mode && agent.supportsMode(invocation.mode)) {
      agent.setMode(invocation.mode);
    }

    // Execute with timeout
    return new Promise(async (resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          agent: invocation.agent,
          mode: invocation.mode,
          success: false,
          output: "",
          toolsCalled: [],
          tokenCount: 0,
          durationMs: timeout,
          error: "Timeout",
        });
      }, timeout);

      try {
        let output = "";
        const toolsCalled: string[] = [];

        for await (const event of agent.run(invocation.input)) {
          switch (event.type) {
            case "text":
              output += event.content;
              break;
            case "tool_start":
              toolsCalled.push(event.name);
              break;
            case "done":
              clearTimeout(timeoutId);
              resolve({
                ...event.result,
                agent: invocation.agent,
                mode: invocation.mode,
              });
              return;
            case "error":
              clearTimeout(timeoutId);
              resolve({
                agent: invocation.agent,
                mode: invocation.mode,
                success: false,
                output,
                toolsCalled,
                tokenCount: 0,
                durationMs: Date.now() - startTime,
                error: event.message,
              });
              return;
          }
        }

        clearTimeout(timeoutId);
        resolve({
          agent: invocation.agent,
          mode: invocation.mode,
          success: true,
          output,
          toolsCalled,
          tokenCount: 0,
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          agent: invocation.agent,
          mode: invocation.mode,
          success: false,
          output: "",
          toolsCalled: [],
          tokenCount: 0,
          durationMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    });
  }

  /**
   * Race strategy - return first successful result
   */
  private async raceWithTimeout(
    promises: Promise<AgentResult>[],
    timeout: number
  ): Promise<AgentResult | null> {
    const timeoutPromise = new Promise<null>((resolve) => 
      setTimeout(() => resolve(null), timeout)
    );

    const racePromises = promises.map(p => 
      p.then(result => result.success ? result : null)
    );

    // Return first successful result or null on timeout
    const results = await Promise.race([
      ...racePromises.map(p => p.then(r => r ? [r] : [])),
      timeoutPromise.then(() => null),
    ]);

    return results && results.length > 0 ? (results[0] ?? null) : null;
  }

  /**
   * Quorum strategy - wait for threshold of agents to complete
   */
  private async waitForQuorum(
    promises: Promise<AgentResult>[],
    threshold: number,
    timeout: number
  ): Promise<AgentResult[]> {
    const required = Math.ceil(promises.length * threshold);
    const results: AgentResult[] = [];

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => resolve(results), timeout);

      for (const promise of promises) {
        promise.then(result => {
          if (result.success) {
            results.push(result);
            if (results.length >= required) {
              clearTimeout(timeoutId);
              resolve(results);
            }
          }
        });
      }
    });
  }

  /**
   * Consolidate results based on strategy
   */
  private consolidate(
    results: AgentResult[],
    strategy: "merge" | "vote" | "best",
    invocations: AgentInvocation[]
  ): string {
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      return "No successful results from parallel execution.";
    }

    switch (strategy) {
      case "merge":
        return this.mergeResults(successfulResults, invocations);

      case "vote":
        return this.voteResults(successfulResults, invocations);

      case "best":
        return this.selectBest(successfulResults, invocations);

      default:
        return successfulResults.map(r => r.output).join("\n\n---\n\n");
    }
  }

  /**
   * Merge strategy - combine unique findings
   */
  private mergeResults(results: AgentResult[], invocations: AgentInvocation[]): string {
    const sections: string[] = [];

    for (const result of results) {
      if (!result) continue;
      
      const header = result.mode 
        ? `## ${result.agent} (${result.mode})` 
        : `## ${result.agent}`;
      
      sections.push(`${header}\n\n${result.output}`);
    }

    return sections.join("\n\n---\n\n");
  }

  /**
   * Vote strategy - weighted majority
   */
  private voteResults(results: AgentResult[], invocations: AgentInvocation[]): string {
    // For voting, we'd need structured output to compare
    // For now, return highest weighted result
    return this.selectBest(results, invocations);
  }

  /**
   * Best strategy - select highest quality result
   */
  private selectBest(results: AgentResult[], invocations: AgentInvocation[]): string {
    let best: AgentResult | null = null;
    let bestScore = -1;

    for (const result of results) {
      const invocation = invocations.find(inv => 
        inv.agent === result.agent && inv.mode === result.mode
      );
      
      const weight = invocation?.weight ?? 1;
      
      // Simple scoring: output length * weight (could be more sophisticated)
      const score = result.output.length * weight;
      
      if (score > bestScore) {
        bestScore = score;
        best = result;
      }
    }

    return best?.output ?? "";
  }
}

/**
 * Convenience function for parallel code review
 */
export async function parallelReview(
  executor: ParallelExecutor,
  input: string
): Promise<ParallelExecutionResult> {
  return executor.execute({
    agents: [
      { agent: "reviewer", mode: "bugs", input, weight: 1.0 },
      { agent: "reviewer", mode: "security", input, weight: 1.5 },
      { agent: "reviewer", mode: "style", input, weight: 0.5 },
      { agent: "reviewer", mode: "performance", input, weight: 0.8 },
    ],
    strategy: "all",
    consolidation: "merge",
    timeout: 60000,
  });
}
