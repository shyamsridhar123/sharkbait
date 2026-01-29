/**
 * Unit Tests - Tool Registry
 */

import { describe, test, expect } from "bun:test";
import { ToolRegistry } from "../../src/tools/registry";

describe("ToolRegistry", () => {
  test("initializes with default tools", () => {
    const registry = new ToolRegistry();
    expect(registry.size).toBeGreaterThan(0);
  });

  test("has file operation tools", () => {
    const registry = new ToolRegistry();
    expect(registry.has("read_file")).toBe(true);
    expect(registry.has("write_file")).toBe(true);
    expect(registry.has("edit_file")).toBe(true);
  });

  test("has shell tools", () => {
    const registry = new ToolRegistry();
    expect(registry.has("run_command")).toBe(true);
  });

  test("has git tools", () => {
    const registry = new ToolRegistry();
    expect(registry.has("git_status")).toBe(true);
    expect(registry.has("git_commit")).toBe(true);
  });

  test("has github tools", () => {
    const registry = new ToolRegistry();
    expect(registry.has("github_create_pr")).toBe(true);
  });

  test("getDefinitions returns all tool definitions", () => {
    const registry = new ToolRegistry();
    const definitions = registry.getDefinitions();
    
    expect(definitions.length).toBeGreaterThan(0);
    expect(definitions[0]).toHaveProperty("name");
    expect(definitions[0]).toHaveProperty("description");
    expect(definitions[0]).toHaveProperty("parameters");
  });

  test("execute throws for unknown tool", async () => {
    const registry = new ToolRegistry();
    await expect(registry.execute("nonexistent_tool", {}))
      .rejects.toThrow("Unknown tool");
  });

  test("can disable beads tools", () => {
    const registry = new ToolRegistry({ enableBeads: false });
    expect(registry.has("beads_create")).toBe(false);
  });

  test("custom tool registration", () => {
    const registry = new ToolRegistry();
    
    registry.register({
      name: "custom_tool",
      description: "A custom test tool",
      parameters: { type: "object", properties: {}, required: [] },
      execute: async () => ({ result: "custom" }),
    });
    
    expect(registry.has("custom_tool")).toBe(true);
  });
});
