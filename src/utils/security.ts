/**
 * Security Utilities - Allowlist-based command validation, path sandboxing, and URL safety
 *
 * Design: Uses an ALLOWLIST approach instead of a denylist. Commands not on the
 * allowlist require explicit user confirmation. This is fundamentally more secure
 * than trying to enumerate all dangerous commands via regex.
 */

import { resolve, normalize, relative } from "path";
import { SecurityError } from "./errors";

// ─── COMMAND ALLOWLIST ─────────────────────────────────────────────────────────
// Prefixes for commands that are safe to execute without user confirmation.
// Anything not matching these prefixes will require confirmation.

export const ALLOWED_COMMAND_PREFIXES: string[] = [
  // Version control
  "git",
  "gh",

  // Package management
  "bun",
  "npm",
  "npx",
  "yarn",
  "pnpm",

  // Build and dev tools
  "tsc",
  "eslint",
  "prettier",
  "vitest",
  "jest",

  // File inspection (read-only)
  "ls",
  "cat",
  "head",
  "tail",
  "wc",
  "file",
  "stat",
  "du",
  "df",
  "tree",

  // Search
  "grep",
  "rg",
  "find",
  "fd",
  "ag",
  "which",
  "where",
  "whereis",
  "type",

  // Text processing (read-only)
  "sort",
  "uniq",
  "diff",
  "comm",
  "cut",
  "tr",
  "awk",
  "sed",
  "jq",

  // System info
  "echo",
  "printf",
  "date",
  "whoami",
  "hostname",
  "uname",
  "env",
  "printenv",
  "pwd",

  // Directory creation (safe, reversible)
  "mkdir",
  "touch",
  "cp",
  "mv",

  // Docker (inspect only)
  "docker ps",
  "docker images",
  "docker logs",
  "docker inspect",

  // Process inspection
  "ps",
  "top",
  "htop",
  "pgrep",
];

