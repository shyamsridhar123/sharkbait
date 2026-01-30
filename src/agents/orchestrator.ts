/**
 * Orchestrator Agent - Central coordinator with dual-ledger progress tracking
 * Inspired by Microsoft Research Magentic-One
 */

import { BaseAgent } from "./base-agent";
import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { 
  AgentRole, 
  PromptingMode,
  IntentClassification,
  IntentPattern,
  AgentStreamEvent,
  AgentResult 
} from "./types";
import { ORCHESTRATOR_PROMPT } from "./prompts";
import { log } from "../utils/logger";

/**
 * Intent patterns for routing to specialized agents
 */
const INTENT_PATTERNS: IntentPattern[] = [
  // Debugger patterns
  { 
    patterns: [/\bfix\b/i, /\bdebug\b/i, /\berror\b/i, /\bbroken\b/i, /\bfailing\b/i, /\bnot working\b/i, /\bcrash\b/i, /\bbug\b/i],
    agent: "debugger"
  },
  // Coder patterns
  {
    patterns: [/\badd\b/i, /\bimplement\b/i, /\bcreate\b/i, /\bbuild\b/i, /\bwrite\b/i, /\bgenerate\b/i, /\bmake\b/i],
    agent: "coder"
  },
  // Reviewer patterns
  {
    patterns: [/\breview\b/i, /\bcheck\b/i, /\baudit\b/i, /\blook for bugs\b/i, /\bsecurity\b/i, /\bcode review\b/i],
    agent: "reviewer"
  },
  // Planner patterns
  {
    patterns: [/\bplan\b/i, /\bdesign\b/i, /\barchitect\b/i, /\bbreak down\b/i, /\bhow should\b/i, /\bstrategy\b/i],
    agent: "planner"
  },
  // Explorer patterns
  {
    patterns: [/\bexplain\b/i, /\bhow does\b/i, /\bunderstand\b/i, /\btrace\b/i, /\bfind\b/i, /\bwhat is\b/i, /\bshow me\b/i],
    agent: "explorer"
  },
];

/**
 * Mode detection patterns
 */
const MODE_PATTERNS: Array<{ patterns: RegExp[]; mode: PromptingMode }> = [
  // Coder modes
  { patterns: [/\brefactor\b/i, /\bclean up\b/i, /\bimprove\b/i], mode: "refactor" },
  { patterns: [/\btest\b/i, /\bunit test\b/i, /\bwrite tests\b/i], mode: "test" },
  { patterns: [/\bdocument\b/i, /\bdocs\b/i, /\bcomments\b/i], mode: "docs" },
  
  // Reviewer modes
  { patterns: [/\bsecurity\b/i, /\bvulnerab\b/i], mode: "security" },
  { patterns: [/\bperformance\b/i, /\bslow\b/i, /\boptimize\b/i], mode: "performance" },
  { patterns: [/\bstyle\b/i, /\blint\b/i, /\bformat\b/i], mode: "style" },
  
  // Planner modes  
  { patterns: [/\barchitect\b/i, /\bsystem design\b/i], mode: "architecture" },
  { patterns: [/\bestimate\b/i, /\bhow long\b/i, /\btime\b/i], mode: "estimate" },
  
  // Debugger modes
  { patterns: [/\btrace\b/i, /\bstack\b/i], mode: "trace" },
  
  // Explorer modes
  { patterns: [/\bdependenc\b/i, /\bimports\b/i], mode: "dependencies" },
  { patterns: [/\bpattern\b/i], mode: "patterns" },
];

/**
 * Orchestrator Agent - Routes requests and coordinates other agents
 */
