/**
 * Beads Integration Tools - Task management with Beads (bd CLI)
 */

import type { Tool } from "./registry";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { exec } from "../utils/runtime";

// Find bd executable - check common locations, prefer whichever actually works
function getBdPath(): string {
  // First, check if "bd" is on PATH (works regardless of install method)
  try {
    execSync("bd --version", { stdio: ["ignore", "ignore", "ignore"] });
    return "bd";
  } catch {}

  // Fall back to known install locations
  const fallbacks: string[] = [
    join(homedir(), "AppData", "Local", "beads", "bd.exe"), // Windows direct download
    join(homedir(), ".local", "bin", "bd"), // Linux/Mac user install
    "/usr/local/bin/bd", // Mac homebrew
  ];

  for (const p of fallbacks) {
    if (existsSync(p)) return p;
  }

  // Default to "bd" and let it fail with a clear error at call time
  return "bd";
}

const BD_PATH = getBdPath();

// Module-level flag: once we detect that dolt is unreachable and --no-db works,
// automatically add --no-db to all subsequent bd commands
let forceNoDb = false;

// Helper: build bd command args, auto-appending --no-db when needed
function bdArgs(...args: string[]): string[] {
  const cmd = [BD_PATH, ...args];
  if (forceNoDb && !cmd.includes("--no-db")) {
    cmd.push("--no-db");
  }
  return cmd;
}

// Check if .beads directory exists in current directory
function hasBeadsDir(cwd?: string): boolean {
  const dir = cwd || process.cwd();
  return existsSync(join(dir, ".beads"));
}

