#!/usr/bin/env bun
/**
 * Comprehensive CLI Testing Script
 *
 * Tests the new Claude Code-inspired CLI architecture to ensure it works
 * correctly as a coding assistant.
 */

import { spawn } from "bun";
import { join } from "path";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli-new.ts");

interface TestCase {
  name: string;
  args: string[];
  description: string;
  expectedInOutput?: string[];
  shouldFail?: boolean;
}

const tests: TestCase[] = [
  {
    name: "Version Display",
    args: ["--version"],
    description: "Should display version information",
    expectedInOutput: ["Sharkbait CLI v1.0.0"],
  },
  {
    name: "Version (short flag)",
    args: ["-v"],
    description: "Should display version with -v flag",
    expectedInOutput: ["Sharkbait CLI v1.0.0"],
  },
  {
    name: "General Help",
    args: ["help"],
    description: "Should display general help with all commands",
    expectedInOutput: [
      "Sharkbait CLI v1.0.0",
      "AI-powered coding assistant",
      "Available Commands:",
      "Core:",
      "chat",
      "ask",
      "run",
      "Code Quality:",
      "review",
    ],
  },
  {
    name: "Help (no args should show help for default chat)",
    args: ["help", "chat"],
    description: "Should display help for chat command",
    expectedInOutput: [
      "Command: chat",
      "Description:",
      "Start interactive chat session",
      "Options:",
      "--context",
      "--working-dir",
      "--no-beads",
    ],
  },
  {
    name: "Help for specific command (ask)",
    args: ["help", "ask"],
    description: "Should display detailed help for ask command",
    expectedInOutput: [
      "Command: ask",
      "Description:",
      "Ask a one-off question",
      "Usage:",
      "sharkbait ask <question>",
      "Examples:",
    ],
  },
  {
    name: "Help for specific command (review)",
    args: ["help", "review"],
    description: "Should display detailed help for review command",
    expectedInOutput: [
      "Command: review",
      "Description:",
      "Run parallel code review",
      "Code Quality",
      "--mode",
      "bugs,security,style,performance",
    ],
  },
  {
    name: "Help for specific command (run)",
    args: ["help", "run"],
    description: "Should display detailed help for run command",
    expectedInOutput: [
      "Command: run",
      "Description:",
      "Execute a task autonomously",
      "--dry-run",
    ],
  },
  {
    name: "Help for specific command (init)",
    args: ["help", "init"],
    description: "Should display detailed help for init command",
    expectedInOutput: [
      "Command: init",
      "Description:",
      "Initialize Sharkbait",
      "Setup:",
    ],
  },
  {
    name: "Unknown Command Error",
    args: ["nonexistent"],
    description: "Should display error for unknown command",
    expectedInOutput: ["Unknown command: nonexistent", 'Use "sharkbait help"'],
    shouldFail: true,
  },
];

async function runTest(test: TestCase): Promise<{
  passed: boolean;
  output: string;
  error?: string;
}> {
  try {
    const proc = spawn(["bun", CLI_PATH, ...test.args], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    const allOutput = output + stderr;

    // Check expected output
    let passed = true;
    const missing: string[] = [];

    if (test.expectedInOutput) {
      for (const expected of test.expectedInOutput) {
        if (!allOutput.includes(expected)) {
          passed = false;
          missing.push(expected);
        }
      }
    }

    // Check exit code
    if (test.shouldFail && exitCode === 0) {
      passed = false;
    } else if (!test.shouldFail && exitCode !== 0) {
      passed = false;
    }

    return {
      passed: passed && missing.length === 0,
      output: allOutput,
      error: missing.length > 0 ? `Missing in output: ${missing.join(", ")}` : undefined,
    };
  } catch (error) {
    return {
      passed: false,
      output: "",
      error: `Error running test: ${error}`,
    };
  }
}

async function main() {
  console.log("🧪 Testing New CLI Architecture\n");
  console.log("=" .repeat(80));
  console.log("\n");

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Description: ${test.description}`);
    console.log(`   Command: bun ${CLI_PATH} ${test.args.join(" ")}`);

    const result = await runTest(test);

    if (result.passed) {
      console.log(`   ✅ PASSED`);
      passed++;
    } else {
      console.log(`   ❌ FAILED`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      failed++;
    }

    // Show output (truncated)
    const lines = result.output.split("\n");
    const preview = lines.slice(0, 15).join("\n");
    console.log(`\n   Output (first 15 lines):`);
    console.log("   " + "-".repeat(76));
    preview.split("\n").forEach((line) => console.log(`   ${line}`));
    if (lines.length > 15) {
      console.log(`   ... (${lines.length - 15} more lines)`);
    }
    console.log("   " + "-".repeat(76));
  }

  console.log("\n");
  console.log("=" .repeat(80));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

  if (failed > 0) {
    console.log("\n❌ Some tests failed. Please review the output above.");
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed! The CLI architecture works correctly.");
    process.exit(0);
  }
}

main();
