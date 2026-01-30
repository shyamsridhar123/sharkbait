#!/usr/bin/env bun

/**
 * Comprehensive UX Test Suite for Sharkbait
 * 
 * Tests multiple UX scenarios:
 * 1. App Creation - Create a new app from scratch
 * 2. Feature Development - Add features to existing app
 * 3. Debugging - Identify and fix bugs
 * 4. Code Review - Review code quality
 * 5. Refactoring - Improve code structure
 * 
 * Run with: bun run tests/e2e/comprehensive-ux-tests.ts
 */

import { Agent } from "../../src/agent";
import { AgentFactory } from "../../src/agents";
import { AzureOpenAIClient } from "../../src/llm/azure-openai";
import { ToolRegistry } from "../../src/tools";
import { loadConfig } from "../../src/utils/config";
import * as fs from "fs";
import * as path from "path";

// Colors for output
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";
const MAGENTA = "\x1b[35m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

// Test configuration
const SANDBOX_PATH = "C:\\Users\\shyamsridhar\\code\\sharkbait\\sandbox\\ux-test";
const TEST_PROJECT_PATH = path.join(SANDBOX_PATH, "todo-app");

interface TestResult {
  scenario: string;
  test: string;
  passed: boolean;
  duration: number;
  toolsCalled: string[];
  filesCreated: string[];
  filesModified: string[];
  error?: string;
  details?: string;
}

interface ScenarioResult {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  totalDuration: number;
}

const scenarioResults: ScenarioResult[] = [];

// ============================================================================
// Utility Functions
// ============================================================================

function header(title: string) {
  console.log(`\n${CYAN}${"═".repeat(80)}${RESET}`);
  console.log(`${CYAN}${BOLD}  🦈 ${title}${RESET}`);
  console.log(`${CYAN}${"═".repeat(80)}${RESET}\n`);
}

function scenarioHeader(num: number, title: string) {
  console.log(`\n${MAGENTA}┌${"─".repeat(78)}┐${RESET}`);
  console.log(`${MAGENTA}│${RESET} ${BOLD}Scenario ${num}: ${title}${" ".repeat(Math.max(0, 66 - title.length))}${MAGENTA}│${RESET}`);
  console.log(`${MAGENTA}└${"─".repeat(78)}┘${RESET}\n`);
}

function testStart(name: string) {
  process.stdout.write(`  ${DIM}⏳${RESET} ${name}... `);
}

function testPass(duration: number, details?: string) {
  console.log(`${GREEN}✓${RESET} ${DIM}(${duration}ms)${RESET}`);
  if (details) {
    console.log(`     ${DIM}${details}${RESET}`);
  }
}

function testFail(duration: number, error?: string) {
  console.log(`${RED}✗${RESET} ${DIM}(${duration}ms)${RESET}`);
  if (error) {
    console.log(`     ${RED}${error}${RESET}`);
  }
}

function cleanupSandbox() {
  if (fs.existsSync(SANDBOX_PATH)) {
    fs.rmSync(SANDBOX_PATH, { recursive: true });
  }
  fs.mkdirSync(SANDBOX_PATH, { recursive: true });
  console.log(`${DIM}  ✓ Cleaned sandbox: ${SANDBOX_PATH}${RESET}`);
}

function collectFiles(dir: string, baseDir: string = dir): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  return files;
}

