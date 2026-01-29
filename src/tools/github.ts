/**
 * GitHub Tools - GitHub CLI (gh) integration
 */

import type { Tool } from "./registry";

export const githubTools: Tool[] = [
  {
    name: "github_create_pr",
    description: "Create a GitHub pull request",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "PR title" },
        body: { type: "string", description: "PR description" },
        base: { type: "string", description: "Base branch (default: main)" },
        draft: { type: "boolean", description: "Create as draft PR" },
      },
      required: ["title"],
    },
    async execute({ title, body, base, draft }) {
      const args = ["gh", "pr", "create", "--title", title as string];
      
      if (body) {
        args.push("--body", body as string);
      }
      if (base) {
        args.push("--base", base as string);
      }
      if (draft) {
        args.push("--draft");
      }
      args.push("--json", "number,url,title");
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          throw new Error(stderr || "Failed to create PR");
        }
        
        return JSON.parse(output);
      } catch (error) {
        throw new Error(`Failed to create PR: ${error}`);
      }
    },
  },

  {
    name: "github_list_prs",
    description: "List open pull requests",
    parameters: {
      type: "object",
      properties: {
        state: { 
          type: "string", 
          enum: ["open", "closed", "merged", "all"],
          description: "Filter by PR state" 
        },
        limit: { type: "number", description: "Max results" },
      },
      required: [],
    },
    async execute({ state, limit }) {
      const args = ["gh", "pr", "list"];
      
      if (state) {
        args.push("--state", state as string);
      }
      if (limit) {
        args.push("--limit", String(limit));
      }
      args.push("--json", "number,title,author,url,state,headRefName");
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          return { prs: [] };
        }
        
        return JSON.parse(output);
      } catch {
        return { prs: [], message: "GitHub CLI (gh) not available" };
      }
    },
  },

  {
    name: "github_merge_pr",
    description: "Merge a pull request",
    parameters: {
      type: "object",
      properties: {
        number: { type: "number", description: "PR number" },
        method: { 
          type: "string", 
          enum: ["merge", "squash", "rebase"],
          description: "Merge method" 
        },
        deleteRemoteBranch: { type: "boolean", description: "Delete branch after merge" },
      },
      required: ["number"],
    },
    async execute({ number, method, deleteRemoteBranch }) {
      const args = ["gh", "pr", "merge", String(number)];
      
      args.push(`--${(method as string) || "squash"}`);
      
      if (deleteRemoteBranch) {
        args.push("--delete-branch");
      }
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          throw new Error(stderr || "Failed to merge PR");
        }
        
        return { success: true, number, method: method || "squash" };
      } catch (error) {
        throw new Error(`Failed to merge PR: ${error}`);
      }
    },
  },

  {
    name: "github_create_issue",
    description: "Create a GitHub issue",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Issue title" },
        body: { type: "string", description: "Issue description" },
        labels: { 
          type: "array", 
          items: { type: "string" }, 
          description: "Labels" 
        },
        assignees: {
          type: "array",
          items: { type: "string" },
          description: "Assignees"
        },
      },
      required: ["title"],
    },
    async execute({ title, body, labels, assignees }) {
      const args = ["gh", "issue", "create", "--title", title as string];
      
      if (body) {
        args.push("--body", body as string);
      }
      if (labels && (labels as string[]).length > 0) {
        args.push("--label", (labels as string[]).join(","));
      }
      if (assignees && (assignees as string[]).length > 0) {
        args.push("--assignee", (assignees as string[]).join(","));
      }
      args.push("--json", "number,url,title");
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          const stderr = await new Response(proc.stderr).text();
          throw new Error(stderr || "Failed to create issue");
        }
        
        return JSON.parse(output);
      } catch (error) {
        throw new Error(`Failed to create issue: ${error}`);
      }
    },
  },

  {
    name: "github_workflow_status",
    description: "Get status of GitHub Actions workflows",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results" },
      },
      required: [],
    },
    async execute({ limit }) {
      const args = ["gh", "run", "list"];
      
      if (limit) {
        args.push("--limit", String(limit));
      }
      args.push("--json", "status,conclusion,name,createdAt,url,headBranch");
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          return { runs: [] };
        }
        
        return JSON.parse(output);
      } catch {
        return { runs: [], message: "GitHub CLI (gh) not available" };
      }
    },
  },

  {
    name: "github_pr_view",
    description: "View details of a pull request",
    parameters: {
      type: "object",
      properties: {
        number: { type: "number", description: "PR number" },
      },
      required: ["number"],
    },
    async execute({ number }) {
      const args = [
        "gh", "pr", "view", String(number),
        "--json", "number,title,body,state,author,url,headRefName,baseRefName,additions,deletions,changedFiles"
      ];
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          throw new Error(`PR #${number} not found`);
        }
        
        return JSON.parse(output);
      } catch (error) {
        throw new Error(`Failed to view PR: ${error}`);
      }
    },
  },

  {
    name: "github_issue_list",
    description: "List issues in the repository",
    parameters: {
      type: "object",
      properties: {
        state: {
          type: "string",
          enum: ["open", "closed", "all"],
          description: "Filter by issue state"
        },
        labels: {
          type: "array",
          items: { type: "string" },
          description: "Filter by labels"
        },
        limit: { type: "number", description: "Max results" },
      },
      required: [],
    },
    async execute({ state, labels, limit }) {
      const args = ["gh", "issue", "list"];
      
      if (state) {
        args.push("--state", state as string);
      }
      if (labels && (labels as string[]).length > 0) {
        args.push("--label", (labels as string[]).join(","));
      }
      if (limit) {
        args.push("--limit", String(limit));
      }
      args.push("--json", "number,title,state,author,labels,url");
      
      try {
        const proc = Bun.spawn(args, {
          stdout: "pipe",
          stderr: "pipe",
        });
        
        const output = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;
        
        if (exitCode !== 0) {
          return { issues: [] };
        }
        
        return JSON.parse(output);
      } catch {
        return { issues: [], message: "GitHub CLI (gh) not available" };
      }
    },
  },
];
