/**
 * Security Utilities - Command validation and safety checks
 */

// Commands that should NEVER be executed
export const BLOCKED_COMMANDS = [
  /rm\s+-rf\s+\/(?!\w)/,           // rm -rf / (but not /path)
  /rm\s+-rf\s+~\/?$/,              // rm -rf ~ or rm -rf ~/
  /:()\s*{\s*:\|:&\s*}/,           // Fork bomb
  /dd\s+if=.*of=\/dev\/sd/,        // Disk overwrite
  /chmod\s+777\s+\//,              // Dangerous permissions on root
  /curl.*\|\s*(?:ba)?sh/,          // Pipe curl to shell
  /wget.*\|\s*(?:ba)?sh/,          // Pipe wget to shell
  /mkfs\s+/,                       // Format filesystem
  />\s*\/dev\/sd/,                 // Redirect to disk device
  /nc\s+-e/,                       // Netcat reverse shell
  /bash\s+-i\s+>&/,                // Reverse shell
];

// Patterns that indicate potentially destructive commands
export const DANGEROUS_PATTERNS = [
  /rm\s+-rf/,                      // Recursive force delete
  /DROP\s+DATABASE/i,              // Database deletion
  /TRUNCATE\s+TABLE/i,             // Table truncation
  /DELETE\s+FROM\s+\w+\s*;?\s*$/i, // Delete all from table
  /git\s+push\s+.*--force/,        // Force push
  /npm\s+publish/,                 // NPM publish
  /docker\s+rm/,                   // Docker container removal
  /kubectl\s+delete/,              // Kubernetes deletion
];

export function isCommandSafe(command: string): boolean {
  // Check against blocked patterns
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return false;
    }
  }
  return true;
}

export function isDangerousCommand(command: string): boolean {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return true;
    }
  }
  return false;
}

export function sanitizeForLogging(text: string): string {
  // Remove potential secrets from logs
  return text
    .replace(/(?:api[_-]?key|password|secret|token)\s*[:=]\s*['"]?[^\s'"]+['"]?/gi, "[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9-_.]+/g, "Bearer [REDACTED]")
    .replace(/sk-[A-Za-z0-9]+/g, "[REDACTED]");
}
