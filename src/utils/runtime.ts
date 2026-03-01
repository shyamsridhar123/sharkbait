/**
 * Runtime Compatibility Layer
 * Provides cross-runtime functions that work on both Bun and Node.js.
 * Replaces direct Bun.spawn, Bun.file, Bun.write usage.
 */

import { spawn as nodeSpawn } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a subprocess and collect output.
 * Replaces: Bun.spawn(args, { stdout: "pipe", stderr: "pipe" })
 *           + new Response(proc.stdout).text()
 *           + proc.exited
 */
export function exec(
  args: string[],
  options?: { cwd?: string; stdin?: string }
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const [cmd, ...rest] = args;
    const proc = nodeSpawn(cmd!, rest, {
      cwd: options?.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (options?.stdin) {
      proc.stdin?.write(options.stdin);
    }
    proc.stdin?.end();

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on("error", (err) => {
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

/**
 * Spawn a background process. Returns PID without waiting.
 * Replaces: Bun.spawn(args, { ... }) with immediate pid return.
 */
export function spawnBackground(
  args: string[],
  options?: { cwd?: string }
): number | undefined {
  const [cmd, ...rest] = args;
  const proc = nodeSpawn(cmd!, rest, {
    cwd: options?.cwd,
    stdio: ["ignore", "ignore", "ignore"],
    detached: process.platform !== "win32",
  });
  proc.unref();
  return proc.pid;
}

/**
 * Read file contents as text.
 * Replaces: Bun.file(path).text()
 */
export async function readTextFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

/**
 * Write text content to a file.
 * Replaces: Bun.write(path, content)
 */
export async function writeTextFile(
  filePath: string,
  content: string
): Promise<void> {
  await writeFile(filePath, content);
}

/**
 * Check if a file exists.
 * Replaces: Bun.file(path).exists()
 */
export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}