async function runAgentTask(
  agent: Agent,
  prompt: string,
  options: { maxTokens?: number; timeout?: number } = {}
): Promise<{
  response: string;
  toolsCalled: string[];
  duration: number;
  error?: string;
}> {
  const start = Date.now();
  let response = "";
  const toolsCalled: string[] = [];
  
  try {
    for await (const event of agent.run(prompt)) {
      if (event.type === "text") response += event.content;
      if (event.type === "tool_start") toolsCalled.push(event.name);
    }
    return { response, toolsCalled, duration: Date.now() - start };
  } catch (error) {
    return {
      response,
      toolsCalled,
      duration: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// SCENARIO 1: App Creation UX
// ============================================================================

async function testAppCreation(): Promise<ScenarioResult> {
  scenarioHeader(1, "App Creation - Building a Todo App from Scratch");
  
  const tests: TestResult[] = [];
  const agent = new Agent({ 
    enableBeads: false,
    workingDirectory: SANDBOX_PATH
  });
  
  // Test 1.1: Create project structure
  testStart("Create project directory structure");
  const startFiles = collectFiles(SANDBOX_PATH);
  const start = Date.now();
  
  const { response: r1, toolsCalled: tc1, error: e1 } = await runAgentTask(
    agent,
    `Create a new TypeScript project at ${TEST_PROJECT_PATH.replace(/\\/g, "/")} with the following structure:
     - package.json with name, version, scripts (dev, build, test)
     - tsconfig.json for ES modules
     - src/index.ts as entry point
     - src/types.ts for interfaces
     - README.md with project description
     Create the files with appropriate starter content. Use absolute paths.`
  );
  
  const duration1 = Date.now() - start;
  const endFiles = collectFiles(SANDBOX_PATH);
  const newFiles = endFiles.filter(f => !startFiles.includes(f));
  
  const test1Passed = tc1.some(t => t.includes("write") || t.includes("create")) && newFiles.length >= 3;
  
  if (test1Passed) testPass(duration1, `Created ${newFiles.length} files`);
  else testFail(duration1, e1 || "Files not created");
  
  tests.push({
    scenario: "App Creation",
    test: "Create project structure",
    passed: test1Passed,
    duration: duration1,
    toolsCalled: tc1,
    filesCreated: newFiles,
    filesModified: [],
    error: e1,
    details: `Created: ${newFiles.join(", ")}`,
  });
  
  // Test 1.2: Add Todo model
  testStart("Create Todo data model and types");
  const start2 = Date.now();
  
  const { response: r2, toolsCalled: tc2, error: e2 } = await runAgentTask(
    agent,
    `In the todo-app project at ${TEST_PROJECT_PATH.replace(/\\/g, "/")}, create a types file at src/types.ts with:
     - Todo interface (id: string, title: string, completed: boolean, createdAt: Date)
     - TodoList type (array of Todo)
     - CreateTodoInput interface
     - TodoFilter type ('all' | 'active' | 'completed')
     Use the absolute path when writing the file.`
  );
  
  const duration2 = Date.now() - start2;
  const typesExists = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "types.ts"));
  const test2Passed = tc2.some(t => t.includes("write")) && typesExists;
  
  if (test2Passed) testPass(duration2, "Types file created with interfaces");
  else testFail(duration2, e2 || "Types not created");
  
  tests.push({
    scenario: "App Creation",
    test: "Create Todo model",
    passed: test2Passed,
    duration: duration2,
    toolsCalled: tc2,
    filesCreated: typesExists ? ["src/types.ts"] : [],
    filesModified: [],
    error: e2,
  });
  
  // Test 1.3: Implement TodoService
  testStart("Implement TodoService class");
  const start3 = Date.now();
  
  const { response: r3, toolsCalled: tc3, error: e3 } = await runAgentTask(
    agent,
    `Create ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/services/todo-service.ts with a TodoService class that has:
     - private todos: Todo[] array
     - add(input: CreateTodoInput): Todo - creates and returns new todo
     - remove(id: string): boolean - removes todo by id
     - toggle(id: string): Todo | undefined - toggles completed status
     - list(filter: TodoFilter): Todo[] - returns filtered todos
     - clear(): void - removes all completed todos
     Use the types from types.ts. Use the absolute path when writing.`
  );
  
  const duration3 = Date.now() - start3;
  const serviceExists = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "services", "todo-service.ts"));
  const test3Passed = tc3.length > 0 && serviceExists;
  
  if (test3Passed) testPass(duration3, "TodoService implemented");
  else testFail(duration3, e3 || "Service not created");
  
  tests.push({
    scenario: "App Creation",
    test: "Implement TodoService",
    passed: test3Passed,
    duration: duration3,
    toolsCalled: tc3,
    filesCreated: serviceExists ? ["src/services/todo-service.ts"] : [],
    filesModified: [],
    error: e3,
  });
  
  // Test 1.4: Create CLI interface
  testStart("Create CLI entry point");
  const start4 = Date.now();
  
  const { response: r4, toolsCalled: tc4, error: e4 } = await runAgentTask(
    agent,
    `Update ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/index.ts to be a simple CLI that:
     - Creates a TodoService instance
     - Adds 3 sample todos
     - Lists all todos
     - Toggles the second one
     - Lists active todos
     Print the output using console.log. Use the absolute path.`
  );
  
  const duration4 = Date.now() - start4;
  const indexExists = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "index.ts"));
  let indexContent = "";
  if (indexExists) {
    indexContent = fs.readFileSync(path.join(TEST_PROJECT_PATH, "src", "index.ts"), "utf-8");
  }
  const test4Passed = indexExists && indexContent.includes("TodoService");
  
  if (test4Passed) testPass(duration4, "CLI entry point created");
  else testFail(duration4, e4 || "CLI not implemented");
  
  tests.push({
    scenario: "App Creation",
    test: "Create CLI interface",
    passed: test4Passed,
    duration: duration4,
    toolsCalled: tc4,
    filesCreated: [],
    filesModified: indexExists ? ["src/index.ts"] : [],
    error: e4,
  });
  
  agent.reset();
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  
  return {
    name: "App Creation",
    tests,
    passed,
    failed,
    totalDuration,
  };
}

