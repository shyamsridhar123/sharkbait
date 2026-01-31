/**
 * Review Command - Parallel code review from CLI
 */

import { readFileSync, existsSync } from "fs";
import { resolve, isAbsolute } from "path";
import { AzureOpenAIClient } from "../llm/azure-openai";
import { ToolRegistry } from "../tools";
import { AgentFactory, ParallelExecutor } from "../agents";
import { loadConfig } from "../utils/config";
import { log } from "../utils/logger";

interface ReviewOptions {
  mode?: string;
  parallel?: boolean;
}

/**
 * Run parallel code review on a file
 */
export async function runReview(
  filePath: string,
  options: ReviewOptions = {}
): Promise<void> {
  const config = loadConfig();
  
  // Resolve file path
  const resolvedPath = isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
  
  if (!existsSync(resolvedPath)) {
    console.error(`❌ File not found: ${resolvedPath}`);
    process.exit(1);
  }

  // Read file content
  let fileContent: string;
  try {
    fileContent = readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    console.error(`❌ Cannot read file: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Determine modes
  let modes: string[];
  if (options.mode) {
    if (options.mode === "all") {
      modes = ["bugs", "security", "style", "performance"];
    } else {
      modes = options.mode.split(",").filter(m => 
        ["bugs", "security", "style", "performance"].includes(m)
      );
    }
  } else {
    // Default: parallel all modes
    modes = ["bugs", "security", "style", "performance"];
  }

  if (modes.length === 0) {
    console.error("❌ No valid modes specified. Use: bugs, security, style, performance, or all");
    process.exit(1);
  }

  log.info(`Starting parallel review of ${resolvedPath} with modes: ${modes.join(", ")}`);
  
  console.log(`\n🦈 Sharkbait Parallel Review`);
  console.log(`📄 File: ${resolvedPath}`);
  console.log(`🔀 Modes: ${modes.join(", ")}\n`);

  // Show initial status
  console.log("┌" + "─".repeat(58) + "┐");
  console.log("│ Parallel Code Review" + " ".repeat(37) + "│");
  console.log("├" + "─".repeat(58) + "┤");
  for (const mode of modes) {
    console.log(`│ ○ ${mode.padEnd(15)} Pending${" ".repeat(33)}│`);
  }
  console.log("└" + "─".repeat(58) + "┘\n");

  try {
    // Initialize LLM and tools
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
    const input = `Review this file for issues:\n\nFile: ${resolvedPath}\n\n\`\`\`\n${fileContent}\n\`\`\``;
    
    const invocations = modes.map(mode => ({
      agent: "reviewer" as const,
      mode: mode as "bugs" | "security" | "style" | "performance",
      input,
      weight: mode === "security" ? 1.5 : mode === "style" ? 0.5 : 1.0,
    }));

    console.log(`⏳ Running ${modes.length} review modes in parallel...\n`);

    // Execute parallel review
    const startTime = Date.now();
    const result = await executor.execute({
      agents: invocations,
      strategy: "all",
      consolidation: "merge",
      timeout: 120000,
    });
    const totalTime = Date.now() - startTime;

    // Display results
    console.log(`\n${"━".repeat(60)}`);
    console.log(`📋 Review Complete (${(totalTime / 1000).toFixed(1)}s total)\n`);

    if (result.timedOut) {
      console.log("⚠️  Some reviews timed out\n");
    }

    // Show individual results
    console.log("┌" + "─".repeat(58) + "┐");
    console.log("│ Results" + " ".repeat(50) + "│");
    console.log("├" + "─".repeat(58) + "┤");
    for (let i = 0; i < modes.length; i++) {
      const mode = modes[i];
      const agentResult = result.results[i];
      
      if (!agentResult) {
        console.log(`│ ✗ ${mode?.padEnd(15) ?? "unknown"} No result${" ".repeat(32)}│`);
        continue;
      }

      if (agentResult.success) {
        const duration = `(${(agentResult.durationMs / 1000).toFixed(1)}s)`;
        console.log(`│ ✓ ${mode?.padEnd(15) ?? "unknown"} Complete ${duration.padEnd(25)}│`);
      } else {
        const errMsg = (agentResult.error || "Failed").slice(0, 25);
        console.log(`│ ✗ ${mode?.padEnd(15) ?? "unknown"} ${errMsg.padEnd(34)}│`);
      }
    }
    console.log("└" + "─".repeat(58) + "┘");

    // Show consolidated output
    if (result.consolidated) {
      console.log(`\n${"━".repeat(60)}`);
      console.log(`\n📝 Consolidated Review:\n`);
      console.log(result.consolidated);
    } else {
      console.log("\n✅ No issues found!");
    }

    console.log();
  } catch (error) {
    console.error(`\n❌ Review failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
