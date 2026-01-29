/**
 * Unit Tests - Shell Execution Tool
 */

import { describe, test, expect } from "bun:test";
import { shellTools } from "../../src/tools/shell";

describe("shell-tools", () => {
  const runCommand = shellTools.find(t => t.name === "run_command")!;

  test("run_command executes simple command", async () => {
    const result = await runCommand.execute({ command: "echo hello" }) as { stdout: string };
    expect(result.stdout).toContain("hello");
  });

  test("run_command blocks dangerous commands", async () => {
    await expect(runCommand.execute({ command: "rm -rf /" }))
      .rejects.toThrow();
  });

  test("run_command blocks fork bomb", async () => {
    await expect(runCommand.execute({ command: ":(){ :|:& };:" }))
      .rejects.toThrow();
  });

  test("run_command handles command failure", async () => {
    const result = await runCommand.execute({ command: "nonexistentcommand12345" }) as { exitCode: number };
    expect(result.exitCode).not.toBe(0);
  });

  test("run_command respects cwd option", async () => {
    const result = await runCommand.execute({ 
      command: process.platform === "win32" ? "cd" : "pwd",
      cwd: process.cwd(),
    }) as { stdout: string };
    expect(result.stdout).toBeTruthy();
  });
});