// ============================================================================
// SCENARIO 2: Feature Development UX
// ============================================================================

async function testFeatureDevelopment(): Promise<ScenarioResult> {
  scenarioHeader(2, "Feature Development - Adding Persistence");
  
  const tests: TestResult[] = [];
  const agent = new Agent({ 
    enableBeads: false,
    workingDirectory: TEST_PROJECT_PATH
  });
  
  // Test 2.1: Add JSON persistence
  testStart("Add file-based persistence");
  const start = Date.now();
  
  const { response: r1, toolsCalled: tc1, error: e1 } = await runAgentTask(
    agent,
    `Add persistence to the todo app. Create ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/services/storage.ts with:
     - StorageService class
     - save(todos: Todo[]): void - saves to todos.json
     - load(): Todo[] - loads from todos.json
     - Handle file not existing gracefully (return empty array)
     Use Node.js fs module. Use the absolute path.`
  );
  
  const duration1 = Date.now() - start;
  const storageExists = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "services", "storage.ts"));
  const test1Passed = tc1.some(t => t.includes("write")) && storageExists;
  
  if (test1Passed) testPass(duration1, "StorageService created");
  else testFail(duration1, e1 || "Storage service not created");
  
  tests.push({
    scenario: "Feature Development",
    test: "Add file-based persistence",
    passed: test1Passed,
    duration: duration1,
    toolsCalled: tc1,
    filesCreated: storageExists ? ["src/services/storage.ts"] : [],
    filesModified: [],
    error: e1,
  });
  
  // Test 2.2: Integrate storage with TodoService
  testStart("Integrate storage with TodoService");
  const start2 = Date.now();
  
  const { response: r2, toolsCalled: tc2, error: e2 } = await runAgentTask(
    agent,
    `Update TodoService at ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/services/todo-service.ts to use StorageService:
     - Load todos from storage in constructor
     - Save todos after any modification (add, remove, toggle, clear)
     - Import and instantiate StorageService
     Use the absolute path when editing.`
  );
  
  const duration2 = Date.now() - start2;
  const serviceContent = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "services", "todo-service.ts"))
    ? fs.readFileSync(path.join(TEST_PROJECT_PATH, "src", "services", "todo-service.ts"), "utf-8")
    : "";
  const test2Passed = serviceContent.includes("Storage");
  
  if (test2Passed) testPass(duration2, "Storage integrated");
  else testFail(duration2, e2 || "Storage not integrated");
  
  tests.push({
    scenario: "Feature Development",
    test: "Integrate storage",
    passed: test2Passed,
    duration: duration2,
    toolsCalled: tc2,
    filesCreated: [],
    filesModified: serviceContent.includes("Storage") ? ["src/services/todo-service.ts"] : [],
    error: e2,
  });
  
  // Test 2.3: Add priority feature
  testStart("Add priority field to todos");
  const start3 = Date.now();
  
  const { response: r3, toolsCalled: tc3, error: e3 } = await runAgentTask(
    agent,
    `Add a priority feature to the todo app at ${TEST_PROJECT_PATH.replace(/\\/g, "/")}:
     1. Add priority: 'low' | 'medium' | 'high' to Todo interface in src/types.ts
     2. Update CreateTodoInput to include optional priority (default 'medium')
     3. Update TodoService.add() to handle priority
     4. Add sortByPriority() method that returns todos sorted by priority (high first)
     Use absolute paths when editing files.`
  );
  
  const duration3 = Date.now() - start3;
  const typesContent = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "types.ts"))
    ? fs.readFileSync(path.join(TEST_PROJECT_PATH, "src", "types.ts"), "utf-8")
    : "";
  const test3Passed = typesContent.includes("priority");
  
  if (test3Passed) testPass(duration3, "Priority feature added");
  else testFail(duration3, e3 || "Priority not added");
  
  tests.push({
    scenario: "Feature Development",
    test: "Add priority feature",
    passed: test3Passed,
    duration: duration3,
    toolsCalled: tc3,
    filesCreated: [],
    filesModified: test3Passed ? ["src/types.ts", "src/services/todo-service.ts"] : [],
    error: e3,
  });
  
  agent.reset();
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  
  return {
    name: "Feature Development",
    tests,
    passed,
    failed,
    totalDuration,
  };
}