// Check if beads is actually functional (dolt reachable OR no-db mode)
// Returns whether --no-db flag was needed so callers can use it too
async function isBeadsFunctional(): Promise<{ functional: boolean; useNoDb?: boolean; error?: string }> {
  if (!hasBeadsDir()) {
    return { functional: false, error: "No .beads directory found" };
  }
  try {
    const result = await exec([BD_PATH, "list", "--json"], { cwd: process.cwd() });
    if (result.exitCode === 0) {
      return { functional: true, useNoDb: false };
    }
  } catch {}
  
  // Dolt connection failed — try --no-db fallback (reads from JSONL files)
  try {
    const result = await exec([BD_PATH, "list", "--json", "--no-db"], { cwd: process.cwd() });
    if (result.exitCode === 0) {
      forceNoDb = true;  // Latch: use --no-db for all future commands
      return { functional: true, useNoDb: true };
    }
  } catch {}

  // Last resort: fix metadata.json backend from "dolt" to "no-db" and retry
  if (tryFixMetadataBackend()) {
    try {
      const result = await exec([BD_PATH, "list", "--json"], { cwd: process.cwd() });
      if (result.exitCode === 0) {
        return { functional: true, useNoDb: true };
      }
    } catch {}
    // Also try with --no-db flag after metadata fix
    try {
      const result = await exec([BD_PATH, "list", "--json", "--no-db"], { cwd: process.cwd() });
      if (result.exitCode === 0) {
        forceNoDb = true;
        return { functional: true, useNoDb: true };
      }
    } catch {}
  }

  return { functional: false, error: "bd list failed (dolt unreachable, --no-db failed, metadata fix failed)" };
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

// Try to fix metadata.json backend from "dolt" to work without dolt server
// This is a last-resort fix when dolt is dead and bd can't function
function tryFixMetadataBackend(cwd?: string): boolean {
  const dir = cwd || process.cwd();
  const metadataPath = join(dir, ".beads", "metadata.json");
  try {
    if (!existsSync(metadataPath)) return false;
    const { readFileSync, writeFileSync } = require("fs");
    const raw = readFileSync(metadataPath, "utf-8");
    const meta = JSON.parse(raw);
    if (meta.backend === "dolt" || meta.database === "dolt") {
      // Rewrite to no-db backend so bd reads from JSONL
      meta.backend = "no-db";
      meta.database = "no-db";
      delete meta.dolt_mode;
      delete meta.dolt_database;
      writeFileSync(metadataPath, JSON.stringify(meta, null, 2));
      return true;
    }
  } catch {}
  return false;
}

export const beadsTools: Tool[] = [
  {
    name: "beads_install",
    description: "Install the Beads (bd) CLI tool. Call this when beads is not installed. This handles platform-specific installation automatically. Do NOT try to install beads via run_command — always use this tool instead.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      // Check if already installed
      try {
        const ver = execSync("bd --version", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        if (ver) {
          return { success: true, alreadyInstalled: true, version: ver, message: `Beads (bd) is already installed: ${ver}` };
        }
      } catch {}

      try {
        let version: string | null = null;

        if (process.platform === "win32") {
          // npm postinstall is broken on Windows — download binary from GitHub releases
          const beadsVer = "0.57.0";
          const beadsDir = join(homedir(), "AppData", "Local", "beads");
          const bdExe = join(beadsDir, "bd.exe");
          const zipUrl = `https://github.com/steveyegge/beads/releases/download/v${beadsVer}/beads_${beadsVer}_windows_amd64.zip`;
          const zipPath = join(beadsDir, "beads.zip");

          execSync(`mkdir "${beadsDir}" 2>nul & echo ok`, { stdio: "ignore", shell: "cmd.exe" });
          execSync(`curl -fsSL -o "${zipPath}" "${zipUrl}"`, { stdio: "ignore", timeout: 120000 });
          execSync(`tar -xf "${zipPath}" -C "${beadsDir}"`, { stdio: "ignore", timeout: 30000 });
          try { execSync(`del "${zipPath}"`, { stdio: "ignore", shell: "cmd.exe" }); } catch {}

          if (existsSync(bdExe)) {
            // Add to user PATH if needed
            try {
              const currentPath = execSync(
                `powershell -Command "[Environment]::GetEnvironmentVariable('PATH','User')"`,
                { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
              ).trim();
              if (!currentPath.toLowerCase().includes(beadsDir.toLowerCase())) {
                execSync(
                  `powershell -Command "[Environment]::SetEnvironmentVariable('PATH','${beadsDir};' + [Environment]::GetEnvironmentVariable('PATH','User'),'User')"`,
                  { stdio: "ignore" }
                );
              }
            } catch {}
            version = execSync(`"${bdExe}" --version`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
          }
        } else {
          // Linux/macOS: official install script, fallback to npm
          try {
            execSync(
              "curl -fsSL https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh | bash",
              { stdio: "ignore", timeout: 120000 }
            );
          } catch {
            execSync("npm install -g @beads/bd", { stdio: "ignore", timeout: 120000 });
          }
          try {
            version = execSync("bd --version", { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
          } catch {}
        }

        if (version) {
          return { success: true, version, message: `Beads (bd) installed successfully: ${version}` };
        }
        return { success: false, message: "Installation completed but bd not found in PATH. Try restarting your terminal." };
      } catch (err) {
        return {
          success: false,
          message: `Installation failed: ${err instanceof Error ? err.message : String(err)}. Try manually: npm install -g @beads/bd`,
        };
      }
    },
  },

  {
    name: "beads_status",
    description: "Check if Beads (bd CLI) is installed and functional in the current directory. ALWAYS call this before using other beads tools. If not installed, use the beads_install tool (never run_command). If beads is not functional, do NOT keep retrying — proceed with the user's task and inform them beads is unavailable.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      const installed = await isBdInstalled();
      const dirExists = hasBeadsDir();
      
      if (!installed) {
        return {
          installed: false,
          initialized: false,
          ready: false,
          message: "Beads (bd) is not installed. Use the beads_install tool to install it.",
          bdPath: BD_PATH,
          proceedWithoutBeads: true,
        };
      }
      
      if (!dirExists) {
        return {
          installed: true,
          initialized: false,
          ready: false,
          message: "Beads is installed but not initialized here. Use beads_init to initialize.",
          bdPath: BD_PATH,
        };
      }
      
      // Actually check if beads is functional (dolt reachable or no-db mode)
      const { functional, useNoDb, error } = await isBeadsFunctional();
      
      return {
        installed: true,
        initialized: dirExists,
        functional,
        ready: functional,
        mode: useNoDb ? "no-db" : "dolt",
        message: functional
          ? useNoDb
            ? "Beads is ready (using --no-db fallback, dolt server unreachable)."
            : "Beads is ready to use."
          : `Beads directory exists but is not functional: ${error}. Write operations (beads_create, beads_done) will not work. However, if the user asks about their beads/tasks, still try beads_list — it may be able to read local task data. For new tasks, proceed without beads.`,
        bdPath: BD_PATH,
        proceedWithoutBeads: !functional,
      };
    },
  },

  {
    name: "beads_init",
    description: "Initialize a Beads database in the current directory. Required before creating tasks. If beads was previously initialized but is broken, this will attempt to reinitialize. If initialization fails, proceed with the user's task without beads.",
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
      // Check if bd is installed first
      if (!(await isBdInstalled())) {
        return {
          success: false,
          message: "Beads (bd) is not installed. Use the beads_install tool to install it.",
          installed: false,
          proceedWithoutBeads: true,
        };
      }
      
      // If .beads dir exists, check if it's actually functional
      if (hasBeadsDir()) {
        const { functional } = await isBeadsFunctional();
        if (functional) {
          return { 
            success: true, 
            message: "Beads is already initialized and functional in this directory.",
            alreadyInitialized: true 
          };
        }
        // .beads exists but not functional — try reinit with --no-db
        try {
          const result = await exec([BD_PATH, "init", "--no-db"], { cwd: process.cwd() });
          if (result.exitCode === 0) {
            // Also fix metadata.json to ensure no-db backend
            tryFixMetadataBackend();
            return { 
              success: true, 
              message: "Beads reinitialized in no-db mode (dolt was not reachable).",
              output: result.stdout.trim(),
              mode: "no-db",
            };
          }
        } catch {}
        // Reinit failed — try fixing metadata.json directly
        if (tryFixMetadataBackend()) {
          const { functional: nowFunctional } = await isBeadsFunctional();
          if (nowFunctional) {
            return {
              success: true,
              message: "Beads metadata fixed — switched from dolt to no-db mode.",
              mode: "no-db",
            };
          }
        }
        // All reinit attempts failed
        return {
          success: false,
          message: "Beads directory exists but is not functional (dolt may not be running). Could not reinitialize. Proceed with the task without beads and inform the user.",
          proceedWithoutBeads: true,
        };
      }
      
      // Fresh init — always use --no-db to avoid dolt dependency
      try {
        const result = await exec([BD_PATH, "init", "--no-db"], { cwd: process.cwd() });
        
        if (result.exitCode === 0) {
          return { 
            success: true, 
            message: "Beads initialized in no-db mode (JSONL-backed, no dolt dependency).",
            output: result.stdout.trim(),
            mode: "no-db",
          };
        }
        
        // --no-db init failed, try normal init as last resort
        const fallback = await exec([BD_PATH, "init"], { cwd: process.cwd() });
        if (fallback.exitCode === 0) {
          return {
            success: true,
            message: "Beads initialized successfully.",
            output: fallback.stdout.trim(),
          };
        }

        return {
          success: false,
          message: `Failed to initialize beads: ${fallback.stderr || fallback.stdout}. Proceed with the task without beads.`,
          proceedWithoutBeads: true,
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to initialize beads: ${error}. Proceed with the task without beads.`,
          proceedWithoutBeads: true,
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
        const result = await exec(bdArgs("ready", "--json"));
        
        if (result.exitCode !== 0) {
          return { tasks: [], message: "Beads not functional. Proceed without beads.", proceedWithoutBeads: true };
        }
        
        return JSON.parse(result.stdout);
      } catch {
        return { tasks: [], message: "Beads (bd) not available. Proceed without beads.", proceedWithoutBeads: true };
      }
    },
  },

  {
    name: "beads_create",
    description: "Create a new task. Requires beads to be initialized first (use beads_status to check, beads_init to initialize). If this fails, do NOT retry — proceed with the user's task without beads and inform them.",
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
      // Quick functional check
      if (!hasBeadsDir()) {
        return {
          success: false,
          error: "Beads is not initialized in this directory. Use beads_init first, or proceed without beads.",
          proceedWithoutBeads: true,
        };
      }
      
      const args = bdArgs("create", title as string);
      
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
          const errorText = result.stderr || result.stdout || "Unknown error";
          return {
            success: false,
            error: `Failed to create beads task: ${errorText}. Proceed with the user's task without beads — do NOT retry.`,
            proceedWithoutBeads: true,
          };
        }
        
        // bd outputs JSON on stdout - extract the JSON object
        const jsonStart = result.stdout.indexOf('{');
        const jsonEnd = result.stdout.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) {
          return {
            success: false,
            error: `No JSON in beads output: ${result.stdout}. Proceed without beads.`,
            proceedWithoutBeads: true,
          };
        }
        const jsonStr = result.stdout.substring(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);
        return { success: true, ...parsed };
      } catch (error) {
        return {
          success: false,
          error: `Failed to create beads task: ${error}. Proceed with the user's task without beads — do NOT retry.`,
          proceedWithoutBeads: true,
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
        const result = await exec(bdArgs("show", id as string, "--json"));
        
        if (result.exitCode !== 0) {
          return { error: `Task not found: ${id}`, proceedWithoutBeads: true };
        }
        
        return JSON.parse(result.stdout);
      } catch (error) {
        return { error: `Failed to get task: ${error}`, proceedWithoutBeads: true };
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
        const result = await exec(bdArgs("close", id as string, "-m", msg));
        
        if (result.exitCode !== 0) {
          return { success: false, error: `Failed to complete task: ${id}`, proceedWithoutBeads: true };
        }
        
        return { success: true, id, message: msg };
      } catch (error) {
        return { success: false, error: `Failed to complete task: ${error}`, proceedWithoutBeads: true };
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
          bdArgs("dep", "add", childId as string, parentId as string)
        );
        
        if (result.exitCode !== 0) {
          return { success: false, error: "Failed to add dependency", proceedWithoutBeads: true };
        }
        
        return { success: true, childId, parentId };
      } catch (error) {
        return { success: false, error: `Failed to add dependency: ${error}`, proceedWithoutBeads: true };
      }
    },
  },

  {
    name: "beads_list",
    description: "List all tasks. ALWAYS try this when the user asks about their beads/tasks, even if beads_status reported non-functional — task data may still be readable from local files.",
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
      // Try bd list first
      const args = bdArgs("list", "--json");
      
      if (status === "all") {
        args.push("--all");
      } else if (status) {
        args.push("--status", status as string);
      }
      
      try {
        const result = await exec(args);
        
        if (result.exitCode === 0) {
          return JSON.parse(result.stdout);
        }
      } catch {}

      // If --no-db wasn't already tried, try it now
      if (!forceNoDb) {
        try {
          const noDbArgs = [...args, "--no-db"];
          const result = await exec(noDbArgs);
          if (result.exitCode === 0) {
            forceNoDb = true;
            return JSON.parse(result.stdout);
          }
        } catch {}
      }

      // Last resort: fix metadata.json backend and retry
      if (tryFixMetadataBackend()) {
        try {
          const result = await exec(bdArgs("list", "--json"));
          if (result.exitCode === 0) {
            return JSON.parse(result.stdout);
          }
        } catch {}
      }

      // Fallback: try reading JSONL files directly from .beads/
      try {
        const { readFileSync, readdirSync } = await import("fs");
        const beadsDir = join(process.cwd(), ".beads");
        if (!existsSync(beadsDir)) {
          return { tasks: [], message: "No .beads directory found. Beads is not initialized here.", proceedWithoutBeads: true };
        }

        // Look for task JSONL files in .beads/
        const tasks: unknown[] = [];
        const scanDirs = [beadsDir, join(beadsDir, "tasks"), join(beadsDir, "data")];
        for (const dir of scanDirs) {
          if (!existsSync(dir)) continue;
          const files = readdirSync(dir).filter(f => f.endsWith(".jsonl") || f.endsWith(".json"));
          for (const file of files) {
            try {
              const content = readFileSync(join(dir, file), "utf-8");
              // JSONL: one JSON object per line
              for (const line of content.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                  tasks.push(JSON.parse(trimmed));
                } catch {}
              }
            } catch {}
          }
        }

        if (tasks.length > 0) {
          return { tasks, source: "local-files", message: `Read ${tasks.length} task record(s) from local .beads files (dolt unavailable).` };
        }

        return { tasks: [], message: "No task data found in .beads directory. Beads may need dolt to store tasks.", proceedWithoutBeads: true };
      } catch {
        return { tasks: [], message: "Beads (bd) not available and could not read local files. Proceed without beads.", proceedWithoutBeads: true };
      }
    },
  },
];
