/**
 * Shell Execution Tool - Run commands with reversibility classification
 * Inspired by Magentic-One research on action reversibility
 */

import type { Tool } from "./registry";

// Action reversibility classification
enum Reversibility {
  EASY = "easy",           // Can be undone trivially (git checkout, mkdir)
  EFFORT = "effort",       // Can be undone with effort (git push, npm publish)
  IRREVERSIBLE = "irreversible",  // Cannot be undone (rm -rf, email sent)
}

interface ActionClassification {
  reversibility: Reversibility;
  requiresConfirmation: boolean;
  undoCommand?: string;
}

// Pattern-based classification for common dangerous commands
const ACTION_CLASSIFICATIONS: Array<[RegExp, ActionClassification]> = [
  // Irreversible - always block or require confirmation
  [/rm\s+-rf\s+[\/~]/, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/rm\s+-rf\s+\*/, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/>\s*\/dev\/sd/, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/mkfs/, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/dd\s+if=/, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/DROP\s+DATABASE/i, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/TRUNCATE\s+TABLE/i, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  [/DELETE\s+FROM\s+\w+\s*;?\s*$/i, { reversibility: Reversibility.IRREVERSIBLE, requiresConfirmation: true }],
  
  // Effort to reverse - warn but allow
  [/git\s+push\s+.*--force/, { 
    reversibility: Reversibility.EFFORT, 
    requiresConfirmation: true, 
    undoCommand: "git reflog + push" 
  }],
  [/npm\s+publish/, { 
    reversibility: Reversibility.EFFORT, 
    requiresConfirmation: true 
  }],
  [/git\s+push/, { 
    reversibility: Reversibility.EFFORT, 
    requiresConfirmation: false, 
    undoCommand: "git revert or git push --force (with care)" 
  }],
  
  // Easy to reverse - proceed with logging
  [/git\s+checkout/, { 
    reversibility: Reversibility.EASY, 
    requiresConfirmation: false, 
    undoCommand: "git checkout -" 
  }],
  [/git\s+branch\s+-d/, { 
    reversibility: Reversibility.EASY, 
    requiresConfirmation: false, 
    undoCommand: "git branch <name> <sha>" 
  }],
  [/mkdir/, { 
    reversibility: Reversibility.EASY, 
    requiresConfirmation: false, 
    undoCommand: "rmdir" 
  }],
];

// Commands that should never be executed
const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+\/(?!\w)/, // rm -rf / (but not /path)
  /:\s*\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}/, // Fork bomb - flexible whitespace matching
  /dd\s+if=.*of=\/dev\/sd/, // Disk overwrite
  /chmod\s+777\s+\//, // Dangerous permissions on root
  /curl.*\|\s*(?:ba)?sh/, // Pipe curl to shell
  /wget.*\|\s*(?:ba)?sh/, // Pipe wget to shell
];

function classifyAction(command: string): ActionClassification {
  // Check blocked commands first
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return { 
        reversibility: Reversibility.IRREVERSIBLE, 
        requiresConfirmation: true 
      };
    }
  }
  
  // Check known patterns
  for (const [pattern, classification] of ACTION_CLASSIFICATIONS) {
    if (pattern.test(command)) {
      return classification;
    }
  }
  
  // Default: unknown commands are treated as needing caution
  return { reversibility: Reversibility.EFFORT, requiresConfirmation: false };
}

function isCommandBlocked(command: string): boolean {
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return true;
    }
  }
  return false;
}

export const shellTools: Tool[] = [
  {
    name: "run_command",
    description: "Execute a shell command",
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
      
      // Check if command is blocked
      if (isCommandBlocked(cmd)) {
        throw new Error(`Blocked dangerous command: ${cmd}`);
      }
      
      // Classify action reversibility
      const classification = classifyAction(cmd);
      
      if (classification.reversibility === Reversibility.IRREVERSIBLE) {
        throw new Error(
          `Irreversible action blocked: ${cmd}. ` +
          `This action cannot be undone. Please confirm manually.`
        );
      }
      
      // Log warning for effort-level reversibility
      if (classification.requiresConfirmation) {
        console.warn(`⚠️  Action requires care: ${cmd}`);
        console.warn(`   Reversibility: ${classification.reversibility}`);
        if (classification.undoCommand) {
          console.warn(`   To undo: ${classification.undoCommand}`);
        }
      }

      if (background) {
        // Start background process
        const shell = process.platform === "win32" ? "cmd" : "sh";
        const shellArg = process.platform === "win32" ? "/c" : "-c";
        
        const proc = Bun.spawn([shell, shellArg, cmd], {
          cwd: workingDir,
          stdout: "pipe",
          stderr: "pipe",
        });
        
        return { 
          pid: proc.pid, 
          message: "Started in background",
          reversibility: classification.reversibility,
        };
      }

      try {
        const shell = process.platform === "win32" ? "cmd" : "sh";
        const shellArg = process.platform === "win32" ? "/c" : "-c";
        
        const proc = Bun.spawn([shell, shellArg, cmd], {
          cwd: workingDir,
          stdout: "pipe",
          stderr: "pipe",
        });

        // Handle timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Command timed out after ${timeoutMs}ms`)), timeoutMs);
        });

        const outputPromise = (async () => {
          const stdout = await new Response(proc.stdout).text();
          const stderr = await new Response(proc.stderr).text();
          const exitCode = await proc.exited;
          return { stdout, stderr, exitCode };
        })();

        const { stdout, stderr, exitCode } = await Promise.race([outputPromise, timeoutPromise]);
        
        return { 
          stdout: stdout.trim(), 
          stderr: stderr.trim(),
          exitCode,
          reversibility: classification.reversibility,
          undoHint: classification.undoCommand,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Command failed";
        return { 
          stdout: "",
          stderr: message,
          exitCode: 1,
        };
      }
    },
  },
];