// ============================================================================
// SCENARIO 3: Debugging UX
// ============================================================================

async function testDebugging(): Promise<ScenarioResult> {
  scenarioHeader(3, "Debugging - Finding and Fixing Bugs");
  
  const tests: TestResult[] = [];
  
  // Create a file with intentional bugs
  const buggyFilePath = path.join(TEST_PROJECT_PATH, "src", "utils", "buggy.ts");
  fs.mkdirSync(path.join(TEST_PROJECT_PATH, "src", "utils"), { recursive: true });
  fs.writeFileSync(buggyFilePath, `
// This file has intentional bugs for testing

export function calculateTotal(items: { price: number; qty: number }[]): number {
  let total = 0;
  for (let i = 0; i <= items.length; i++) {  // BUG: off-by-one error
    total += items[i].price * items[i].qty;
  }
  return total;
}

export function findItem(items: string[], target: string): number {
  for (let i = 0; i < items.length; i++) {
    if (items[i] = target) {  // BUG: assignment instead of comparison
      return i;
    }
  }
  return -1;
}

export async function fetchData(url: string): Promise<any> {
  const response = await fetch(url);
  return response.json();  // BUG: no error checking
}
`);
  
  console.log(`  ${DIM}Created buggy.ts with intentional bugs${RESET}`);
  
  const agent = new Agent({ 
    enableBeads: false,
    workingDirectory: TEST_PROJECT_PATH
  });
  
  // Test 3.1: Identify bugs
  testStart("Identify bugs in code");
  const start = Date.now();
  
  const { response: r1, toolsCalled: tc1, error: e1 } = await runAgentTask(
    agent,
    `Read ${buggyFilePath.replace(/\\/g, "/")} and identify all the bugs in the code. List each bug with:
     - Line number
     - Description of the bug
     - What would happen when the code runs
     Don't fix them yet, just identify.`
  );
  
  const duration1 = Date.now() - start;
  const foundBugs = r1.toLowerCase().includes("off-by-one") || 
                    r1.toLowerCase().includes("assignment") ||
                    r1.includes("<=") ||
                    r1.includes("= target");
  const test1Passed = tc1.includes("read_file") && foundBugs;
  
  if (test1Passed) testPass(duration1, "Bugs identified correctly");
  else testFail(duration1, e1 || "Bugs not fully identified");
  
  tests.push({
    scenario: "Debugging",
    test: "Identify bugs",
    passed: test1Passed,
    duration: duration1,
    toolsCalled: tc1,
    filesCreated: [],
    filesModified: [],
    error: e1,
    details: foundBugs ? "Found off-by-one and assignment bugs" : "Missed some bugs",
  });
  
  // Test 3.2: Fix the bugs
  testStart("Fix identified bugs");
  const start2 = Date.now();
  
  const { response: r2, toolsCalled: tc2, error: e2 } = await runAgentTask(
    agent,
    `Now fix all the bugs in ${buggyFilePath.replace(/\\/g, "/")}:
     1. Fix the loop bounds issue
     2. Fix the comparison issue  
     3. Add proper error handling for fetch
     Save the fixed file.`
  );
  
  const duration2 = Date.now() - start2;
  const fixedContent = fs.readFileSync(buggyFilePath, "utf-8");
  const bugsFixed = fixedContent.includes("< items.length") && 
                    fixedContent.includes("===") &&
                    (fixedContent.includes("response.ok") || fixedContent.includes("try"));
  const test2Passed = tc2.some(t => t.includes("write") || t.includes("edit")) && bugsFixed;
  
  if (test2Passed) testPass(duration2, "All bugs fixed");
  else testFail(duration2, e2 || "Not all bugs fixed");
  
  tests.push({
    scenario: "Debugging",
    test: "Fix bugs",
    passed: test2Passed,
    duration: duration2,
    toolsCalled: tc2,
    filesCreated: [],
    filesModified: ["src/utils/buggy.ts"],
    error: e2,
  });
  
  // Test 3.3: Trace execution flow
  testStart("Trace execution flow");
  const start3 = Date.now();
  
  const { response: r3, toolsCalled: tc3, error: e3 } = await runAgentTask(
    agent,
    `Trace the execution flow of the TodoService.add() method. 
     What happens step by step from when add() is called to when it returns?
     Consider the storage save operation as well.`
  );
  
  const duration3 = Date.now() - start3;
  const hasTraceDetails = r3.length > 200 && 
    (r3.toLowerCase().includes("storage") || r3.toLowerCase().includes("save"));
  const test3Passed = hasTraceDetails;
  
  if (test3Passed) testPass(duration3, "Execution traced");
  else testFail(duration3, e3 || "Trace incomplete");
  
  tests.push({
    scenario: "Debugging",
    test: "Trace execution",
    passed: test3Passed,
    duration: duration3,
    toolsCalled: tc3,
    filesCreated: [],
    filesModified: [],
    error: e3,
  });
  
  agent.reset();
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  
  return {
    name: "Debugging",
    tests,
    passed,
    failed,
    totalDuration,
  };
}

