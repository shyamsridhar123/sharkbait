/**
 * Shell Execution Tool - Run commands with allowlist-based security
 * Uses centralized security module for command classification
 */

import type { Tool } from "./registry";
import { classifyCommand, type CommandSafety } from "../utils/security";
import { ToolError } from "../utils/errors";
import { getErrorMessage } from "../utils/security";
import { exec, spawnBackground } from "../utils/runtime";
import { resolve } from "path";

export const shellTools: Tool[] = [
  {
    name: "run_command",
    description: "Execute a shell command. Commands must be on the allowlist or will require user confirmation.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute" },
        cwd: { type: "string", description: "Working directory" },
        background: { type: "boolean", description: "Run in background" },
        timeout: { type: "number", description: "Timeout in milliseconds" },
      },
      required: ["command"],
    },
    async execute({ command, cwd, background, timeout }) {
      const cmd = command as string;
      const workingDir = (cwd as string) || process.cwd();
      const timeoutMs = (timeout as number) || 30000;

      // Classify command using centralized security
      const safety = classifyCommand(cmd);

      if (safety.status === "blocked") {
        throw new ToolError(
          `Blocked dangerous command: ${safety.reason}`,
          "run_command"
        );
      }

      if (safety.status === "requires_confirmation") {
        throw new ToolError(
          `Command requires confirmation: ${safety.reason}` +
            (safety.reversibility === "irreversible"
              ? " (IRREVERSIBLE)"
              : ` (reversibility: ${safety.reversibility})`) +
            (safety.undoHint ? `. To undo: ${safety.undoHint}` : ""),
          "run_command"
        );
      }

      if (background) {
        const shell = process.platform === "win32" ? "cmd" : "sh";
        const shellArg = process.platform === "win32" ? "/c" : "-c";

        const pid = spawnBackground([shell, shellArg, cmd], {
          cwd: workingDir,
        });

        return {
          pid,
          message: "Started in background",
        };
      }

      try {
        const shell = process.platform === "win32" ? "cmd" : "sh";
        const shellArg = process.platform === "win32" ? "/c" : "-c";

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(new Error(`Command timed out after ${timeoutMs}ms`)),
            timeoutMs
          );
        });

        const outputPromise = exec([shell, shellArg, cmd], {
          cwd: workingDir,
        });

        const { stdout, stderr, exitCode } = await Promise.race([
          outputPromise,
          timeoutPromise,
        ]);

        return {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
        };
      } catch (error) {
        return {
          stdout: "",
          stderr: getErrorMessage(error),
          exitCode: 1,
        };
      }
    },
  },
  {
    name: "open_file",
    description:
      "Open a file or URL in the default application (browser, editor, etc). " +
      "Only allows safe application names (e.g., 'code', 'chrome', 'firefox').",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path or URL to open",
        },
        application: {
          type: "string",
          description:
            "Optional: specific application to use (e.g., 'chrome', 'code')",
        },
      },
      required: ["path"],
    },
    async execute({ path, application }) {
      let target = path as string;
      const app = application as string | undefined;

      // Resolve relative file paths to absolute so browsers don't treat them as hostnames
      const isUrl = /^https?:\/\//i.test(target);
      if (!isUrl) {
        target = resolve(process.cwd(), target);
      }

      // Sanitize application name — only allow known-safe applications
      const SAFE_APPS = [
        "code",
        "cursor",
        "chrome",
        "firefox",
        "safari",
        "brave",
        "edge",
        "vim",
        "nano",
        "less",
        "more",
        "preview",
      ];

      if (app && !SAFE_APPS.includes(app.toLowerCase())) {
        throw new ToolError(
          `Application "${app}" is not in the allowed list: ${SAFE_APPS.join(", ")}`,
          "open_file"
        );
      }

      let cmd: string[];

      if (process.platform === "win32") {
        cmd = app
          ? ["cmd", "/c", "start", "", app, target]
          : ["cmd", "/c", "start", "", target];
      } else if (process.platform === "darwin") {
        cmd = app ? ["open", "-a", app, target] : ["open", target];
      } else {
        cmd = app ? [app, target] : ["xdg-open", target];
      }

      try {
        await exec(cmd);
        return { success: true, message: `Opened ${target}` };
      } catch (error) {
        return { success: false, error: getErrorMessage(error) };
      }
    },
  },
];
