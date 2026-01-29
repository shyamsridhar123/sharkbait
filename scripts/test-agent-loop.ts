#!/usr/bin/env bun

/**
 * Real Agent Loop Tests - No mocks, live LLM calls
 * Tests the full agent loop with actual Azure OpenAI
 */

import { Agent } from "../src/agent";

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

async function runTest(name: string, query: string): Promise<boolean> {
  console.log(`\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
  console.log(`${BOLD}TEST: ${name}${RESET}`);
  console.log(`${CYAN}Query: "${query}"${RESET}`);
  console.log(`${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`);
  
  const agent = new Agent({ enableBeads: false });
  const events: any[] = [];
  let response = "";
  let toolsCalled: string[] = [];
  
  const startTime = Date.now();
  
  try {
    for await (const event of agent.run(query)) {
      events.push(event);
      
      switch (event.type) {
        case "text":
          response += event.content;
          process.stdout.write(event.content);
          break;
        case "tool_start":
          console.log(`\n${CYAN}[Tool: ${event.name}]${RESET}`);
          toolsCalled.push(event.name);
          break;
        case "tool_result":
          console.log(`${GREEN}[✓ ${event.name} completed]${RESET}`);
          break;
        case "tool_error":
          console.log(`${RED}[✗ ${event.name}: ${event.error}]${RESET}`);
          break;
        case "replan":
          console.log(`${YELLOW}[Replanning: ${event.reason}]${RESET}`);
          break;
        case "error":
          console.log(`${RED}[Error: ${event.message}]${RESET}`);
          break;
        case "done":
          break;
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`\n\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${GREEN}✓ PASSED${RESET} (${duration}ms)`);
    console.log(`  Events: ${events.length}`);
    console.log(`  Tools called: ${toolsCalled.length > 0 ? toolsCalled.join(", ") : "none"}`);
    console.log(`  Response length: ${response.length} chars`);
    
    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`);
    console.log(`${RED}✗ FAILED${RESET} (${duration}ms)`);
    console.log(`  Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function main() {
  console.log(`\n${CYAN}${"═".repeat(64)}${RESET}`);
  console.log(`${CYAN}${BOLD}     🦈 SHARKBAIT REAL AGENT LOOP TESTS (Live LLM) 🦈${RESET}`);
  console.log(`${CYAN}${"═".repeat(64)}${RESET}`);
  
  const results: { name: string; passed: boolean }[] = [];
  
  // Test 1: Simple query - no tools
  results.push({
    name: "Simple Query (no tools)",
    passed: await runTest(
      "Simple Query (no tools)",
      "What is 2+2? Answer with just the number."
    )
  });
  
  // Test 2: Single tool call
  results.push({
    name: "Single Tool (list_directory)",
    passed: await runTest(
      "Single Tool (list_directory)",
      "List the files in the src/ui directory. Just list them briefly."
    )
  });
  
  // Test 3: Multi-tool chain
  results.push({
    name: "Multi-Tool Chain (list + read)",
    passed: await runTest(
      "Multi-Tool Chain (list + read)",
      "Read the first 20 lines of src/cli.ts and tell me what the main CLI commands are."
    )
  });
  
  // Test 4: Tool with analysis
  results.push({
    name: "Read + Analyze",
    passed: await runTest(
      "Read + Analyze",
      "Read package.json and tell me the project name and version."
    )
  });
  
  // Test 5: Git status (read-only)
  results.push({
    name: "Git Status",
    passed: await runTest(
      "Git Status",
      "What's the current git status? Just a brief summary."
    )
  });
  
  // Test 6: Search/grep
  results.push({
    name: "Search Files",
    passed: await runTest(
      "Search Files",
      "Find all files that contain the word 'AgentLoop' - just list the file paths."
    )
  });
  
  // Summary
  console.log(`\n\n${CYAN}${"═".repeat(64)}${RESET}`);
  console.log(`${CYAN}${BOLD}                    TEST SUMMARY${RESET}`);
  console.log(`${CYAN}${"═".repeat(64)}${RESET}\n`);
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  for (const result of results) {
    const icon = result.passed ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${result.name}`);
  }
  
  console.log(`\n${CYAN}${"─".repeat(64)}${RESET}`);
  console.log(`  ${GREEN}Passed: ${passed}${RESET}  |  ${failed > 0 ? RED : ""}Failed: ${failed}${RESET}`);
  console.log(`${CYAN}${"═".repeat(64)}${RESET}\n`);
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);
