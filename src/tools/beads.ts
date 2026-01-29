/**
 * Beads Integration Tools - Task management with Beads (bd CLI)
 */

import type { Tool } from "./registry";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

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
    const proc = Bun.spawn([BD_PATH, "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    return true;
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
          ? "Beads (bd) is not installed. Install with: npm install -g @anthropics/beads"
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
          message: "Beads (bd) is not installed. Install with: npm install -g @anthropics/beads",
          installed: false,
        };
      }
      
      const args = [BD_PATH, "init"];
      if (noDb) {
        args.push("--no-db");
      }
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
          cwd: process.cwd(),
        });
        
        const output = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          throw new Error(stderr || output || "Failed to initialize beads");
        }
        
        return { 
          success: true, 
          message: "Beads initialized successfully.",
          output: output.trim(),
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
        const proc = Bun.spawn([BD_PATH, "ready", "--json"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          throw new Error("Failed to get ready tasks");
        }
        
        return JSON.parse(output);
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
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
          cwd: process.cwd(),
        });
        
        const output = await new Response(proc.stdout).text();
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          // Check for common errors and provide helpful messages
          if (stderr.includes("no beads database found")) {
            return {
              success: false,
              error: "Beads database not found. Use beads_init to initialize.",
              hint: "Run beads_init first, then retry creating the task.",
            };
          }
          throw new Error(stderr || "Failed to create task");
        }
        
        // bd outputs JSON on stdout - extract the JSON object
        // The output may have warnings before the JSON, so find the JSON block
        const jsonStart = output.indexOf('{');
        const jsonEnd = output.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          throw new Error(`No JSON in output: ${output}`);
        }
        const jsonStr = output.substring(jsonStart, jsonEnd + 1);
        const result = JSON.parse(jsonStr);
        return { success: true, ...result };
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
        const proc = Bun.spawn([BD_PATH, "show", id as string, "--json"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          throw new Error(`Task not found: ${id}`);
        }
        
        return JSON.parse(output);
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
        const proc = Bun.spawn([BD_PATH, "close", id as string, "-m", msg], {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
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
        const proc = Bun.spawn(
          [BD_PATH, "dep", "add", childId as string, parentId as string],
          { stdout: "pipe", stderr: "pipe" }
        );
        
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
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
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          return { tasks: [] };
        }
        
        return JSON.parse(output);
      } catch {
        return { tasks: [], message: "Beads (bd) not available" };
      }
    },
  },
];
