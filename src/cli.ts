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
import { runSetup } from "./commands/setup";
import { runReview } from "./commands/review";
import { VERSION } from "./version";
import { SHARK_LOGO } from "./ui/logo";
import { existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Check if no args - start chat or setup
const args = process.argv.slice(2);
if (args.length === 0) {
  const configExists = existsSync(join(homedir(), ".sharkbait", "config.json"));
  if (!configExists) {
    await runSetup();
  } else {
    await startChat({});
  }
  process.exit(0);
}

const program = new Command();

program
  .name("sharkbait")
  .description("AI coding assistant for the command line")
  .version(VERSION)
  .addHelpText("before", `\x1b[36m${SHARK_LOGO}\x1b[0m\n`);

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

program
  .command("setup")
  .description("Interactive setup wizard for configuring Sharkbait")
  .action(runSetup);

program
  .command("review <file>")
  .description("Run parallel code review on a file")
  .option("-m, --mode <modes>", "Review modes: bugs,security,style,performance,all", "all")
  .option("--parallel", "Run modes in parallel (default)", true)
  .action((file, options) => runReview(file, options));

program.parse();