// ============================================================================
// SCENARIO 4: Code Review UX
// ============================================================================

async function testCodeReview(): Promise<ScenarioResult> {
  scenarioHeader(4, "Code Review - Quality and Security Analysis");
  
  const tests: TestResult[] = [];
  
  const config = loadConfig();
  const llm = new AzureOpenAIClient({
    endpoint: config.azure.endpoint,
    apiKey: config.azure.apiKey,
    deployment: config.azure.deployment,
    apiVersion: config.azure.apiVersion,
  });
  const tools = new ToolRegistry({ 
    enableBeads: false,
    workingDirectory: TEST_PROJECT_PATH
  });
  const factory = new AgentFactory(llm, tools);
  
  // Test 4.1: Security review
  testStart("Security review of storage service");
  const start = Date.now();
  
  const reviewer = factory.create("reviewer");
  reviewer.setMode("security");
  
  let response = "";
  const toolsCalled: string[] = [];
  for await (const event of reviewer.run(
    `Review ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/services/storage.ts for security issues. Look for:
     - File path injection
     - Unsafe deserialization
     - Missing input validation
     Provide specific recommendations. Use the absolute path when reading files.`
  )) {
    if (event.type === "text") response += event.content;
    if (event.type === "tool_start") toolsCalled.push(event.name);
  }
  
  const duration1 = Date.now() - start;
  const hasSecurityAnalysis = response.length > 100;
  const test1Passed = hasSecurityAnalysis;
  
  if (test1Passed) testPass(duration1, "Security analysis provided");
  else testFail(duration1, "Security review incomplete");
  
  tests.push({
    scenario: "Code Review",
    test: "Security review",
    passed: test1Passed,
    duration: duration1,
    toolsCalled,
    filesCreated: [],
    filesModified: [],
    details: `Response length: ${response.length} chars`,
  });
  
  // Test 4.2: Style review (code quality)
  testStart("Code style review");
  const start2 = Date.now();
  
  reviewer.setMode("style");
  
  let response2 = "";
  const toolsCalled2: string[] = [];
  for await (const event of reviewer.run(
    `Review the overall code quality of the todo-app project at ${TEST_PROJECT_PATH.replace(/\\/g, "/")}. Check:
     - Type safety
     - Error handling
     - Code organization
     - Naming conventions
     Provide a summary with a quality score out of 10. Use absolute paths when reading files.`
  )) {
    if (event.type === "text") response2 += event.content;
    if (event.type === "tool_start") toolsCalled2.push(event.name);
  }
  
  const duration2 = Date.now() - start2;
  const hasQualityScore = response2.includes("/10") || response2.includes("out of 10");
  const test2Passed = response2.length > 100;
  
  if (test2Passed) testPass(duration2, hasQualityScore ? "Style score provided" : "Style reviewed");
  else testFail(duration2, "Style review incomplete");
  
  tests.push({
    scenario: "Code Review",
    test: "Style review",
    passed: test2Passed,
    duration: duration2,
    toolsCalled: toolsCalled2,
    filesCreated: [],
    filesModified: [],
  });
  
  // Test 4.3: Performance review
  testStart("Performance analysis");
  const start3 = Date.now();
  
  reviewer.setMode("performance");
  
  let response3 = "";
  const toolsCalled3: string[] = [];
  for await (const event of reviewer.run(
    `Analyze the performance characteristics of TodoService at ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/services/todo-service.ts. Consider:
     - Time complexity of operations
     - Unnecessary iterations
     - Memory usage patterns
     - I/O operations
     Suggest optimizations. Use the absolute path.`
  )) {
    if (event.type === "text") response3 += event.content;
    if (event.type === "tool_start") toolsCalled3.push(event.name);
  }
  
  const duration3 = Date.now() - start3;
  const hasPerformanceAnalysis = response3.toLowerCase().includes("o(") || 
                                  response3.toLowerCase().includes("complexity") ||
                                  response3.toLowerCase().includes("performance");
  const test3Passed = response3.length > 100 && hasPerformanceAnalysis;
  
  if (test3Passed) testPass(duration3, "Performance analyzed");
  else testFail(duration3, "Performance review incomplete");
  
  tests.push({
    scenario: "Code Review",
    test: "Performance analysis",
    passed: test3Passed,
    duration: duration3,
    toolsCalled: toolsCalled3,
    filesCreated: [],
    filesModified: [],
  });
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  
  return {
    name: "Code Review",
    tests,
    passed,
    failed,
    totalDuration,
  };
}

