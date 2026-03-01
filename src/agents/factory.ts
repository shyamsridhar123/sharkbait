/**
 * Agent Factory - Creates and configures agent instances
 * Uses registration-based approach instead of switch statements (Open/Closed principle)
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
 * Constructor signature for agent classes
 */
type AgentConstructor = new (
  llm: AzureOpenAIClient,
  toolRegistry: ToolRegistry
) => BaseAgent;

/**
 * Default agent constructors — new agent types can be added without modifying the factory
 */
function createDefaultConstructors(): Map<AgentRole, AgentConstructor> {
  const m = new Map<AgentRole, AgentConstructor>();
  m.set("orchestrator", OrchestratorAgent as unknown as AgentConstructor);
  m.set("coder", CoderAgent as unknown as AgentConstructor);
  m.set("reviewer", ReviewerAgent as unknown as AgentConstructor);
  m.set("planner", PlannerAgent as unknown as AgentConstructor);
  m.set("debugger", DebuggerAgent as unknown as AgentConstructor);
  m.set("explorer", ExplorerAgent as unknown as AgentConstructor);
  return m;
}

export class AgentFactory {
  private llm: AzureOpenAIClient;
  private toolRegistry: ToolRegistry;
  private constructors: Map<AgentRole, AgentConstructor>;

  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    this.llm = llm;
    this.toolRegistry = toolRegistry;
    this.constructors = createDefaultConstructors();
  }

  /**
   * Register a custom agent constructor for a role.
   * Allows extending the system without modifying the factory.
   */
  registerAgent(role: AgentRole, constructor: AgentConstructor): void {
    this.constructors.set(role, constructor);
    log.debug(`Registered custom agent constructor for role: ${role}`);
  }

  /**
   * Create a specific agent by role
   */
  create(role: AgentRole): BaseAgent {
    const Constructor = this.constructors.get(role);
    if (!Constructor) {
      throw new Error(`Unknown agent role: ${role}. Available: ${[...this.constructors.keys()].join(", ")}`);
    }

    log.debug(`Creating agent: ${role}`);
    return new Constructor(this.llm, this.toolRegistry);
  }

  /**
   * Create and configure a fully populated orchestrator with all agents
   */
  createOrchestrator(): OrchestratorAgent {
    const orchestrator = new OrchestratorAgent(this.llm, this.toolRegistry);

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

    for (const role of this.constructors.keys()) {
      agents.set(role, this.create(role));
    }

    return agents;
  }
}
