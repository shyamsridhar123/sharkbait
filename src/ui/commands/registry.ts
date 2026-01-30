/**
 * Slash Command Registry
 * Central registry for all slash commands available in the interactive UI
 */

import type { SlashCommand, CommandContext, CommandResult } from "./types";
import { resolve, isAbsolute } from "path";
import { existsSync, statSync, readFileSync } from "fs";
import { initProject } from "../../commands/init";
import { runTask } from "../../commands/run";
import { AzureOpenAIClient } from "../../llm/azure-openai";
import { ToolRegistry } from "../../tools";
import { AgentFactory, ParallelExecutor } from "../../agents";
import { loadConfig } from "../../utils/config";

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
    name: "model",
    aliases: ["m"],
    description: "Show or switch the LLM model",
    usage: "/model [model-name]",
    args: "[model-name]",
    category: "config",
    handler: (args, ctx) => {
      const availableModels = [
        "gpt-5.1-codex-max",
        "gpt-codex-5.2",
        "gpt-4-turbo",
        "gpt-4o",
        "gpt-4o-mini",
      ];

      if (!args) {
        return {
          handled: true,
          message: `Current model: ${ctx.currentModel}\n\nAvailable models:\n${availableModels.map(m => `  • ${m}${m === ctx.currentModel ? " (active)" : ""}`).join("\n")}\n\nUsage: /model <model-name>`,
        };
      }

      const model = args.toLowerCase().trim();
      if (!availableModels.some(m => m.toLowerCase() === model)) {
        return {
          handled: true,
          message: `Unknown model: ${args}\n\nAvailable models:\n${availableModels.map(m => `  • ${m}`).join("\n")}`,
          isError: true,
        };
      }

      // Find exact match (preserve case)
      const exactModel = availableModels.find(m => m.toLowerCase() === model) || args;
      ctx.setCurrentModel(exactModel);
      return { handled: true, message: `Switched to model: ${exactModel}\n\n⚠️ Note: Model change takes effect on next message (requires agent restart)` };
    },
  },

  {
    name: "tasks",
    aliases: ["t"],
    description: "Show Beads task status",
    usage: "/tasks [list|active]",
    args: "[list|active]",
    category: "config",
    handler: async (args, ctx) => {
      if (!ctx.beadsEnabled) {
        return {
          handled: true,
          message: "Beads is disabled. Enable with /beads on",
          isError: true,
        };
      }

      // For now, show a message - real implementation needs beads_ready tool
      ctx.addMessage("system", "Fetching task status...");
      
      try {
        // Query the agent for task status
        let response = "";
        for await (const event of ctx.agent.run("Show me the current Beads task status. Use the beads_ready tool.")) {
          if (event.type === "text") {
            response += event.content;
          }
        }
        return { handled: true, message: response || "No active tasks" };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { handled: true, message: `Failed to fetch tasks: ${msg}`, isError: true };
      }
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
    name: "setup",
    description: "Launch interactive setup wizard",
    category: "action",
    handler: async (_, ctx) => {
      ctx.addMessage("system", "🔧 Sharkbait Setup Wizard\n");
      
      const config = loadConfig();
      const checks = [];
      
      // Check Azure OpenAI configuration
      if (config.azure.endpoint && config.azure.apiKey) {
        checks.push("✓ Azure OpenAI configured");
      } else {
        checks.push("✗ Azure OpenAI not configured");
        checks.push("  Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY environment variables");
      }
      
      // Check working directory
      checks.push(`✓ Working directory: ${ctx.currentDir}`);
      
      // Check model
      checks.push(`✓ Model: ${ctx.currentModel}`);
      
      // Check beads
      checks.push(`${ctx.beadsEnabled ? "✓" : "✗"} Beads: ${ctx.beadsEnabled ? "enabled" : "disabled"}`);
      
      // Check git
      try {
        const { execSync } = require("child_process");
        execSync("git rev-parse --git-dir", { cwd: ctx.currentDir, stdio: "pipe" });
        checks.push("✓ Git repository detected");
      } catch {
        checks.push("✗ Not a git repository");
      }
      
      return {
        handled: true,
        message: checks.join("\n") + "\n\nTo configure:\n  • Set env vars for Azure OpenAI\n  • Run /init to initialize project\n  • Use /beads on to enable task tracking",
      };
    },
  },

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
    name: "ask",
    description: "Ask a one-off question (no conversation history)",
    usage: "/ask <question>",
    args: "<question>",
    category: "action",
    handler: async (args, ctx) => {
      if (!args) {
        return { handled: true, message: "Usage: /ask <question>\n\nExample: /ask what does the login function do?", isError: true };
      }

      ctx.addMessage("user", args);
      
      try {
        let response = "";
        for await (const event of ctx.agent.run(args)) {
          if (event.type === "text") {
            response += event.content;
          }
        }
        ctx.addMessage("assistant", response);
        return { handled: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { handled: true, message: `Ask failed: ${msg}`, isError: true };
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

  // === Review Commands ===
  {
    name: "review",
    aliases: ["r"],
    description: "Run parallel code review on a file",
    usage: "/review <file> [--mode bugs|security|style|performance|all]",
    args: "<file> [--mode <mode>]",
    category: "action",
    handler: async (args, ctx) => {
      if (!args) {
        return { 
          handled: true, 
          message: "Usage: /review <file> [--mode bugs|security|style|performance|all]\n\nExample:\n  /review src/app.ts             # Full parallel review (all modes)\n  /review src/app.ts --mode bugs # Single mode review\n  /review src/app.ts --mode security,performance  # Multiple modes",
          isError: true,
        };
      }

      // Parse args
      const parts = args.split(/\s+/);
      let filePath = parts[0] ?? "";
      let modes: string[] = ["bugs", "security", "style", "performance"]; // default: all

      const modeIdx = parts.indexOf("--mode");
      if (modeIdx !== -1 && parts[modeIdx + 1]) {
        const modeArg = parts[modeIdx + 1] ?? "";
        if (modeArg === "all") {
          modes = ["bugs", "security", "style", "performance"];
        } else {
          modes = modeArg.split(",").filter(m => 
            ["bugs", "security", "style", "performance"].includes(m)
          );
          if (modes.length === 0) {
            return {
              handled: true,
              message: `Invalid modes. Available: bugs, security, style, performance, all`,
              isError: true,
            };
          }
        }
      }

      // Resolve file path
      const resolvedPath = isAbsolute(filePath) ? filePath : resolve(ctx.currentDir, filePath);
      
      if (!existsSync(resolvedPath)) {
        return {
          handled: true,
          message: `File not found: ${resolvedPath}`,
          isError: true,
        };
      }

      // Read file content
      let fileContent: string;
      try {
        fileContent = readFileSync(resolvedPath, "utf-8");
      } catch (error) {
        return {
          handled: true,
          message: `Cannot read file: ${error instanceof Error ? error.message : String(error)}`,
          isError: true,
        };
      }

      // Emit parallel_start event - show progress UI
      const agentProgress = modes.map(mode => ({
        name: "reviewer",
        mode,
        status: "pending" as const,
        progress: 0,
      }));

      ctx.emitParallelStart(agentProgress, "all");

      // Initialize the parallel executor
      try {
        const config = loadConfig();
        const llm = new AzureOpenAIClient({
          endpoint: config.azure.endpoint,
          apiKey: config.azure.apiKey,
          deployment: config.azure.deployment,
          apiVersion: config.azure.apiVersion,
        });
        const toolRegistry = new ToolRegistry({ enableBeads: false });
        const factory = new AgentFactory(llm, toolRegistry);
        const agents = factory.createAll();
        const executor = new ParallelExecutor(agents);

        // Build invocations
        const input = `Review this file:\n\nFile: ${resolvedPath}\n\n\`\`\`\n${fileContent}\n\`\`\``;
        
        const invocations = modes.map(mode => ({
          agent: "reviewer" as const,
          mode: mode as "bugs" | "security" | "style" | "performance",
          input,
          weight: mode === "security" ? 1.5 : mode === "style" ? 0.5 : mode === "performance" ? 0.8 : 1.0,
        }));

        // Update progress to running
        ctx.emitParallelProgress(modes.map(mode => ({
          name: "reviewer",
          mode,
          status: "running" as const,
          progress: 25,
        })));

        // Execute parallel review
        const result = await executor.execute({
          agents: invocations,
          strategy: "all",
          consolidation: "merge",
          timeout: 120000,
        });

        // Format results
        let output = `\n📋 **Parallel Review Complete** (${(result.durationMs / 1000).toFixed(1)}s)\n\n`;
        output += `Strategy: ${result.strategy} | Modes: ${modes.join(", ")}\n\n`;
        
        if (result.timedOut) {
          output += "⚠️ Some reviews timed out\n\n";
        }

        output += "---\n\n";
        output += result.consolidated || "No issues found.";

        // Emit complete - clears progress UI and shows result
        const finalProgress = modes.map((mode, i) => ({
          name: "reviewer",
          mode,
          status: (result.results[i]?.success ? "complete" : "error") as "complete" | "error",
          progress: 100,
          duration: result.results[i]?.durationMs,
          error: result.results[i]?.error,
        }));

        ctx.emitParallelComplete(finalProgress, output);

        return { handled: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // Clear progress UI on error
        ctx.emitParallelComplete(
          modes.map(mode => ({ name: "reviewer", mode, status: "error" as const, progress: 0, error: msg })),
          ""
        );
        return {
          handled: true,
          message: `Review failed: ${msg}`,
          isError: true,
        };
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