// ============================================================================
// SCENARIO 5: Refactoring UX
// ============================================================================

async function testRefactoring(): Promise<ScenarioResult> {
  scenarioHeader(5, "Refactoring - Improving Code Structure");
  
  const tests: TestResult[] = [];
  const agent = new Agent({ 
    enableBeads: false,
    workingDirectory: TEST_PROJECT_PATH
  });
  
  // Test 5.1: Extract utility functions
  testStart("Extract utility functions");
  const start = Date.now();
  
  const { response: r1, toolsCalled: tc1, error: e1 } = await runAgentTask(
    agent,
    `Create a utility module at ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/utils/id.ts with:
     - generateId(): string - generates a unique ID (use crypto.randomUUID or Date.now + random)
     Then update TodoService to use this utility instead of generating IDs inline. Use absolute paths.`
  );
  
  const duration1 = Date.now() - start;
  const utilExists = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "utils", "id.ts"));
  const test1Passed = tc1.length > 0 && utilExists;
  
  if (test1Passed) testPass(duration1, "Utility extracted");
  else testFail(duration1, e1 || "Utility not created");
  
  tests.push({
    scenario: "Refactoring",
    test: "Extract utility functions",
    passed: test1Passed,
    duration: duration1,
    toolsCalled: tc1,
    filesCreated: utilExists ? ["src/utils/id.ts"] : [],
    filesModified: [],
    error: e1,
  });
  
  // Test 5.2: Add barrel exports
  testStart("Create barrel exports (index.ts files)");
  const start2 = Date.now();
  
  const { response: r2, toolsCalled: tc2, error: e2 } = await runAgentTask(
    agent,
    `Create index.ts barrel files at ${TEST_PROJECT_PATH.replace(/\\/g, "/")}:
     - src/services/index.ts - exports TodoService and StorageService
     - src/utils/index.ts - exports all utilities
     These should re-export all public items from their directories. Use absolute paths.`
  );
  
  const duration2 = Date.now() - start2;
  const servicesIndex = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "services", "index.ts"));
  const utilsIndex = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "utils", "index.ts"));
  const test2Passed = servicesIndex || utilsIndex;
  
  if (test2Passed) testPass(duration2, "Barrel exports created");
  else testFail(duration2, e2 || "Barrel exports not created");
  
  tests.push({
    scenario: "Refactoring",
    test: "Create barrel exports",
    passed: test2Passed,
    duration: duration2,
    toolsCalled: tc2,
    filesCreated: [
      ...(servicesIndex ? ["src/services/index.ts"] : []),
      ...(utilsIndex ? ["src/utils/index.ts"] : []),
    ],
    filesModified: [],
    error: e2,
  });
  
  // Test 5.3: Add error handling wrapper
  testStart("Add error handling with Result type");
  const start3 = Date.now();
  
  const { response: r3, toolsCalled: tc3, error: e3 } = await runAgentTask(
    agent,
    `Create ${TEST_PROJECT_PATH.replace(/\\/g, "/")}/src/utils/result.ts with a Result type:
     - type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E }
     - ok<T>(value: T): Result<T, never> - creates success result
     - err<E>(error: E): Result<never, E> - creates error result
     This is a utility for explicit error handling. Use the absolute path.`
  );
  
  const duration3 = Date.now() - start3;
  const resultExists = fs.existsSync(path.join(TEST_PROJECT_PATH, "src", "utils", "result.ts"));
  const test3Passed = resultExists;
  
  if (test3Passed) testPass(duration3, "Result type created");
  else testFail(duration3, e3 || "Result type not created");
  
  tests.push({
    scenario: "Refactoring",
    test: "Add Result type",
    passed: test3Passed,
    duration: duration3,
    toolsCalled: tc3,
    filesCreated: resultExists ? ["src/utils/result.ts"] : [],
    filesModified: [],
    error: e3,
  });
  
  agent.reset();
  
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  const totalDuration = tests.reduce((sum, t) => sum + t.duration, 0);
  
  return {
    name: "Refactoring",
    tests,
    passed,
    failed,
    totalDuration,
  };
}

