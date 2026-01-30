/**
 * Agent Factory - Creates and configures agent instances
 */

import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { AgentRole } from "./types";
import { BaseAgent } from "./base-agent";
import { OrchestratorAgent } from "./orchestrator";
import { CoderAgent } from "./coder";
import { ReviewerAgent } from "./reviewer";
import { PlannerAgent } from "./planner";
import { DebuggerAgent } from "./debugger";
import { ExplorerAgent } from "./explorer";
import { log } from "../utils/logger";

/**
 * Agent Factory - Creates agent instances with proper configuration
 */
export class AgentFactory {
  private llm: AzureOpenAIClient;
  private toolRegistry: ToolRegistry;

  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    this.llm = llm;
    this.toolRegistry = toolRegistry;
  }

  /**
   * Create a specific agent by role
   */
  create(role: AgentRole): BaseAgent {
    log.debug(`Creating agent: ${role}`);
    
    switch (role) {
      case "orchestrator":
        return new OrchestratorAgent(this.llm, this.toolRegistry);
      case "coder":
        return new CoderAgent(this.llm, this.toolRegistry);
      case "reviewer":
        return new ReviewerAgent(this.llm, this.toolRegistry);
      case "planner":
        return new PlannerAgent(this.llm, this.toolRegistry);
      case "debugger":
        return new DebuggerAgent(this.llm, this.toolRegistry);
      case "explorer":
        return new ExplorerAgent(this.llm, this.toolRegistry);
      default:
        throw new Error(`Unknown agent role: ${role}`);
    }
  }

  /**
   * Create and configure a fully populated orchestrator with all agents
   */
  createOrchestrator(): OrchestratorAgent {
    const orchestrator = new OrchestratorAgent(this.llm, this.toolRegistry);
    
    // Register all specialized agents
    const roles: AgentRole[] = ["coder", "reviewer", "planner", "debugger", "explorer"];
    
    for (const role of roles) {
      const agent = this.create(role);
      orchestrator.registerAgent(role, agent);
    }
    
    log.info("Orchestrator created with all agents registered");
    return orchestrator;
  }

  /**
   * Create all agents as a map
   */
  createAll(): Map<AgentRole, BaseAgent> {
    const agents = new Map<AgentRole, BaseAgent>();
    
    const roles: AgentRole[] = [
      "orchestrator",
      "coder", 
      "reviewer", 
      "planner", 
      "debugger", 
      "explorer"
    ];
    
    for (const role of roles) {
      agents.set(role, this.create(role));
    }
    
    return agents;
  }
}
