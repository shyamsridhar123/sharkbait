/**
 * Process Utilities - Shared subprocess execution to eliminate boilerplate
 * Replaces 27+ instances of Bun.spawn + stdout + exit pattern
 */

import { getErrorMessage } from "./security";

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a subprocess and return structured output.
 * Replaces the repetitive Bun.spawn + new Response pattern.
 */
export async function runProcess(
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    stdin?: string;
  } = {}
): Promise<ProcessResult> {
  const { cwd, timeout = 30000, stdin } = options;

  try {
    const proc = Bun.spawn(args, {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
      stdin: stdin ? new TextEncoder().encode(stdin) : undefined,
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Process timed out after ${timeout}ms`)),
        timeout
      );
    });

    const outputPromise = (async () => {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;
      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
    })();

    return await Promise.race([outputPromise, timeoutPromise]);
  } catch (error) {
    return {
      stdout: "",
      stderr: getErrorMessage(error),
      exitCode: 1,
    };
  }
}

/**
 * Run a shell command string and return structured output.
 */
export async function runShellCommand(
  command: string,
  options: { cwd?: string; timeout?: number } = {}
): Promise<ProcessResult> {
  const shell = process.platform === "win32" ? "cmd" : "sh";
  const shellArg = process.platform === "win32" ? "/c" : "-c";
  return runProcess([shell, shellArg, command], options);
}
