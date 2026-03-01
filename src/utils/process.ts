/**
 * Process Utilities - Shared subprocess execution to eliminate boilerplate
 */

import { getErrorMessage } from "./security";
import { exec } from "./runtime";

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a subprocess and return structured output.
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
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Process timed out after ${timeout}ms`)),
        timeout
      );
    });

    const outputPromise = exec(args, { cwd, stdin }).then((r) => ({
      stdout: r.stdout.trim(),
      stderr: r.stderr.trim(),
      exitCode: r.exitCode,
    }));

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
