/**
 * Tool Registry - Central registry for all available tools
 */

import type { ToolDefinition } from "../llm/types";
import { fileTools } from "./file-ops";
import { shellTools } from "./shell";
import { beadsTools } from "./beads";
import { gitTools } from "./git";
import { githubTools } from "./github";
import { fetchTools } from "./fetch";
import { ToolError } from "../utils/errors";
import { log } from "../utils/logger";

export interface Tool {
  name: string;
  description: string;
  parameters: object;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface ToolOptions {
  enableBeads?: boolean;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor(options: ToolOptions = {}) {
    // Always register core tools
    this.registerAll(fileTools);
    this.registerAll(shellTools);
    this.registerAll(gitTools);
    this.registerAll(githubTools);
    this.registerAll(fetchTools);
    
    // Optionally register beads tools
    if (options.enableBeads !== false) {
      this.registerAll(beadsTools);
    }
  }

  private registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        log.warn(`Tool ${tool.name} already registered, skipping duplicate`);
        continue;
      }
      this.tools.set(tool.name, tool);
      log.debug(`Registered tool: ${tool.name}`);
    }
  }

  /**
   * Register a custom tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new ToolError(`Tool ${tool.name} already registered`, tool.name);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Get tool definitions for LLM
   */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new ToolError(`Unknown tool: ${name}`, name);
    }

    log.debug(`Executing tool ${name} with args: ${JSON.stringify(args)}`);

    try {
      const result = await tool.execute(args);
      log.debug(`Tool ${name} completed successfully`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      log.error(`Tool ${name} failed: ${message}`);
      throw new ToolError(message, name);
    }
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the number of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
