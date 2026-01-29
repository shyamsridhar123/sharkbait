/**
 * Ask Command - Ask a one-off question
 */

import { Agent } from "../agent/agent";
import { log } from "../utils/logger";

export interface AskOptions {
  context?: string[];
}

export async function askQuestion(
  question: string,
  options: AskOptions = {}
): Promise<void> {
  const agent = new Agent({
    contextFiles: options.context,
  });

  log.debug(`Asking: ${question}`);

  try {
    for await (const event of agent.run(question)) {
      switch (event.type) {
        case "text":
          process.stdout.write(event.content);
          break;
        case "tool_start":
          log.info(`\n[${event.name}]`);
          break;
        case "tool_result":
          // Don't show tool results by default
          break;
        case "tool_error":
          log.error(`[${event.name} failed: ${event.error}]`);
          break;
        case "error":
          log.error(event.message);
          break;
        case "done":
          process.stdout.write("\n");
          break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(`Error: ${message}`);
    process.exit(1);
  }
}
