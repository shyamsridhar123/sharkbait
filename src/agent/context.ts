/**
 * Context Manager - Intelligent context compaction for token management
 * Preserves critical context while compacting less important information
 */

import type { Message } from "../llm/types";
import type { TaskLedger } from "./progress";
import { log } from "../utils/logger";

export interface ContextConfig {
  maxTokens: number;              // Total context window (e.g., 128000)
  reservedForResponse: number;    // Tokens reserved for model response (e.g., 16000)
  compactionThreshold: number;    // When to trigger compaction (e.g., 0.85)
}

export interface FileContext {
  path: string;
  content: string;
  lastModified: Date;
}

export interface ErrorContext {
  error: string;
  timestamp: Date;
  toolName?: string;
}

export interface PreservedContext {
  // These are NEVER compacted
  systemPrompt: string;
  taskLedger: TaskLedger;         // Current task and plan
  recentMessages: Message[];      // Last N messages (configurable)
  activeFiles: FileContext[];     // Files currently being edited
  errorContext: ErrorContext[];   // Recent errors (for debugging continuity)
}

export interface CompactableContext {
  // These can be summarized or removed
  olderMessages: Message[];
  toolResults: ToolResult[];
  explorationFindings: string[];
}

export interface ToolResult {
  name: string;
  content: string;
  timestamp?: Date;
}

interface CompactionStrategy {
  name: string;
  apply: () => Promise<CompactableContext>;
  tokensSaved: () => number;
}

export class ContextManager {
  private config: ContextConfig;

  constructor(config: ContextConfig) {
    this.config = config;
  }

  async checkAndCompact(
    preserved: PreservedContext,
    compactable: CompactableContext
  ): Promise<Message[]> {
    const currentTokens = this.countTotalTokens(preserved, compactable);
    const threshold = this.config.maxTokens * this.config.compactionThreshold;
    
    if (currentTokens < threshold) {
      return this.buildMessageArray(preserved, compactable);
    }
    
    // Trigger compaction
    log.info(`Context compaction triggered: ${currentTokens}/${this.config.maxTokens} tokens`);
    
    return this.compact(preserved, compactable, currentTokens - threshold);
  }

  private async compact(
    preserved: PreservedContext,
    compactable: CompactableContext,
    tokensToFree: number
  ): Promise<Message[]> {
    const strategies: CompactionStrategy[] = [
      // 1. Remove old tool results (keep summaries)
      { 
        name: "summarize-tool-results",
        apply: async () => this.summarizeToolResults(compactable),
        tokensSaved: () => this.estimateToolResultTokens(compactable.toolResults) * 0.7,
      },
      // 2. Summarize older conversation
      {
        name: "summarize-old-messages", 
        apply: async () => this.summarizeOldMessages(compactable),
        tokensSaved: () => this.estimateMessageTokens(compactable.olderMessages) * 0.8,
      },
      // 3. Remove exploration findings (keep key facts in task ledger)
      {
        name: "compact-exploration",
        apply: async () => this.compactExploration(compactable, preserved.taskLedger),
        tokensSaved: () => this.estimateExplorationTokens(compactable.explorationFindings) * 0.9,
      },
    ];

    let freedTokens = 0;
    let compactedContext = { ...compactable };
    
    for (const strategy of strategies) {
      if (freedTokens >= tokensToFree) break;
      
      log.debug(`Applying compaction strategy: ${strategy.name}`);
      compactedContext = await strategy.apply();
      freedTokens += strategy.tokensSaved();
    }

    return this.buildMessageArray(preserved, compactedContext);
  }

  private async summarizeToolResults(context: CompactableContext): Promise<CompactableContext> {
    const { toolResults } = context;
    
    // Keep only last 5 tool results in full, summarize older ones
    const keepFull = toolResults.slice(-5);
    const toSummarize = toolResults.slice(0, -5);
    
    if (toSummarize.length === 0) {
      return context;
    }
    
    const summary: ToolResult = {
      name: "previous_tool_summary",
      content: `Summary of ${toSummarize.length} previous tool calls:\n` +
        toSummarize.map(r => `- ${r.name}: ${this.truncate(r.content, 100)}`).join("\n"),
    };
    
    return {
      ...context,
      toolResults: [summary, ...keepFull],
    };
  }

  private async summarizeOldMessages(context: CompactableContext): Promise<CompactableContext> {
    const { olderMessages } = context;
    
    if (olderMessages.length === 0) {
      return context;
    }

    // Create a summary of the older conversation
    const summaryContent = olderMessages
      .map(m => `${m.role}: ${this.truncate(typeof m.content === 'string' ? m.content : '', 200)}`)
      .join("\n");

    const summary: Message = {
      role: "system",
      content: `[Conversation Summary]\n${this.truncate(summaryContent, 1000)}`,
    };

    return {
      ...context,
      olderMessages: [summary],
    };
  }

  private async compactExploration(
    context: CompactableContext,
    taskLedger: TaskLedger
  ): Promise<CompactableContext> {
    // Move key facts from exploration to task ledger, discard rest
    const keyFacts = context.explorationFindings
      .filter(f => f.includes("important") || f.includes("found") || f.includes("error"))
      .slice(0, 5);
    
    // Add to task ledger facts (side effect)
    taskLedger.facts.push(...keyFacts);
    
    return {
      ...context,
      explorationFindings: [],
    };
  }

  private buildMessageArray(
    preserved: PreservedContext,
    compactable: CompactableContext
  ): Message[] {
    const messages: Message[] = [];
    
    // Add summarized older messages first
    for (const msg of compactable.olderMessages) {
      messages.push(msg);
    }
    
    // Add recent messages
    for (const msg of preserved.recentMessages) {
      messages.push(msg);
    }
    
    return messages;
  }

  private countTotalTokens(preserved: PreservedContext, compactable: CompactableContext): number {
    // Rough estimation: 4 characters per token
    let chars = 0;
    
    chars += preserved.systemPrompt.length;
    chars += JSON.stringify(preserved.taskLedger).length;
    chars += preserved.recentMessages.reduce((acc, m) => 
      acc + (typeof m.content === 'string' ? m.content.length : 0), 0);
    chars += preserved.activeFiles.reduce((acc, f) => acc + f.content.length, 0);
    chars += preserved.errorContext.reduce((acc, e) => acc + e.error.length, 0);
    
    chars += compactable.olderMessages.reduce((acc, m) => 
      acc + (typeof m.content === 'string' ? m.content.length : 0), 0);
    chars += compactable.toolResults.reduce((acc, r) => acc + r.content.length, 0);
    chars += compactable.explorationFindings.reduce((acc, f) => acc + f.length, 0);
    
    return Math.ceil(chars / 4);
  }

  private estimateToolResultTokens(results: ToolResult[]): number {
    const chars = results.reduce((acc, r) => acc + r.content.length, 0);
    return Math.ceil(chars / 4);
  }

  private estimateMessageTokens(messages: Message[]): number {
    const chars = messages.reduce((acc, m) => 
      acc + (typeof m.content === 'string' ? m.content.length : 0), 0);
    return Math.ceil(chars / 4);
  }

  private estimateExplorationTokens(findings: string[]): number {
    const chars = findings.reduce((acc, f) => acc + f.length, 0);
    return Math.ceil(chars / 4);
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  }
}
