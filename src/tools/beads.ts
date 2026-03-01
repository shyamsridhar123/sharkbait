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

// Check if .beads directory exists in current directory
function hasBeadsDir(cwd?: string): boolean {
  const dir = cwd || process.cwd();
  return existsSync(join(dir, ".beads"));
}

// Check if beads is actually functional (dolt reachable OR no-db mode)
async function isBeadsFunctional(): Promise<{ functional: boolean; error?: string }> {
  if (!hasBeadsDir()) {
    return { functional: false, error: "No .beads directory found" };
  }
  try {
    const result = await exec([BD_PATH, "list", "--json"], { cwd: process.cwd() });
    if (result.exitCode === 0) {
      return { functional: true };
    }
    return { functional: false, error: result.stderr || "bd list failed" };
  } catch (err) {
    return { functional: false, error: err instanceof Error ? err.message : String(err) };
  }
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

// Check if bd supports --no-db flag
function bdSupportsNoDb(): boolean {
  try {
    const help = execSync(`${BD_PATH} init --help 2>&1`, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return help.includes("--no-db");
  } catch {
    return false;
  }
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
      const { functional, error } = await isBeadsFunctional();
      
      return {
        installed: true,
        initialized: dirExists,
        functional,
        ready: functional,
        message: functional
          ? "Beads is ready to use."
          : `Beads directory exists but is not functional: ${error}. Try beads_init to reinitialize, or proceed without beads.`,
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
        // .beads exists but not functional — try reinit with --no-db if supported
        if (bdSupportsNoDb()) {
          try {
            const result = await exec([BD_PATH, "init", "--no-db"], { cwd: process.cwd() });
            if (result.exitCode === 0) {
              return { 
                success: true, 
                message: "Beads reinitialized in no-db mode (dolt was not reachable).",
                output: result.stdout.trim(),
                mode: "no-db",
              };
            }
          } catch {}
        }
        // Reinit failed or --no-db not supported — report failure gracefully
        return {
          success: false,
          message: "Beads directory exists but is not functional (dolt may not be running). Could not reinitialize. Proceed with the task without beads and inform the user.",
          proceedWithoutBeads: true,
        };
      }
      
      // Fresh init — try with --no-db first if requested or if dolt isn't available
      const args = [BD_PATH, "init"];
      if (noDb && bdSupportsNoDb()) {
        args.push("--no-db");
      }
      
      try {
        const result = await exec(args, { cwd: process.cwd() });
        
        if (result.exitCode !== 0) {
          // If normal init failed (dolt not available), try --no-db fallback
          if (!noDb && bdSupportsNoDb()) {
            const fallback = await exec([BD_PATH, "init", "--no-db"], { cwd: process.cwd() });
            if (fallback.exitCode === 0) {
              return {
                success: true,
                message: "Beads initialized in no-db mode (dolt not available, using JSONL).",
                output: fallback.stdout.trim(),
                mode: "no-db",
              };
            }
          }
          return {
            success: false,
            message: `Failed to initialize beads: ${result.stderr || result.stdout}. Proceed with the task without beads.`,
            proceedWithoutBeads: true,
          };
        }
        
        return { 
          success: true, 
          message: "Beads initialized successfully.",
          output: result.stdout.trim(),
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
        const result = await exec([BD_PATH, "ready", "--json"]);
        
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
        const result = await exec([BD_PATH, "show", id as string, "--json"]);
        
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
        const result = await exec([BD_PATH, "close", id as string, "-m", msg]);
        
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
          [BD_PATH, "dep", "add", childId as string, parentId as string]
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
        return { tasks: [], message: "Beads (bd) not available. Proceed without beads.", proceedWithoutBeads: true };
      }
    },
  },
];
