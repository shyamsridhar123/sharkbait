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
import { logger } from "./utils/logger.js";
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
 * Initialize and run the CLI
 */
async function main(): Promise<void> {
  try {
    // Initialize application subsystems
    const app = await initialize();

    // Set up process signal handlers
    setupProcessHandlers(app);

    // Register all commands
    registerCommands(app);

    // Parse command-line arguments
    const { commandName, args, options } = parseCommandLineArgs();

    // Get the command
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
