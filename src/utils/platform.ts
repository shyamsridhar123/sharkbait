/**
 * Platform Utilities - Cross-platform helpers
 */

import { homedir } from "os";
import { normalize, sep } from "path";

export function isWindows(): boolean {
  return process.platform === "win32";
}

export function isMac(): boolean {
  return process.platform === "darwin";
}

export function isLinux(): boolean {
  return process.platform === "linux";
}

export function getHomeDir(): string {
  return homedir();
}

export function normalizePath(path: string): string {
  // Normalize path separators for the current platform
  return normalize(path);
}

export function toUnixPath(path: string): string {
  // Convert Windows paths to Unix-style paths
  return path.replace(/\\/g, "/");
}

export function getShell(): string {
  if (isWindows()) {
    return process.env["COMSPEC"] || "cmd.exe";
  }
  return process.env["SHELL"] || "/bin/sh";
}

export function getShellArgs(): string[] {
  if (isWindows()) {
    return ["/c"];
  }
  return ["-c"];
}

export function getPathSeparator(): string {
  return sep;
}

export function getEnvPathSeparator(): string {
  return isWindows() ? ";" : ":";
}
