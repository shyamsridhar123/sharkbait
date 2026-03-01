/**
 * Tool Registry - Central registry for all available tools
 * Hooks are wired here so ALL tool execution goes through PreToolUse/PostToolUse
 */

import type { ToolDefinition } from "../llm/types";
import { fileTools } from "./file-ops";
import { shellTools } from "./shell";
import { beadsTools } from "./beads";
import { gitTools } from "./git";
import { githubTools } from "./github";
import { fetchTools } from "./fetch";
import { codebaseTools } from "./codebase";
import { ToolError } from "../utils/errors";
import { log } from "../utils/logger";
import { sanitizeForLogging } from "../utils/security";
import { globalHooks } from "../hooks/registry";

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
  private definitionsCache: ToolDefinition[] | null = null;

  constructor(options: ToolOptions = {}) {
    // Always register core tools
    this.registerAll(fileTools);
    this.registerAll(shellTools);
    this.registerAll(gitTools);
    this.registerAll(githubTools);
    this.registerAll(fetchTools);
    this.registerAll(codebaseTools);

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
    // Invalidate cache when tools change
    this.definitionsCache = null;
  }

  /**
   * Register a custom tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new ToolError(`Tool ${tool.name} already registered`, tool.name);
    }
    this.tools.set(tool.name, tool);
    this.definitionsCache = null;
  }

  /**
   * Get tool definitions for LLM (cached — definitions don't change mid-session)
   */
  getDefinitions(): ToolDefinition[] {
    if (this.definitionsCache) {
      return this.definitionsCache;
    }

    this.definitionsCache = Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    return this.definitionsCache;
  }

  /**
   * Execute a tool by name.
   * Runs through PreToolUse and PostToolUse hooks.
   */
  async execute(
    name: string,
    args: Record<string, unknown>,
    agentName: string = "default"
  ): Promise<unknown> {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new ToolError(`Unknown tool: ${name}`, name);
    }

    log.debug(`Executing tool ${name} with args: ${sanitizeForLogging(JSON.stringify(args))}`);

    // ── PreToolUse hooks ──────────────────────────────────
    const preResult = await globalHooks.executePreToolUse({
      toolName: name,
      args,
      agentName,
    });

    if (!preResult.proceed) {
      throw new ToolError(
        `Tool blocked by hook: ${preResult.reason || "no reason given"}`,
        name
      );
    }

    // Use potentially modified args from hooks
    const effectiveArgs = preResult.modifiedArgs || args;

    // ── Execute ───────────────────────────────────────────
    const startTime = Date.now();
    let result: unknown;
    let success = true;
    let errorMessage: string | undefined;

    try {
      result = await tool.execute(effectiveArgs);
      log.debug(`Tool ${name} completed successfully`);
    } catch (error) {
      success = false;
      const message =
        error instanceof Error ? error.message : "Unknown error";
      errorMessage = message;
      log.error(`Tool ${name} failed: ${message}`);

      // ── PostToolUse hooks (failure path) ────────────────
      await globalHooks.executePostToolUse({
        toolName: name,
        args: effectiveArgs,
        result: null,
        durationMs: Date.now() - startTime,
        success: false,
        error: message,
      });

      throw new ToolError(message, name);
    }

    // ── PostToolUse hooks (success path) ──────────────────
    const postResult = await globalHooks.executePostToolUse({
      toolName: name,
      args: effectiveArgs,
      result,
      durationMs: Date.now() - startTime,
      success: true,
    });

    // Use potentially modified result from hooks
    return postResult.modifiedResult !== undefined
      ? postResult.modifiedResult
      : result;
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
