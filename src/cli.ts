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

// Read version from package.json
const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();

const program = new Command();

program
  .name("sharkbait")
  .description("AI coding assistant for the command line")
  .version(pkg.version);

program
  .command("chat")
  .description("Start interactive chat session")
  .option("-c, --context <files...>", "Include specific files in context")
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
