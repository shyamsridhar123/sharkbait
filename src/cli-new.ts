#!/usr/bin/env bun

/**
 * Sharkbait CLI - Enhanced entry point inspired by Claude Code
 *
 * Main entry point for the command-line interface with modular architecture,
 * command registry, proper error handling, and graceful shutdown.
 */

import { initialize, setupProcessHandlers, type AppInstance } from "./index.js";
import { commandRegistry } from "./commands/registry.js";
import { registerCommands } from "./commands/register.js";
import { log as logger } from "./utils/logger.js";
import { UserError } from "./utils/errors.js";

// Version (hardcoded for compiled binary compatibility)
const VERSION = "1.0.0";

/**
 * Display help information
 */
function displayHelp(commandName?: string): void {
  if (commandName && commandName !== "help") {
    const command = commandRegistry.get(commandName);

    if (!command) {
      console.error(`Unknown command: ${commandName}`);
      console.error('Use "sharkbait help" to see available commands.');
      process.exit(1);
    }

    console.log(commandRegistry.generateCommandHelp(command));
    return;
  }

  console.log(commandRegistry.generateHelp(VERSION));
}

/**
 * Display version information
 */
function displayVersion(): void {
  console.log(`Sharkbait CLI v${VERSION}`);
}

/**
 * Parse command-line arguments
 */
function parseCommandLineArgs(): {
  commandName: string;
  args: string[];
  options: Record<string, any>;
} {
  const args = process.argv.slice(2);

  // Handle empty command - default to 'chat'
  if (args.length === 0) {
    return { commandName: "chat", args: [], options: {} };
  }

  const commandName = args[0].toLowerCase();

  // Handle help command
  if (commandName === "help" || commandName === "--help" || commandName === "-h") {
    displayHelp(args[1]);
    process.exit(0);
  }

  // Handle version command
  if (commandName === "version" || commandName === "--version" || commandName === "-v") {
    displayVersion();
    process.exit(0);
  }

  // Simple option parsing (commander handles this in actual commands)
  const options: Record<string, any> = {};
  const positionalArgs: string[] = [];

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith("-")) {
      const key = arg.slice(1);
      options[key] = true;
    } else {
      positionalArgs.push(arg);
    }
  }

  return { commandName, args: positionalArgs, options };
}

/**
 * Handle errors
 */
function handleError(error: unknown): void {
  if (error instanceof UserError) {
    console.error(`Error: ${error.message}`);
    if (error.details) {
      console.error(`Details: ${error.details}`);
    }
    process.exit(1);
  } else if (error instanceof Error) {
    logger.error("Unexpected error:", error);
    console.error(`Unexpected error: ${error.message}`);
    if (process.env.SHARKBAIT_LOG_LEVEL === "debug") {
      console.error(error.stack);
    }
    process.exit(2);
  } else {
    console.error("An unknown error occurred");
    process.exit(2);
  }
}

/**
 * Register built-in commands that don't require app instance
 */
function registerBuiltinCommands(): void {
  // Help command
  commandRegistry.register({
    name: "help",
    description: "Show help information",
    category: "Built-in",
    hidden: true,
    handler: async (args) => {
      displayHelp(args[0]);
    },
  });

  // Version command
  commandRegistry.register({
    name: "version",
    description: "Show version information",
    category: "Built-in",
    hidden: true,
    handler: async () => {
      displayVersion();
    },
  });
}

/**
 * Register command stubs for help system (without requiring app initialization)
 */
function registerCommandStubs(): void {
  // Register stubs with metadata for help, but handlers that require app
  const needsApp = () => { throw new Error("App not initialized"); };

  commandRegistry.register({
    name: "chat",
    description: "Start interactive chat session",
    category: "Core",
    usage: "sharkbait chat [options]",
    options: [
      { flags: "-c, --context <files...>", description: "Include specific files in context" },
      { flags: "-w, --working-dir <dir>", description: "Set working directory" },
      { flags: "--no-beads", description: "Disable Beads task tracking" },
    ],
    examples: [
      "sharkbait chat",
      "sharkbait chat --context src/main.ts",
      "sharkbait chat --no-beads"
    ],
    handler: needsApp,
  });

  commandRegistry.register({
    name: "ask",
    description: "Ask a one-off question",
    category: "Core",
    usage: "sharkbait ask <question> [options]",
    options: [
      { flags: "-c, --context <files...>", description: "Include specific files in context" },
    ],
    examples: [
      'sharkbait ask "How do I implement a binary search tree?"',
      'sharkbait ask "Explain this function" --context src/utils/helper.ts'
    ],
    handler: needsApp,
  });

  commandRegistry.register({
    name: "run",
    description: "Execute a task autonomously",
    category: "Core",
    usage: "sharkbait run <task> [options]",
    options: [
      { flags: "--dry-run", description: "Show what would be done without doing it" },
    ],
    examples: [
      'sharkbait run "Add input validation to the API"',
      'sharkbait run "Refactor authentication module" --dry-run'
    ],
    handler: needsApp,
  });

  commandRegistry.register({
    name: "review",
    description: "Run parallel code review on a file",
    category: "Code Quality",
    usage: "sharkbait review <file> [options]",
    options: [
      { flags: "-m, --mode <modes>", description: "Review modes: bugs,security,style,performance,all (default: all)" },
      { flags: "--parallel", description: "Run modes in parallel (default)", defaultValue: "true" },
    ],
    examples: [
      "sharkbait review src/auth.ts",
      "sharkbait review src/api.ts --mode security,bugs",
      "sharkbait review src/utils.ts --mode performance"
    ],
    handler: needsApp,
  });

  commandRegistry.register({
    name: "init",
    description: "Initialize Sharkbait in current project",
    category: "Setup",
    usage: "sharkbait init",
    examples: ["sharkbait init"],
    handler: needsApp,
  });
}

/**
 * Initialize and run the CLI
 */
async function main(): Promise<void> {
  try {
    // Register built-in commands first (they don't need app instance)
    registerBuiltinCommands();

    // Register command stubs for help system
    registerCommandStubs();

    // Parse command-line arguments first (before initializing subsystems)
    const { commandName, args, options } = parseCommandLineArgs();

    // Handle version and help before initializing (they don't need the app)
    if (options.version) {
      displayVersion();
      return;
    }

    if (commandName === "help" || options.help) {
      displayHelp(args[0]);
      return;
    }

    // Check if command exists before initializing app
    const commandStub = commandRegistry.get(commandName);
    if (!commandStub) {
      console.error(`Unknown command: ${commandName}`);
      console.error('Use "sharkbait help" to see available commands.');
      process.exit(1);
    }

    // Initialize application subsystems (only for commands that need them)
    const app = await initialize();

    // Set up process signal handlers
    setupProcessHandlers(app);

    // Register all commands (this replaces the stubs with real handlers)
    registerCommands(app);

    // Get the command (now with real handler)
    const command = commandRegistry.get(commandName);

    if (!command) {
      console.error(`Unknown command: ${commandName}`);
      console.error('Use "sharkbait help" to see available commands.');
      process.exit(1);
    }

    // Execute the command
    await commandRegistry.execute(commandName, args, options, app);
  } catch (error) {
    handleError(error);
  }
}

// Run the CLI
main().catch(handleError);
