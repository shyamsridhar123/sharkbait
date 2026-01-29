/**
 * Slash Command Registry
 * Central registry for all slash commands available in the interactive UI
 */

import type { SlashCommand, CommandContext, CommandResult } from "./types";
import { resolve, isAbsolute } from "path";
import { existsSync, statSync } from "fs";
import { initProject } from "../../commands/init";
import { runTask } from "../../commands/run";

/**
 * All registered slash commands
 */
export const commands: SlashCommand[] = [
  // === Navigation Commands ===
  {
    name: "cd",
    description: "Change working directory",
    usage: "/cd <path>",
    args: "<path>",
    category: "navigation",
    handler: (args, ctx) => {
      if (!args) {
        return {
          handled: true,
          message: `Current directory: ${ctx.currentDir}\n\nUsage: /cd <path>`,
        };
      }

      const newPath = isAbsolute(args) ? args : resolve(ctx.currentDir, args);

      if (!existsSync(newPath)) {
        ctx.setPendingConfirm({ type: "mkdir", data: { path: newPath } });
        return {
          handled: true,
          message: `Directory not found: ${newPath}\n\nCreate it? Type 'y' or 'yes' to create, anything else to cancel.`,
        };
      }

      try {
        const stat = statSync(newPath);
        if (!stat.isDirectory()) {
          return { handled: true, message: `Error: Not a directory: ${newPath}`, isError: true };
        }
      } catch {
        return { handled: true, message: `Error: Cannot access: ${newPath}`, isError: true };
      }

      process.chdir(newPath);
      ctx.setCurrentDir(newPath);
      return { handled: true, message: `Changed directory to: ${newPath}` };
    },
  },

  {
    name: "pwd",
    description: "Show current working directory",
    category: "navigation",
    handler: (_, ctx) => ({
      handled: true,
      message: `Current directory: ${ctx.currentDir}`,
    }),
  },

  // === Session Commands ===
  {
    name: "clear",
    description: "Clear message history",
    category: "session",
    handler: (_, ctx) => {
      ctx.clearMessages();
      ctx.showWelcome();
      return { handled: true };
    },
  },

  {
    name: "exit",
    aliases: ["quit", "q"],
    description: "Exit Sharkbait",
    category: "session",
    handler: (_, ctx) => {
      ctx.exit();
      return { handled: true };
    },
  },

  // === Config Commands ===
  {
    name: "beads",
    description: "Toggle or check Beads task tracking",
    usage: "/beads [on|off]",
    args: "[on|off]",
    category: "config",
    handler: (args, ctx) => {
      if (!args) {
        return {
          handled: true,
          message: `Beads task tracking: ${ctx.beadsEnabled ? "enabled ✓" : "disabled ✗"}\n\nUsage: /beads on  - Enable beads\n       /beads off - Disable beads`,
        };
      }

      const action = args.toLowerCase().trim();
      if (action === "on" || action === "enable" || action === "1" || action === "true") {
        ctx.setBeadsEnabled(true);
        return { handled: true, message: "Beads task tracking enabled ✓" };
      } else if (action === "off" || action === "disable" || action === "0" || action === "false") {
        ctx.setBeadsEnabled(false);
        return { handled: true, message: "Beads task tracking disabled ✗" };
      }

      return {
        handled: true,
        message: `Unknown option: ${args}\n\nUsage: /beads on  - Enable beads\n       /beads off - Disable beads`,
        isError: true,
      };
    },
  },

  {
    name: "context",
    aliases: ["ctx"],
    description: "Manage context files",
    usage: "/context [add|remove|list] [files...]",
    args: "[add|remove|list] [files...]",
    category: "config",
    handler: (args, ctx) => {
      if (!args) {
        if (ctx.contextFiles.length === 0) {
          return { handled: true, message: "No context files loaded.\n\nUsage:\n  /context add <files...>   - Add files to context\n  /context remove <files...> - Remove files from context\n  /context list             - List current context files\n  /context clear            - Remove all context files" };
        }
        return {
          handled: true,
          message: `Context files (${ctx.contextFiles.length}):\n${ctx.contextFiles.map(f => `  • ${f}`).join("\n")}`,
        };
      }

      const parts = args.split(/\s+/);
      const action = parts[0]?.toLowerCase() ?? "";
      const files = parts.slice(1);

      switch (action) {
        case "add":
          if (files.length === 0) {
            return { handled: true, message: "Usage: /context add <files...>", isError: true };
          }
          const newFiles = [...new Set([...ctx.contextFiles, ...files])];
          ctx.setContextFiles(newFiles);
          return { handled: true, message: `Added ${files.length} file(s) to context. Total: ${newFiles.length}` };

        case "remove":
        case "rm":
          if (files.length === 0) {
            return { handled: true, message: "Usage: /context remove <files...>", isError: true };
          }
          const remaining = ctx.contextFiles.filter(f => !files.includes(f));
          ctx.setContextFiles(remaining);
          return { handled: true, message: `Removed ${ctx.contextFiles.length - remaining.length} file(s). Remaining: ${remaining.length}` };

        case "list":
        case "ls":
          if (ctx.contextFiles.length === 0) {
            return { handled: true, message: "No context files loaded." };
          }
          return {
            handled: true,
            message: `Context files (${ctx.contextFiles.length}):\n${ctx.contextFiles.map(f => `  • ${f}`).join("\n")}`,
          };

        case "clear":
          ctx.setContextFiles([]);
          return { handled: true, message: "Cleared all context files." };

        default:
          // Treat as file list to add
          const allFiles = [...new Set([...ctx.contextFiles, action, ...files])];
          ctx.setContextFiles(allFiles);
          return { handled: true, message: `Added file(s) to context. Total: ${allFiles.length}` };
      }
    },
  },

  // === Action Commands ===
  {
    name: "init",
    description: "Initialize Sharkbait in current directory",
    category: "action",
    handler: async (_, ctx) => {
      ctx.addMessage("system", "Initializing Sharkbait in current directory...");
      try {
        await initProject();
        return { handled: true, message: "✓ Sharkbait initialized successfully!" };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { handled: true, message: `Failed to initialize: ${msg}`, isError: true };
      }
    },
  },

  {
    name: "run",
    aliases: ["exec"],
    description: "Execute a task autonomously",
    usage: "/run <task description>",
    args: "<task>",
    category: "action",
    handler: async (args, ctx) => {
      if (!args) {
        return { handled: true, message: "Usage: /run <task description>\n\nExample: /run create a new React component for user profile", isError: true };
      }

      ctx.addMessage("system", `Executing task: ${args}`);
      
      try {
        await runTask(args, { dryRun: false });
        return { handled: true, message: "✓ Task execution completed" };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { handled: true, message: `Task failed: ${msg}`, isError: true };
      }
    },
  },

  // === Info Commands ===
  {
    name: "version",
    aliases: ["v"],
    description: "Show Sharkbait version",
    category: "info",
    handler: (_, ctx) => ({
      handled: true,
      message: `Sharkbait v${ctx.version}`,
    }),
  },

  {
    name: "help",
    aliases: ["h", "?"],
    description: "Show available commands",
    usage: "/help [command]",
    args: "[command]",
    category: "info",
    handler: (args, ctx) => {
      if (args) {
        // Show help for specific command
        const cmd = findCommand(args.toLowerCase());
        if (!cmd) {
          return { handled: true, message: `Unknown command: ${args}\n\nType /help to see all commands.`, isError: true };
        }
        
        let help = `/${cmd.name}`;
        if (cmd.args) help += ` ${cmd.args}`;
        help += `\n\n${cmd.description}`;
        if (cmd.aliases?.length) {
          help += `\n\nAliases: ${cmd.aliases.map(a => `/${a}`).join(", ")}`;
        }
        if (cmd.usage) {
          help += `\n\nUsage: ${cmd.usage}`;
        }
        return { handled: true, message: help };
      }

      // Show all commands grouped by category
      const categories: Record<string, SlashCommand[]> = {
        navigation: [],
        session: [],
        config: [],
        action: [],
        info: [],
      };

      for (const cmd of commands) {
        const category = categories[cmd.category];
        if (category) {
          category.push(cmd);
        }
      }

      const categoryNames: Record<string, string> = {
        navigation: "Navigation",
        session: "Session",
        config: "Configuration",
        action: "Actions",
        info: "Information",
      };

      let help = "Available commands:\n";
      
      for (const [cat, cmds] of Object.entries(categories)) {
        if (cmds.length === 0) continue;
        help += `\n${categoryNames[cat]}:\n`;
        for (const cmd of cmds) {
          const cmdStr = `/${cmd.name}${cmd.args ? ` ${cmd.args}` : ""}`;
          help += `  ${cmdStr.padEnd(28)} ${cmd.description}\n`;
        }
      }

      help += "\nType /help <command> for detailed help on a specific command.";
      return { handled: true, message: help };
    },
  },
];

/**
 * Find a command by name or alias
 */
export function findCommand(nameOrAlias: string): SlashCommand | undefined {
  const lower = nameOrAlias.toLowerCase();
  return commands.find(
    cmd => cmd.name === lower || cmd.aliases?.includes(lower)
  );
}

/**
 * Execute a slash command
 */
export async function executeCommand(
  input: string,
  ctx: CommandContext
): Promise<CommandResult> {
  // Parse command and args
  const match = input.match(/^\/(\S+)(?:\s+(.*))?$/);
  if (!match) {
    return { handled: false };
  }

  const [, cmdName = "", args = ""] = match;
  const cmd = findCommand(cmdName);

  if (!cmd) {
    return {
      handled: true,
      message: `Unknown command: /${cmdName}\n\nType /help for available commands.`,
      isError: true,
    };
  }

  return await cmd.handler(args.trim(), ctx);
}

/**
 * Get command names for tab completion
 */
export function getCommandNames(): string[] {
  const names: string[] = [];
  for (const cmd of commands) {
    names.push(cmd.name);
    if (cmd.aliases) {
      names.push(...cmd.aliases);
    }
  }
  return names.sort();
}
