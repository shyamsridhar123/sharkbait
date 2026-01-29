/**
 * Start Chat - Interactive chat session entry point
 */

import { Agent } from "./agent";
import { log } from "../utils/logger";

export interface ChatOptions {
  context?: string[];
  beads?: boolean;
}

export async function startChat(options: ChatOptions = {}): Promise<void> {
  const agent = new Agent({
    contextFiles: options.context,
    enableBeads: options.beads ?? true,
  });

  log.info("Starting Sharkbait interactive chat...");
  log.info("Type your message and press Enter. Type 'exit' to quit.\n");

  const stdin = Bun.stdin.stream();
  const reader = stdin.getReader();
  const decoder = new TextDecoder();

  process.stdout.write("> ");

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    
    // Check for newlines
    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      
      if (line.toLowerCase() === "exit" || line.toLowerCase() === "quit") {
        log.info("Goodbye!");
        return;
      }
      
      if (line.length === 0) {
        process.stdout.write("> ");
        continue;
      }

      try {
        for await (const event of agent.run(line)) {
          switch (event.type) {
            case "text":
              process.stdout.write(event.content);
              break;
            case "tool_start":
              log.info(`\n[Calling ${event.name}...]`);
              break;
            case "tool_result":
              log.debug(`[${event.name} completed]`);
              break;
            case "tool_error":
              log.error(`[${event.name} failed: ${event.error}]`);
              break;
            case "replan":
              log.warn(`[Re-planning: ${event.reason}]`);
              break;
            case "error":
              log.error(`Error: ${event.message}`);
              break;
            case "done":
              process.stdout.write("\n");
              break;
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        log.error(`Error: ${message}`);
      }

      process.stdout.write("\n> ");
    }
  }
}
