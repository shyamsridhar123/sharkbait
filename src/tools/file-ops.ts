/**
 * File Operations Tools - read, write, edit, search files
 * Now with filesystem sandboxing via centralized security module
 */

import { readdir, stat, mkdir } from "fs/promises";
import { join, relative } from "path";
import type { Tool } from "./registry";
import { validatePath } from "../utils/security";
import { ToolError, SecurityError } from "../utils/errors";
import { getErrorMessage } from "../utils/security";
import { exec, readTextFile, writeTextFile, fileExists } from "../utils/runtime";

/**
 * Enforce path safety or throw.
 */
function enforcePath(filePath: string, operation: "read" | "write"): void {
  const safety = validatePath(filePath, process.cwd(), operation);
  if (safety.status === "blocked") {
    throw new SecurityError(safety.reason);
  }
  // "sensitive" status is allowed for reads but logged
}

export const fileTools: Tool[] = [
  {
    name: "read_file",
    description: "Read the contents of a file",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
        startLine: { type: "number", description: "Start line (1-indexed)" },
        endLine: { type: "number", description: "End line (1-indexed)" },
      },
      required: ["path"],
    },
    async execute({ path, startLine, endLine }) {
      const filePath = path as string;
      enforcePath(filePath, "read");

      if (!fileExists(filePath)) {
        throw new ToolError(`File not found: ${filePath}`, "read_file");
      }

      const content = await readTextFile(filePath);

      if (startLine !== undefined && endLine !== undefined) {
        const lines = content.split("\n");
        const start = Math.max(0, (startLine as number) - 1);
        const end = Math.min(lines.length, endLine as number);
        return lines.slice(start, end).join("\n");
      }

      return content;
    },
  },

  {
    name: "write_file",
    description: "Write content to a file (creates directories if needed). Sandboxed to project directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
    async execute({ path, content }) {
      const filePath = path as string;
      enforcePath(filePath, "write");

      // Ensure parent directory exists
      const dir = filePath.substring(
        0,
        filePath.lastIndexOf("/") || filePath.lastIndexOf("\\")
      );
      if (dir) {
        await mkdir(dir, { recursive: true });
      }

      await writeTextFile(filePath, content as string);
      return { success: true, path: filePath };
    },
  },

  {
    name: "edit_file",
    description: "Replace a specific string in a file. Sandboxed to project directory.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to edit" },
        oldString: { type: "string", description: "Exact text to replace" },
        newString: { type: "string", description: "Replacement text" },
      },
      required: ["path", "oldString", "newString"],
    },
    async execute({ path, oldString, newString }) {
      const filePath = path as string;
      enforcePath(filePath, "write");

      if (!fileExists(filePath)) {
        throw new ToolError(`File not found: ${filePath}`, "edit_file");
      }

      const content = await readTextFile(filePath);
      const oldStr = oldString as string;

      if (!content.includes(oldStr)) {
        throw new ToolError(
          `String not found in file: ${oldStr.substring(0, 50)}...`,
          "edit_file"
        );
      }

      const occurrences = content.split(oldStr).length - 1;
      if (occurrences > 1) {
        throw new ToolError(
          `String found ${occurrences} times. Please provide more context for unique match.`,
          "edit_file"
        );
      }

      const newContent = content.replace(oldStr, newString as string);
      await writeTextFile(filePath, newContent);

      return { success: true, path: filePath };
    },
  },

  {
    name: "list_directory",
    description: "List contents of a directory",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path" },
        recursive: {
          type: "boolean",
          description: "List recursively",
        },
      },
      required: ["path"],
    },
    async execute({ path, recursive }) {
      const dirPath = path as string;
      const entries: string[] = [];

      async function walk(dir: string): Promise<void> {
        try {
          const items = await readdir(dir, { withFileTypes: true });
          for (const item of items) {
            const fullPath = join(dir, item.name);
            const relativePath = relative(process.cwd(), fullPath);

            // Skip hidden files and common ignore patterns
            if (
              item.name.startsWith(".") ||
              item.name === "node_modules"
            ) {
              continue;
            }

            entries.push(
              item.isDirectory() ? `${relativePath}/` : relativePath
            );

            if (recursive && item.isDirectory()) {
              await walk(fullPath);
            }
          }
        } catch {
          // Skip directories we can't read
        }
      }

      await walk(dirPath);
      return entries;
    },
  },

  {
    name: "search_files",
    description:
      "Search for text in files using grep-like pattern matching",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Search pattern (regex supported)",
        },
        path: { type: "string", description: "Directory to search" },
        filePattern: {
          type: "string",
          description: "File glob pattern (e.g., *.ts)",
        },
        maxResults: {
          type: "number",
          description: "Maximum results to return",
        },
      },
      required: ["pattern"],
    },
    async execute({ pattern, path, filePattern, maxResults }) {
      const searchPath = (path as string) || ".";
      const glob = (filePattern as string) || "*";
      const limit = (maxResults as number) || 50;

      try {
        const args = [
          "rg",
          pattern as string,
          searchPath,
          "-g",
          glob,
          "--json",
          "-m",
          String(limit),
        ];
        const result = await exec(args);
        return result.stdout;
      } catch {
        try {
          const args = [
            "grep",
            "-r",
            pattern as string,
            searchPath,
            "--include",
            glob,
          ];
          const result = await exec(args);
          return result.stdout;
        } catch {
          return "No matches found";
        }
      }
    },
  },

  {
    name: "grep_search",
    description: "Fast text search with regex support (uses ripgrep)",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search pattern (regex supported)",
        },
        path: {
          type: "string",
          description: "Directory or file to search",
        },
        caseSensitive: {
          type: "boolean",
          description: "Case sensitive search",
        },
        maxResults: {
          type: "number",
          description: "Maximum results to return",
        },
      },
      required: ["query"],
    },
    async execute({ query, path, caseSensitive, maxResults }) {
      const searchPath = (path as string) || ".";
      const args = ["rg", query as string, searchPath, "--json"];

      if (!caseSensitive) {
        args.push("-i");
      }

      if (maxResults) {
        args.push("-m", String(maxResults));
      }

      try {
        const result = await exec(args);
        return result.stdout || "No matches found";
      } catch {
        return "Search failed - ripgrep may not be installed";
      }
    },
  },

  {
    name: "create_directory",
    description: "Create a directory (with parents if needed). Sandboxed to project directory.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path to create",
        },
      },
      required: ["path"],
    },
    async execute({ path }) {
      const dirPath = path as string;
      enforcePath(dirPath, "write");

      await mkdir(dirPath, { recursive: true });
      return { success: true, path: dirPath };
    },
  },
];