// ============================================================================
// Results Summary
// ============================================================================

function printSummary() {
  header("TEST RESULTS SUMMARY");
  
  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;
  
  for (const scenario of scenarioResults) {
    const statusIcon = scenario.failed === 0 ? GREEN + "✓" : YELLOW + "⚠";
    console.log(`${statusIcon}${RESET} ${BOLD}${scenario.name}${RESET}: ${GREEN}${scenario.passed} passed${RESET}, ${scenario.failed > 0 ? RED : DIM}${scenario.failed} failed${RESET} ${DIM}(${(scenario.totalDuration / 1000).toFixed(1)}s)${RESET}`);
    
    for (const test of scenario.tests) {
      const icon = test.passed ? GREEN + "  ✓" : RED + "  ✗";
      console.log(`${icon}${RESET} ${test.test} ${DIM}(${test.duration}ms)${RESET}`);
      if (test.toolsCalled.length > 0) {
        console.log(`    ${DIM}Tools: ${test.toolsCalled.join(", ")}${RESET}`);
      }
    }
    console.log();
    
    totalPassed += scenario.passed;
    totalFailed += scenario.failed;
    totalDuration += scenario.totalDuration;
  }
  
  console.log(`${CYAN}${"─".repeat(60)}${RESET}`);
  console.log(`${BOLD}Total: ${GREEN}${totalPassed} passed${RESET}, ${totalFailed > 0 ? RED : DIM}${totalFailed} failed${RESET}`);
  console.log(`${DIM}Duration: ${(totalDuration / 1000).toFixed(1)}s${RESET}`);
  
  // Final status
  console.log();
  if (totalFailed === 0) {
    console.log(`${GREEN}${BOLD}🎉 All UX tests passed!${RESET}`);
  } else {
    console.log(`${YELLOW}${BOLD}⚠️ Some tests failed. See details above.${RESET}`);
  }
  
  return { totalPassed, totalFailed, totalDuration };
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
  header("SHARKBAIT COMPREHENSIVE UX TEST SUITE");
  console.log(`${DIM}Testing multiple UX scenarios with real LLM and tools${RESET}`);
  console.log(`${DIM}Sandbox: ${SANDBOX_PATH}${RESET}\n`);
  
  // Clean up sandbox
  cleanupSandbox();
  
  try {
    // Run all scenarios
    scenarioResults.push(await testAppCreation());
    scenarioResults.push(await testFeatureDevelopment());
    scenarioResults.push(await testDebugging());
    scenarioResults.push(await testCodeReview());
    scenarioResults.push(await testRefactoring());
    
    // Print summary
    const { totalFailed } = printSummary();
    
    // Save results to file
    const resultsPath = path.join(SANDBOX_PATH, "test-results.json");
    fs.writeFileSync(resultsPath, JSON.stringify(scenarioResults, null, 2));
    console.log(`\n${DIM}Results saved to: ${resultsPath}${RESET}`);
    
    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (error) {
    console.error(`\n${RED}Fatal error:${RESET}`, error);
    process.exit(1);
  }
}

main();
