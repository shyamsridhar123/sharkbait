/**
 * Run Command - Execute a task autonomously
 */

import { Agent } from "../agent/agent";
import { log } from "../utils/logger";

export interface RunOptions {
  dryRun?: boolean;
}

export async function runTask(
  task: string,
  options: RunOptions = {}
): Promise<void> {
  if (options.dryRun) {
    log.info("[DRY RUN] Would execute task:");
    log.info(`  ${task}`);
    log.info("");
    log.info("In dry run mode, no changes will be made.");
    return;
  }

  const agent = new Agent({
    enableBeads: true,
  });

  log.info(`Executing task: ${task}`);
  log.info("");

  // Build a more specific prompt for autonomous execution
  const autonomousPrompt = `
Execute the following task autonomously:

${task}

Guidelines:
1. Break down the task into clear steps
2. Execute each step, handling any errors
3. Report progress and results
4. Ask for clarification ONLY if absolutely necessary
5. Create a Beads task to track this work

Begin:
`;

  try {
    for await (const event of agent.run(autonomousPrompt)) {
      switch (event.type) {
        case "text":
          process.stdout.write(event.content);
          break;
        case "tool_start":
          log.info(`\n→ ${event.name}`);
          break;
        case "tool_result":
          log.debug(`  ✓ ${event.name} completed`);
          break;
        case "tool_error":
          log.error(`  ✗ ${event.name}: ${event.error}`);
          break;
        case "replan":
          log.warn(`\n⟳ Re-planning: ${event.reason}`);
          break;
        case "error":
          log.error(`\nError: ${event.message}`);
          process.exit(1);
          break;
        case "done":
          log.success("\n\nTask completed.");
          break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(`Task failed: ${message}`);
    process.exit(1);
  }
}
