/**
 * Agent class - main entry point for the AI coding assistant
 */

import { AzureOpenAIClient } from "../llm/azure-openai";
import { ToolRegistry } from "../tools";
import { AgentLoop } from "./loop";
import { loadConfig } from "../utils/config";
import type { AgentEvent } from "./types";

export interface AgentOptions {
  contextFiles?: string[] | undefined;
  enableBeads?: boolean | undefined;
}

export class Agent {
  private llm: AzureOpenAIClient;
  private tools: ToolRegistry;
  private loop: AgentLoop;

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
   */
  async *run(userMessage: string): AsyncGenerator<AgentEvent> {
    yield* this.loop.run(userMessage);
  }

  /**
   * Reset the agent state for a new conversation
   */
  reset(): void {
    this.loop = new AgentLoop(this.llm, this.tools);
  }
}