// Commands that are ALWAYS blocked, even with user confirmation.
// These are catastrophically destructive or known attack patterns.
const ABSOLUTELY_BLOCKED: RegExp[] = [
  // Fork bombs (any format)
  /:\s*\(\)\s*\{[^}]*:\s*\|\s*:\s*&/,
  /(\w+)\s*\(\)\s*\{\s*\1\s*\|\s*\1\s*&/,

  // Disk/filesystem destruction
  /mkfs\b/,
  /dd\s+.*of=\/dev\/sd/,
  />\s*\/dev\/sd[a-z]/,

  // System shutdown/reboot
  /\b(shutdown|reboot|halt|poweroff|init\s+0)\b/,

  // Known reverse shell patterns
  /bash\s+-i\s+>&\s*\/dev\/tcp/,
  /nc\s+(-e|--exec)\b/,
  /ncat\s+(-e|--exec)\b/,
  /socat\s+.*exec:/i,
  /python[23]?\s+-c\s+.*socket.*connect/,
  /perl\s+-e\s+.*socket.*exec/,
  /ruby\s+-rsocket\s+-e/,

  // Pipe URL content directly to shell
  /curl\s+.*\|\s*(ba)?sh/,
  /wget\s+.*\|\s*(ba)?sh/,
  /curl\s+.*\|\s*python/,
  /wget\s+.*\|\s*python/,

  // Encoded command execution (base64 to shell)
  /base64\s+-d\s*\|\s*(ba)?sh/,
  /echo\s+.*\|\s*base64\s+-d\s*\|\s*(ba)?sh/,

  // Eval-based shell escapes
  /\beval\s+.*\$\(/,
];

// Commands that require user confirmation (not blocked, but dangerous)
const REQUIRES_CONFIRMATION: Array<{
  pattern: RegExp;
  reason: string;
  reversibility: "easy" | "effort" | "irreversible";
  undoHint?: string;
}> = [
  {
    pattern: /\brm\s/,
    reason: "File/directory deletion",
    reversibility: "irreversible",
  },
  {
    pattern: /DROP\s+(DATABASE|TABLE|INDEX)/i,
    reason: "Database object deletion",
    reversibility: "irreversible",
  },
  {
    pattern: /TRUNCATE\s+TABLE/i,
    reason: "Table data truncation",
    reversibility: "irreversible",
  },
  {
    pattern: /DELETE\s+FROM\s+\w+\s*;?\s*$/i,
    reason: "Delete all rows from table",
    reversibility: "irreversible",
  },
  {
    pattern: /git\s+push\s+.*--force/,
    reason: "Force push (rewrites remote history)",
    reversibility: "effort",
    undoHint: "git reflog + git push",
  },
  {
    pattern: /git\s+reset\s+--hard/,
    reason: "Hard reset (discards uncommitted changes)",
    reversibility: "effort",
    undoHint: "git reflog",
  },
  {
    pattern: /npm\s+publish/,
    reason: "Publish to npm registry",
    reversibility: "effort",
  },
  {
    pattern: /docker\s+(rm|rmi|system\s+prune)/,
    reason: "Docker resource removal",
    reversibility: "effort",
  },
  {
    pattern: /kubectl\s+delete/,
    reason: "Kubernetes resource deletion",
    reversibility: "effort",
  },
  {
    pattern: /chmod\s+(777|666)\b/,
    reason: "Overly permissive file permissions",
    reversibility: "easy",
    undoHint: "chmod with original permissions",
  },
  {
    pattern: /chown\b/,
    reason: "File ownership change",
    reversibility: "easy",
    undoHint: "chown with original owner",
  },
];

// ─── COMMAND CLASSIFICATION ────────────────────────────────────────────────────

// Shell metacharacters that chain or compose commands.
// Any command containing these requires all sub-commands to be checked.
const SHELL_CHAINING_PATTERNS: RegExp[] = [
  /;/,                    // Command separator
  /\|\|/,                 // OR chaining
  /&&/,                   // AND chaining
  /\$\(/,                 // Command substitution
  /`[^`]+`/,              // Backtick substitution
  /\|\s*\w/,              // Pipe to another command (not just |)
];

// Prefixes that should NOT be silently stripped (they escalate privileges)
const DANGEROUS_PREFIXES = ["sudo", "doas", "pkexec", "exec"];

export type CommandSafety =
  | { status: "allowed" }
  | { status: "blocked"; reason: string }
  | {
      status: "requires_confirmation";
      reason: string;
      reversibility: "easy" | "effort" | "irreversible";
      undoHint?: string;
    };

/**
 * Classify a command's safety level.
 * Returns "allowed", "blocked", or "requires_confirmation".
 */
export function classifyCommand(command: string): CommandSafety {
  const trimmed = command.trim();

  // 1. Check absolute blocks first
  for (const pattern of ABSOLUTELY_BLOCKED) {
    if (pattern.test(trimmed)) {
      return { status: "blocked", reason: `Matches blocked pattern: ${pattern.source}` };
    }
  }

  // 2. Check if it requires confirmation
  for (const entry of REQUIRES_CONFIRMATION) {
    if (entry.pattern.test(trimmed)) {
      return {
        status: "requires_confirmation",
        reason: entry.reason,
        reversibility: entry.reversibility,
        undoHint: entry.undoHint,
      };
    }
  }

  // 3. Check for dangerous prefixes (sudo, doas, etc.)
  const baseWithPrefix = extractBaseCommandRaw(trimmed);
  if (DANGEROUS_PREFIXES.includes(baseWithPrefix)) {
    return {
      status: "requires_confirmation",
      reason: `Command uses privilege escalation prefix "${baseWithPrefix}"`,
      reversibility: "effort",
    };
  }

  // 4. Check for shell chaining metacharacters
  // If present, require confirmation since we can't verify all sub-commands
  for (const pattern of SHELL_CHAINING_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        status: "requires_confirmation",
        reason: "Command contains shell operators (;, &&, ||, |, $()) — each sub-command cannot be independently verified",
        reversibility: "effort",
      };
    }
  }

  // 5. Extract the base command (first word, stripping env vars)
  const baseCommand = extractBaseCommand(trimmed);

  // 6. Check against allowlist
  if (isOnAllowlist(baseCommand, trimmed)) {
    return { status: "allowed" };
  }

  // 7. Unknown command — require confirmation
  return {
    status: "requires_confirmation",
    reason: `Unknown command "${baseCommand}" is not on the allowlist`,
    reversibility: "effort",
  };
}

/**
 * Extract the raw first command word without stripping dangerous prefixes.
 * Used to detect sudo/doas/exec before they get stripped.
 */
function extractBaseCommandRaw(command: string): string {
  let cmd = command.trim();

  // Strip leading env var assignments (VAR=value cmd)
  cmd = cmd.replace(/^(\w+=\S+\s+)+/, "");

  // Get first word
  const firstWord = cmd.split(/\s/)[0] || "";

  // Strip path prefix
  return firstWord.split("/").pop() || firstWord;
}

/**
 * Extract the base command from a full command string.
 * Handles env var prefixes, paths, and safe shell builtins.
 * Does NOT strip dangerous prefixes like sudo.
 */
function extractBaseCommand(command: string): string {
  let cmd = command.trim();

  // Strip leading env var assignments (VAR=value cmd)
  cmd = cmd.replace(/^(\w+=\S+\s+)+/, "");

  // Only strip safe prefixes (env, command, builtin — NOT sudo/exec)
  cmd = cmd.replace(/^(env|command|builtin)\s+/, "");

  // Get first word (the actual command)
  const firstWord = cmd.split(/\s/)[0] || "";

  // Strip path prefix (e.g., /usr/bin/git -> git)
  const baseName = firstWord.split("/").pop() || firstWord;

  return baseName;
}

/**
 * Check if a base command matches the allowlist.
 */
function isOnAllowlist(baseCommand: string, fullCommand: string): boolean {
  for (const prefix of ALLOWED_COMMAND_PREFIXES) {
    // Exact match on base command
    if (baseCommand === prefix) {
      return true;
    }

    // Multi-word prefix match (e.g., "docker ps")
    if (prefix.includes(" ") && fullCommand.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

// ─── PATH SANDBOXING ───────────────────────────────────────────────────────────

// Paths that should NEVER be accessible
const FORBIDDEN_PATHS: string[] = [
  "/.ssh",
  "/.aws",
  "/.gnupg",
  "/.config/gh",
  "/.npmrc",
  "/.netrc",
  "/.docker/config.json",
];

// File patterns that should NEVER be written to
const SENSITIVE_FILE_PATTERNS: RegExp[] = [
  /\.env$/,
  /\.env\.(local|prod|production|staging|development)/,
  /\.ssh\//,
  /id_rsa/,
  /id_ed25519/,
  /\.aws\/credentials/,
  /\.npmrc$/,
  /\.netrc$/,
  /passwords?\.(txt|json|yaml|yml)/i,
  /secrets?\.(txt|json|yaml|yml)/i,
  /\.pem$/,
  /\.key$/,
];

export type PathSafety =
  | { status: "allowed" }
  | { status: "blocked"; reason: string }
  | { status: "sensitive"; reason: string };

/**
 * Validate that a file path is within the allowed sandbox.
 * @param filePath - The path to validate
 * @param projectRoot - The project root directory (sandbox boundary)
 * @param operation - "read" allows broader access, "write" is more restrictive
 */
export function validatePath(
  filePath: string,
  projectRoot: string,
  operation: "read" | "write"
): PathSafety {
  const resolvedPath = resolve(filePath);
  const resolvedRoot = resolve(projectRoot);
  const homedir = process.env["HOME"] || process.env["USERPROFILE"] || "";

  // Check forbidden paths (always blocked for both read and write)
  for (const forbidden of FORBIDDEN_PATHS) {
    const forbiddenFull = resolve(homedir + forbidden);
    if (resolvedPath.startsWith(forbiddenFull)) {
      return {
        status: "blocked",
        reason: `Access to ${forbidden} is forbidden`,
      };
    }
  }

  // Check sensitive file patterns
  for (const pattern of SENSITIVE_FILE_PATTERNS) {
    if (pattern.test(resolvedPath)) {
      if (operation === "write") {
        return {
          status: "blocked",
          reason: `Writing to sensitive file matching ${pattern.source} is blocked`,
        };
      }
      return {
        status: "sensitive",
        reason: `Reading sensitive file matching ${pattern.source}`,
      };
    }
  }

  // For write operations, enforce project sandbox
  if (operation === "write") {
    const rel = relative(resolvedRoot, resolvedPath);
    if (rel.startsWith("..") || resolve(resolvedRoot, rel) !== resolvedPath) {
      return {
        status: "blocked",
        reason: `Write operations are restricted to the project directory: ${resolvedRoot}`,
      };
    }
  }

  return { status: "allowed" };
}

// ─── URL VALIDATION (SSRF PROTECTION) ──────────────────────────────────────────

// Private/internal IP ranges that should never be accessed
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,                                    // Loopback
  /^10\./,                                     // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,          // Class B private
  /^192\.168\./,                               // Class C private
  /^169\.254\./,                               // Link-local (AWS IMDS!)
  /^0\./,                                      // Current network
  /^fc[0-9a-f]{2}:/i,                         // IPv6 unique local
  /^fe80:/i,                                   // IPv6 link-local
  /^::1$/,                                     // IPv6 loopback
  /^::$/,                                      // IPv6 unspecified
];

const BLOCKED_HOSTNAMES: string[] = [
  "localhost",
  "metadata.google.internal",
  "metadata.google.com",
];

export type UrlSafety =
  | { status: "allowed" }
  | { status: "blocked"; reason: string };

/**
 * Validate a URL against SSRF protections.
 * Blocks requests to private IPs, localhost, cloud metadata endpoints, and file:// URLs.
 */
export function validateUrl(urlString: string): UrlSafety {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return { status: "blocked", reason: "Invalid URL" };
  }

  // Block file:// protocol
  if (parsedUrl.protocol === "file:") {
    return { status: "blocked", reason: "file:// URLs are not allowed" };
  }

  // Only allow http and https
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return { status: "blocked", reason: `Protocol ${parsedUrl.protocol} is not allowed` };
  }

  // Block known dangerous hostnames
  const hostname = parsedUrl.hostname.toLowerCase();
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
      return { status: "blocked", reason: `Access to ${hostname} is blocked (SSRF protection)` };
    }
  }

  // Block private IP ranges
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { status: "blocked", reason: `Access to private IP ${hostname} is blocked (SSRF protection)` };
    }
  }

  return { status: "allowed" };
}

// ─── LOGGING SANITIZATION ──────────────────────────────────────────────────────

/**
 * Remove potential secrets from text before logging.
 */
export function sanitizeForLogging(text: string): string {
  return text
    .replace(/(?:api[_-]?key|password|secret|token|authorization)\s*[:=]\s*['"]?[^\s'"]{4,}['"]?/gi, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/g, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9]+/g, "[REDACTED]")
    .replace(/ghp_[A-Za-z0-9]+/g, "[REDACTED]")
    .replace(/gho_[A-Za-z0-9]+/g, "[REDACTED]")
    .replace(/xox[bposa]-[A-Za-z0-9-]+/g, "[REDACTED]")
    .replace(/AKIA[A-Z0-9]{16}/g, "[REDACTED]");
}

// ─── ERROR MESSAGE EXTRACTION ──────────────────────────────────────────────────

/**
 * Safely extract an error message from an unknown thrown value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error";
}
