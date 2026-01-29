/**
 * Beads Integration Tools - Task management with Beads (bd CLI)
 */

import type { Tool } from "./registry";

export const beadsTools: Tool[] = [
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
        const proc = Bun.spawn(["bd", "ready", "--json"], {
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
    description: "Create a new task",
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
      const args = ["bd", "create", title as string];
      
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
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          throw new Error("Failed to create task");
        }
        
        return JSON.parse(output);
      } catch (error) {
        throw new Error(`Failed to create task: ${error}`);
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
        const proc = Bun.spawn(["bd", "show", id as string, "--json"], {
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
        const proc = Bun.spawn(["bd", "done", id as string, msg], {
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
          ["bd", "dep", "add", childId as string, parentId as string],
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
          enum: ["open", "closed", "all"],
          description: "Filter by status" 
        },
      },
      required: [],
    },
    async execute({ status }) {
      const args = ["bd", "list", "--json"];
      
      if (status && status !== "all") {
        args.push(`--${status}`);
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
