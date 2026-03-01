/**
 * Beads Integration Tools - Task management with Beads (bd CLI)
 */

import type { Tool } from "./registry";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { exec } from "../utils/runtime";

// Find bd executable - check common locations
function getBdPath(): string {
  const paths: string[] = [
    "bd", // In PATH
    join(homedir(), "AppData", "Local", "beads", "bd.exe"), // Windows npm install location
    join(homedir(), ".local", "bin", "bd"), // Linux/Mac user install
    "/usr/local/bin/bd", // Mac homebrew
  ];
  
  // For now, prefer the explicit path on Windows if it exists
  if (process.platform === "win32") {
    return paths[1]!; // Windows path
  }
  return paths[0]!; // Default to PATH
}

const BD_PATH = getBdPath();

// Check if beads is initialized in current directory
function isBeadsInitialized(cwd?: string): boolean {
  const dir = cwd || process.cwd();
  return existsSync(join(dir, ".beads"));
}

// Check if bd executable is available
async function isBdInstalled(): Promise<boolean> {
  try {
    const result = await exec([BD_PATH, "--version"]);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export const beadsTools: Tool[] = [
  {
    name: "beads_status",
    description: "Check if Beads (bd) is installed and initialized in the current directory. Call this before using other beads tools.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      const installed = await isBdInstalled();
      const initialized = isBeadsInitialized();
      
      return {
        installed,
        initialized,
        ready: installed && initialized,
        message: !installed 
          ? "Beads (bd) is not installed. Run 'sharkbait setup' or install manually: npm install -g @beads/bd"
          : !initialized
          ? "Beads is installed but not initialized here. Use beads_init to initialize."
          : "Beads is ready to use.",
        bdPath: BD_PATH,
      };
    },
  },

  {
    name: "beads_init",
    description: "Initialize a Beads database in the current directory. Required before creating tasks.",
    parameters: {
      type: "object",
      properties: {
        noDb: { 
          type: "boolean", 
          description: "Use JSONL only without SQLite (lighter weight)" 
        },
      },
      required: [],
    },
    async execute({ noDb }) {
      // Check if already initialized
      if (isBeadsInitialized()) {
        return { 
          success: true, 
          message: "Beads is already initialized in this directory.",
          alreadyInitialized: true 
        };
      }
      
      // Check if bd is installed
      if (!(await isBdInstalled())) {
        return {
          success: false,
          message: "Beads (bd) is not installed. Run 'sharkbait setup' or install manually: npm install -g @beads/bd",
          installed: false,
        };
      }
      
      const args = [BD_PATH, "init"];
      if (noDb) {
        args.push("--no-db");
      }
      
      try {
        const result = await exec(args, { cwd: process.cwd() });
        
        if (result.exitCode !== 0) {
          throw new Error(result.stderr || result.stdout || "Failed to initialize beads");
        }
        
        return { 
          success: true, 
          message: "Beads initialized successfully.",
          output: result.stdout.trim(),
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to initialize beads: ${error}`,
        };
      }
    },
  },
  {
    name: "beads_ready",
    description: "Get tasks ready to work on (no blockers)",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      try {
        const result = await exec([BD_PATH, "ready", "--json"]);
        
        if (result.exitCode !== 0) {
          throw new Error("Failed to get ready tasks");
        }
        
        return JSON.parse(result.stdout);
      } catch (error) {
        // Return empty if beads is not available
        return { tasks: [], message: "Beads (bd) not available" };
      }
    },
  },

  {
    name: "beads_create",
    description: "Create a new task. Requires beads to be initialized first (use beads_status to check, beads_init to initialize).",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title" },
        priority: { type: "number", description: "Priority (0=highest)" },
        parent: { type: "string", description: "Parent task ID for subtasks" },
      },
      required: ["title"],
    },
    async execute({ title, priority, parent }) {
      // Check if beads is initialized first
      if (!isBeadsInitialized()) {
        return {
          success: false,
          error: "Beads is not initialized in this directory. Use beads_init first.",
          hint: "Call beads_init to set up beads in this repository.",
        };
      }
      
      const args = [BD_PATH, "create", title as string];
      
      if (priority !== undefined) {
        args.push("-p", String(priority));
      }
      if (parent) {
        args.push("--parent", parent as string);
      }
      args.push("--json");
      
      try {
        const result = await exec(args, { cwd: process.cwd() });
        
        if (result.exitCode !== 0) {
          // Check for common errors and provide helpful messages
          if (result.stderr.includes("no beads database found")) {
            return {
              success: false,
              error: "Beads database not found. Use beads_init to initialize.",
              hint: "Run beads_init first, then retry creating the task.",
            };
          }
          throw new Error(result.stderr || "Failed to create task");
        }
        
        // bd outputs JSON on stdout - extract the JSON object
        // The output may have warnings before the JSON, so find the JSON block
        const jsonStart = result.stdout.indexOf('{');
        const jsonEnd = result.stdout.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error(`No JSON in output: ${result.stdout}`);
        }
        const jsonStr = result.stdout.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        return { success: true, ...parsed };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create task: ${error}`,
        };
      }
    },
  },

  {
    name: "beads_show",
    description: "Get details of a specific task",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID (e.g., bd-a1b2)" },
      },
      required: ["id"],
    },
    async execute({ id }) {
      try {
        const result = await exec([BD_PATH, "show", id as string, "--json"]);
        
        if (result.exitCode !== 0) {
          throw new Error(`Task not found: ${id}`);
        }
        
        return JSON.parse(result.stdout);
      } catch (error) {
        throw new Error(`Failed to get task: ${error}`);
      }
    },
  },

  {
    name: "beads_done",
    description: "Mark a task as complete",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task ID" },
        message: { type: "string", description: "Completion message" },
      },
      required: ["id"],
    },
    async execute({ id, message }) {
      const msg = (message as string) || "Completed";
      
      try {
        const result = await exec([BD_PATH, "close", id as string, "-m", msg]);
        
        if (result.exitCode !== 0) {
          throw new Error(`Failed to complete task: ${id}`);
        }
        
        return { success: true, id, message: msg };
      } catch (error) {
        throw new Error(`Failed to complete task: ${error}`);
      }
    },
  },

  {
    name: "beads_add_dependency",
    description: "Add a dependency between tasks",
    parameters: {
      type: "object",
      properties: {
        childId: { type: "string", description: "Blocked task ID" },
        parentId: { type: "string", description: "Blocking task ID" },
      },
      required: ["childId", "parentId"],
    },
    async execute({ childId, parentId }) {
      try {
        const result = await exec(
          [BD_PATH, "dep", "add", childId as string, parentId as string]
        );
        
        if (result.exitCode !== 0) {
          throw new Error("Failed to add dependency");
        }
        
        return { success: true, childId, parentId };
      } catch (error) {
        throw new Error(`Failed to add dependency: ${error}`);
      }
    },
  },

  {
    name: "beads_list",
    description: "List all tasks",
    parameters: {
      type: "object",
      properties: {
        status: { 
          type: "string", 
          enum: ["open", "in_progress", "blocked", "deferred", "closed", "all"],
          description: "Filter by status (default: open)" 
        },
      },
      required: [],
    },
    async execute({ status }) {
      const args = [BD_PATH, "list", "--json"];
      
      if (status === "all") {
        args.push("--all");
      } else if (status) {
        args.push("--status", status as string);
      }
      
      try {
        const result = await exec(args);
        
        if (result.exitCode !== 0) {
          return { tasks: [] };
        }
        
        return JSON.parse(result.stdout);
      } catch {
        return { tasks: [], message: "Beads (bd) not available" };
      }
    },
  },
];
