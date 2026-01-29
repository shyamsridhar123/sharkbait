/**
 * Git Tools - Local git operations
 */

import type { Tool } from "./registry";

export const gitTools: Tool[] = [
  {
    name: "git_status",
    description: "Get git status of the repository",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      try {
        const proc = Bun.spawn(["git", "status", "--porcelain"], {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        return output.trim() || "Working tree clean";
      } catch (error) {
        throw new Error("Not a git repository or git not installed");
      }
    },
  },

  {
    name: "git_diff",
    description: "Get diff of changes",
    parameters: {
      type: "object",
      properties: {
        staged: { type: "boolean", description: "Show staged changes only" },
        file: { type: "string", description: "Specific file to diff" },
      },
      required: [],
    },
    async execute({ staged, file }) {
      const args = ["git", "diff"];
      
      if (staged) {
        args.push("--staged");
      }
      if (file) {
        args.push(file as string);
      }
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        return output.trim() || "No changes";
      } catch (error) {
        throw new Error("Failed to get diff");
      }
    },
  },

  {
    name: "git_commit",
    description: "Commit staged changes",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Commit message" },
        all: { type: "boolean", description: "Stage all changes before commit" },
      },
      required: ["message"],
    },
    async execute({ message, all }) {
      try {
        if (all) {
          const addProc = Bun.spawn(["git", "add", "-A"], {
            stdout: "pipe",
            stderr: "pipe",
          });
          await addProc.exited;
        }
        
        const proc = Bun.spawn(["git", "commit", "-m", message as string], {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          throw new Error(stderr || "Commit failed");
        }
        
        return { success: true, message, output: output.trim() };
      } catch (error) {
        throw new Error(`Commit failed: ${error}`);
      }
    },
  },

  {
    name: "git_push",
    description: "Push commits to remote",
    parameters: {
      type: "object",
      properties: {
        branch: { type: "string", description: "Branch to push" },
        setUpstream: { type: "boolean", description: "Set upstream for new branch" },
      },
      required: [],
    },
    async execute({ branch, setUpstream }) {
      const args = ["git", "push"];
      
      if (setUpstream) {
        args.push("-u", "origin", (branch as string) || "HEAD");
      } else if (branch) {
        args.push("origin", branch as string);
      }
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const exitCode = await proc.exited;
        const stderr = await new Response(proc.stderr).text();
        
        if (exitCode !== 0) {
          throw new Error(stderr || "Push failed");
        }
        
        return { success: true, message: "Pushed successfully" };
      } catch (error) {
        throw new Error(`Push failed: ${error}`);
      }
    },
  },

  {
    name: "git_branch",
    description: "Create, list, or switch branches",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Branch name" },
        action: { 
          type: "string", 
          enum: ["create", "list", "switch", "delete"], 
          description: "Action to perform" 
        },
      },
      required: ["action"],
    },
    async execute({ name, action }) {
      try {
        let args: string[];
        
        switch (action) {
          case "create":
            if (!name) throw new Error("Branch name required for create");
            args = ["git", "checkout", "-b", name as string];
            break;
          case "list":
            args = ["git", "branch", "-a"];
            break;
          case "switch":
            if (!name) throw new Error("Branch name required for switch");
            args = ["git", "checkout", name as string];
            break;
          case "delete":
            if (!name) throw new Error("Branch name required for delete");
            args = ["git", "branch", "-d", name as string];
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }
        
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          throw new Error(stderr || "Branch operation failed");
        }
        
        return { 
          success: true, 
          branch: name, 
          action, 
          output: output.trim() 
        };
      } catch (error) {
        throw new Error(`Branch operation failed: ${error}`);
      }
    },
  },

  {
    name: "git_log",
    description: "Show commit history",
    parameters: {
      type: "object",
      properties: {
        count: { type: "number", description: "Number of commits to show" },
        oneline: { type: "boolean", description: "One line per commit" },
      },
      required: [],
    },
    async execute({ count, oneline }) {
      const args = ["git", "log"];
      
      if (count) {
        args.push(`-${count}`);
      }
      if (oneline) {
        args.push("--oneline");
      }
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        return output.trim();
      } catch (error) {
        throw new Error("Failed to get log");
      }
    },
  },
];