export class OrchestratorAgent extends BaseAgent {
  private agentRegistry: Map<AgentRole, BaseAgent> = new Map();
  
  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry, {
      name: "orchestrator",
      description: "Central coordinator that routes requests to specialized agents",
      color: "blue",
      tools: ["*"], // Full access to all tools
      systemPrompt: ORCHESTRATOR_PROMPT,
      modes: [],
    });
  }

  /**
   * Register a specialized agent for delegation
   */
  registerAgent(role: AgentRole, agent: BaseAgent): void {
    this.agentRegistry.set(role, agent);
    log.debug(`Registered agent: ${role}`);
  }

  /**
   * Get a registered agent
   */
  getAgent(role: AgentRole): BaseAgent | undefined {
    return this.agentRegistry.get(role);
  }

  /**
   * Classify user intent to determine routing
   */
  classifyIntent(input: string): IntentClassification {
    let bestMatch: IntentClassification = {
      primaryIntent: "general",
      suggestedAgent: "orchestrator",
      confidence: 50,
      reasoning: "No specific intent detected, handling directly",
    };

    // Check each intent pattern
    for (const pattern of INTENT_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          const confidence = this.calculateConfidence(input, regex);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              primaryIntent: this.extractIntent(input, regex),
              suggestedAgent: pattern.agent,
              suggestedMode: this.detectMode(input),
              confidence,
              reasoning: `Matched pattern: ${regex.source}`,
            };
          }
        }
      }
    }

    log.debug(`Intent classified: ${bestMatch.suggestedAgent} (${bestMatch.confidence}%)`);
    return bestMatch;
  }

  /**
   * Calculate confidence score based on match quality
   */
  private calculateConfidence(input: string, regex: RegExp): number {
    const match = input.match(regex);
    if (!match) return 0;
    
    // Base confidence
    let confidence = 70;
    
    // Boost for early match (intent at start of sentence)
    const matchIndex = input.toLowerCase().indexOf(match[0].toLowerCase());
    if (matchIndex < 20) confidence += 10;
    
    // Boost for short, focused queries
    if (input.length < 100) confidence += 10;
    
    // Boost for imperative mood (starts with verb)
    if (matchIndex === 0) confidence += 5;
    
    return Math.min(confidence, 95);
  }

  /**
   * Extract the primary intent description
   */
  private extractIntent(input: string, regex: RegExp): string {
    const match = input.match(regex);
    return match ? match[0].toLowerCase() : "general";
  }

  /**
   * Detect prompting mode from input
   */
  private detectMode(input: string): PromptingMode | undefined {
    for (const pattern of MODE_PATTERNS) {
      for (const regex of pattern.patterns) {
        if (regex.test(input)) {
          return pattern.mode;
        }
      }
    }
    return undefined;
  }

  /**
   * Override run to add routing logic
   */
  async *run(input: string): AsyncGenerator<AgentStreamEvent> {
    // Classify intent
    const intent = this.classifyIntent(input);
    
    // If high confidence and we have that agent, delegate
    if (intent.confidence >= 75 && intent.suggestedAgent !== "orchestrator") {
      const agent = this.agentRegistry.get(intent.suggestedAgent);
      
      if (agent) {
        log.info(`Delegating to ${intent.suggestedAgent} agent`);
        
        // Set mode if detected
        if (intent.suggestedMode && agent.supportsMode(intent.suggestedMode)) {
          agent.setMode(intent.suggestedMode);
        }
        
        // Yield handoff event
        yield { 
          type: "handoff", 
          from: "orchestrator", 
          to: intent.suggestedAgent 
        };
        
        // Delegate to the specialized agent
        for await (const event of agent.run(input)) {
          yield event;
        }
        return;
      }
    }
    
    // Handle directly with base agent behavior
    for await (const event of super.run(input)) {
      yield event;
    }
  }

  /**
   * Dispatch to a specific agent (for explicit routing)
   */
  async *dispatch(
    role: AgentRole, 
    input: string,
    mode?: PromptingMode
  ): AsyncGenerator<AgentStreamEvent> {
    const agent = this.agentRegistry.get(role);
    
    if (!agent) {
      yield { 
        type: "error", 
        message: `Agent not found: ${role}` 
      };
      return;
    }
    
    if (mode && agent.supportsMode(mode)) {
      agent.setMode(mode);
    }
    
    yield { type: "handoff", from: "orchestrator", to: role };
    
    for await (const event of agent.run(input)) {
      yield event;
    }
  }
}
