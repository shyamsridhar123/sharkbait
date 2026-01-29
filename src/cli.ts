#!/usr/bin/env bun

/**
 * Sharkbait CLI - AI coding assistant for the command line
 * Entry point for the command-line interface
 */

import { Command } from "commander";
import { startChat } from "./agent";
import { initProject } from "./commands/init";
import { askQuestion } from "./commands/ask";
import { runTask } from "./commands/run";

// Version hardcoded for compiled binary compatibility
const VERSION = "1.0.0";

// Check if no args - start chat directly
const args = process.argv.slice(2);
if (args.length === 0) {
  await startChat({});
  process.exit(0);
}

const program = new Command();

program
  .name("sharkbait")
  .description("AI coding assistant for the command line")
  .version(VERSION);

program
  .command("chat")
  .description("Start interactive chat session")
  .option("-c, --context <files...>", "Include specific files in context")
  .option("-w, --working-dir <dir>", "Set working directory")
  .option("--no-beads", "Disable Beads task tracking")
  .action(startChat);

program
  .command("init")
  .description("Initialize Sharkbait in current project")
  .action(initProject);

program
  .command("ask <question>")
  .description("Ask a one-off question")
  .option("-c, --context <files...>", "Include specific files in context")
  .action(askQuestion);

program
  .command("run <task>")
  .description("Execute a task autonomously")
  .option("--dry-run", "Show what would be done without doing it")
  .action(runTask);

program.parse();
