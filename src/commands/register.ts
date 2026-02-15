/**
 * Command Registration
 *
 * Registers all available commands with the command registry.
 */

import { commandRegistry } from "./registry.js";
import type { AppInstance } from "../index.js";
import { startChat } from "../agent/index.js";
import { initProject } from "./init.js";
import { askQuestion } from "./ask.js";
import { runTask } from "./run.js";
import { runReview } from "./review.js";

/**
 * Register all commands with the registry
 */
export function registerCommands(app: AppInstance): void {
  // Chat command
  commandRegistry.register({
    name: "chat",
    description: "Start interactive chat session",
    category: "Core",
    usage: "sharkbait chat [options]",
    options: [
      {
        flags: "-c, --context <files...>",
        description: "Include specific files in context",
      },
      {
        flags: "-w, --working-dir <dir>",
        description: "Set working directory",
      },
      {
        flags: "--no-beads",
        description: "Disable Beads task tracking",
      },
    ],
    examples: [
      "sharkbait chat",
      "sharkbait chat --context src/main.ts",
      "sharkbait chat --no-beads",
    ],
    handler: async (args, options) => {
      await startChat(options);
    },
  });

  // Ask command
  commandRegistry.register({
    name: "ask",
    description: "Ask a one-off question",
    category: "Core",
    usage: "sharkbait ask <question> [options]",
    options: [
      {
        flags: "-c, --context <files...>",
        description: "Include specific files in context",
      },
    ],
    examples: [
      'sharkbait ask "How do I implement a binary search tree?"',
      'sharkbait ask "Explain this function" --context src/utils/helper.ts',
    ],
    handler: async (args, options) => {
      const question = args.join(" ");
      if (!question) {
        throw new Error("Please provide a question");
      }
      await askQuestion(question, options);
    },
  });

  // Run command
  commandRegistry.register({
    name: "run",
    description: "Execute a task autonomously",
    category: "Core",
    usage: "sharkbait run <task> [options]",
    options: [
      {
        flags: "--dry-run",
        description: "Show what would be done without doing it",
      },
    ],
    examples: [
      'sharkbait run "Add input validation to the API"',
      'sharkbait run "Refactor authentication module" --dry-run',
    ],
    handler: async (args, options) => {
      const task = args.join(" ");
      if (!task) {
        throw new Error("Please provide a task description");
      }
      await runTask(task, options);
    },
  });

  // Review command
  commandRegistry.register({
    name: "review",
    description: "Run parallel code review on a file",
    category: "Code Quality",
    usage: "sharkbait review <file> [options]",
    options: [
      {
        flags: "-m, --mode <modes>",
        description: "Review modes: bugs,security,style,performance,all",
        defaultValue: "all",
      },
      {
        flags: "--parallel",
        description: "Run modes in parallel (default)",
        defaultValue: true,
      },
    ],
    examples: [
      "sharkbait review src/auth.ts",
      "sharkbait review src/api.ts --mode security,bugs",
      "sharkbait review src/utils.ts --mode performance",
    ],
    handler: async (args, options) => {
      const file = args[0];
      if (!file) {
        throw new Error("Please provide a file path to review");
      }
      await runReview(file, options);
    },
  });

  // Init command
  commandRegistry.register({
    name: "init",
    description: "Initialize Sharkbait in current project",
    category: "Setup",
    usage: "sharkbait init",
    examples: ["sharkbait init"],
    handler: async () => {
      await initProject();
    },
  });

  // Help command (built-in, just for completeness)
  commandRegistry.register({
    name: "help",
    description: "Show help information",
    hidden: true,
    usage: "sharkbait help [command]",
    examples: [
      "sharkbait help",
      "sharkbait help chat",
      "sharkbait help review",
    ],
    handler: async (args) => {
      // Help is handled in the main CLI before we get here
      console.log("Help command should be handled by CLI entry point");
    },
  });

  // Version command (built-in)
  commandRegistry.register({
    name: "version",
    description: "Show version information",
    hidden: true,
    usage: "sharkbait version",
    handler: async () => {
      // Version is handled in the main CLI before we get here
      console.log("Version command should be handled by CLI entry point");
    },
  });
}
