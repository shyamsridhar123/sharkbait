/**
 * Codebase Analysis Tools - Tools for analyzing project structure and dependencies
 * Inspired by Claude Code's Codebase Analysis System
 */

import { readdir, stat, readFile } from "fs/promises";
import { join, relative, extname, basename } from "path";
import type { Tool } from "./registry";

/**
 * Recursively build a directory tree with limited depth
 */
async function buildDirectoryTree(
  dir: string,
  prefix: string = "",
  maxDepth: number = 3,
  currentDepth: number = 0
): Promise<string[]> {
  if (currentDepth >= maxDepth) {
    return [`${prefix}...`];
  }

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const lines: string[] = [];
    
    // Filter out common ignored directories
    const filtered = entries.filter(entry => {
      const ignored = [
        "node_modules", ".git", "dist", "build", ".next", 
        "coverage", ".turbo", ".cache", "target", "vendor"
      ];
      return !ignored.includes(entry.name);
    });

    for (let i = 0; i < filtered.length; i++) {
      const entry = filtered[i];
      if (!entry) continue; // Skip if undefined
      
      const isLast = i === filtered.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const newPrefix = prefix + (isLast ? "    " : "│   ");
      
      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        const subPath = join(dir, entry.name);
        const subLines = await buildDirectoryTree(subPath, newPrefix, maxDepth, currentDepth + 1);
        lines.push(...subLines);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
      }
    }
    
    return lines;
  } catch (error) {
    return [`${prefix}[Error reading directory]`];
  }
}

/**
 * Count lines of code in a file
 */
async function countLines(filePath: string): Promise<number> {
  try {
    const content = await readFile(filePath, "utf-8");
    return content.split("\n").length;
  } catch {
    return 0;
  }
}

/**
 * Recursively analyze files in a directory
 */
async function analyzeFiles(
  dir: string,
  fileStats: Map<string, number>,
  totalLines: { count: number }
): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip common ignored directories
      if (entry.isDirectory()) {
        const ignored = [
          "node_modules", ".git", "dist", "build", ".next",
          "coverage", ".turbo", ".cache", "target", "vendor"
        ];
        if (!ignored.includes(entry.name)) {
          await analyzeFiles(fullPath, fileStats, totalLines);
        }
      } else {
        const ext = extname(entry.name);
        if (ext) {
          const current = fileStats.get(ext) || 0;
          fileStats.set(ext, current + 1);
          
          // Count lines for code files
          const codeExts = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp", ".h"];
          if (codeExts.includes(ext)) {
            const lines = await countLines(fullPath);
            totalLines.count += lines;
          }
        }
      }
    }
  } catch (error) {
    // Silently skip directories we can't read
  }
}

/**
 * Detect frameworks and languages from file extensions and package.json
 */
async function detectTechnologies(projectDir: string): Promise<string[]> {
  const technologies: string[] = [];
  
  try {
    // Check for package.json
    const pkgJsonPath = join(projectDir, "package.json");
    try {
      const pkgJsonContent = await readFile(pkgJsonPath, "utf-8");
      const pkgJson = JSON.parse(pkgJsonContent);
      
      // Detect from dependencies
      const allDeps = {
        ...pkgJson.dependencies,
        ...pkgJson.devDependencies,
      };
      
      if (allDeps.react) technologies.push("React");
      if (allDeps.vue) technologies.push("Vue");
      if (allDeps.angular || allDeps["@angular/core"]) technologies.push("Angular");
      if (allDeps.next) technologies.push("Next.js");
      if (allDeps.express) technologies.push("Express");
      if (allDeps.typescript) technologies.push("TypeScript");
      if (allDeps.ink) technologies.push("Ink (Terminal UI)");
    } catch {
      // No package.json or can't read it
    }
    
    // Check for other config files
    const configFiles = [
      { file: "tsconfig.json", tech: "TypeScript" },
      { file: "go.mod", tech: "Go" },
      { file: "Cargo.toml", tech: "Rust" },
      { file: "requirements.txt", tech: "Python" },
      { file: "Pipfile", tech: "Python (Pipenv)" },
      { file: "pom.xml", tech: "Java (Maven)" },
      { file: "build.gradle", tech: "Java (Gradle)" },
    ];
    
    for (const { file, tech } of configFiles) {
      try {
        const filePath = join(projectDir, file);
        const fileExists = await stat(filePath).then(() => true).catch(() => false);
        if (fileExists && !technologies.includes(tech)) {
          technologies.push(tech);
        }
      } catch {
        // File doesn't exist
      }
    }
  } catch (error) {
    // Silently handle errors
  }
  
  return technologies;
}

export const codebaseTools: Tool[] = [
  {
    name: "analyze_codebase",
    description: "Scans the project directory and returns a structured overview: file count by type, directory tree (limited depth), total lines of code, detected frameworks/languages. Helps understand the project structure at a high level.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Project directory path to analyze (defaults to current directory)",
        },
        maxDepth: {
          type: "number",
          description: "Maximum depth for directory tree (default: 3)",
        },
      },
      required: [],
    },
    async execute({ path, maxDepth }) {
      const projectDir = (path as string) || process.cwd();
      const depth = (maxDepth as number) || 3;
      
      try {
        // Check if directory exists
        await stat(projectDir);
      } catch {
        return {
          error: `Directory not found: ${projectDir}`,
        };
      }
      
      // Analyze files
      const fileStats = new Map<string, number>();
      const totalLines = { count: 0 };
      await analyzeFiles(projectDir, fileStats, totalLines);
      
      // Build directory tree
      const tree = await buildDirectoryTree(projectDir, "", depth, 0);
      
      // Detect technologies
      const technologies = await detectTechnologies(projectDir);
      
      // Format file counts
      const filesByType = Array.from(fileStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20) // Top 20 file types
        .map(([ext, count]) => `  ${ext}: ${count}`)
        .join("\n");
      
      return {
        directory: projectDir,
        totalFiles: Array.from(fileStats.values()).reduce((a, b) => a + b, 0),
        totalLinesOfCode: totalLines.count,
        detectedTechnologies: technologies,
        filesByType: filesByType || "  (no files found)",
        directoryTree: tree.slice(0, 100).join("\n") + (tree.length > 100 ? "\n  ..." : ""),
      };
    },
  },

  {
    name: "find_dependencies",
    description: "Reads package.json (or bun.lock) and returns a summary of dependencies and devDependencies. Useful for understanding project dependencies.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path to package.json (defaults to ./package.json)",
        },
      },
      required: [],
    },
    async execute({ path }) {
      const pkgJsonPath = (path as string) || join(process.cwd(), "package.json");
      
      try {
        const content = await readFile(pkgJsonPath, "utf-8");
        const pkgJson = JSON.parse(content);
        
        const dependencies = pkgJson.dependencies || {};
        const devDependencies = pkgJson.devDependencies || {};
        
        return {
          name: pkgJson.name,
          version: pkgJson.version,
          description: pkgJson.description,
          dependencies: {
            count: Object.keys(dependencies).length,
            list: Object.entries(dependencies)
              .map(([name, version]) => `  ${name}: ${version}`)
              .join("\n") || "  (none)",
          },
          devDependencies: {
            count: Object.keys(devDependencies).length,
            list: Object.entries(devDependencies)
              .map(([name, version]) => `  ${name}: ${version}`)
              .join("\n") || "  (none)",
          },
          scripts: pkgJson.scripts ? Object.keys(pkgJson.scripts) : [],
        };
      } catch (error) {
        return {
          error: `Failed to read package.json: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  },

  {
    name: "map_architecture",
    description: "Identifies key architectural files (entry points, config files, test directories, CI configs) and returns a summary map of the project layout. Helps quickly understand the project's architecture.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Project directory path (defaults to current directory)",
        },
      },
      required: [],
    },
    async execute({ path }) {
      const projectDir = (path as string) || process.cwd();
      
      try {
        await stat(projectDir);
      } catch {
        return {
          error: `Directory not found: ${projectDir}`,
        };
      }
      
      const architectureMap: Record<string, string[]> = {
        entryPoints: [],
        configFiles: [],
        testDirectories: [],
        ciConfigs: [],
        documentation: [],
        buildOutputs: [],
      };
      
      // Entry points to look for
      const entryPoints = [
        "src/index.ts", "src/index.js", "src/main.ts", "src/main.js",
        "src/cli.ts", "src/cli.js", "src/app.ts", "src/app.tsx",
        "index.ts", "index.js", "main.ts", "main.js",
      ];
      
      for (const entry of entryPoints) {
        const fullPath = join(projectDir, entry);
        try {
          await stat(fullPath);
          architectureMap["entryPoints"].push(entry);
        } catch {
          // File doesn't exist
        }
      }
      
      // Config files to look for
      const configFiles = [
        "package.json", "tsconfig.json", "bun.lock", "bunfig.toml",
        "webpack.config.js", "vite.config.ts", "rollup.config.js",
        ".eslintrc", ".eslintrc.json", "eslint.config.js",
        ".prettierrc", "prettier.config.js",
        "jest.config.js", "vitest.config.ts",
        "docker-compose.yml", "Dockerfile",
      ];
      
      for (const config of configFiles) {
        const fullPath = join(projectDir, config);
        try {
          await stat(fullPath);
          architectureMap["configFiles"].push(config);
        } catch {
          // File doesn't exist
        }
      }
      
      // Test directories to look for
      const testDirs = ["tests", "test", "__tests__", "src/__tests__", "spec"];
      
      for (const testDir of testDirs) {
        const fullPath = join(projectDir, testDir);
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            architectureMap["testDirectories"].push(testDir);
          }
        } catch {
          // Directory doesn't exist
        }
      }
      
      // CI configs to look for
      const ciConfigs = [
        ".github/workflows",
        ".gitlab-ci.yml",
        ".travis.yml",
        "circle.yml",
        ".circleci/config.yml",
        "azure-pipelines.yml",
      ];
      
      for (const ci of ciConfigs) {
        const fullPath = join(projectDir, ci);
        try {
          await stat(fullPath);
          architectureMap["ciConfigs"].push(ci);
        } catch {
          // File doesn't exist
        }
      }
      
      // Documentation files
      const docs = ["README.md", "CONTRIBUTING.md", "CHANGELOG.md", "docs", "LICENSE"];
      
      for (const doc of docs) {
        const fullPath = join(projectDir, doc);
        try {
          await stat(fullPath);
          architectureMap["documentation"].push(doc);
        } catch {
          // File doesn't exist
        }
      }
      
      // Build output directories
      const buildDirs = ["dist", "build", "out", ".next", "target"];
      
      for (const buildDir of buildDirs) {
        const fullPath = join(projectDir, buildDir);
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            architectureMap["buildOutputs"].push(buildDir);
          }
        } catch {
          // Directory doesn't exist
        }
      }
      
      return {
        projectDirectory: projectDir,
        entryPoints: architectureMap["entryPoints"].length > 0 
          ? architectureMap["entryPoints"] 
          : ["(none found)"],
        configFiles: architectureMap["configFiles"].length > 0 
          ? architectureMap["configFiles"] 
          : ["(none found)"],
        testDirectories: architectureMap["testDirectories"].length > 0 
          ? architectureMap["testDirectories"] 
          : ["(none found)"],
        ciConfigs: architectureMap["ciConfigs"].length > 0 
          ? architectureMap["ciConfigs"] 
          : ["(none found)"],
        documentation: architectureMap["documentation"].length > 0 
          ? architectureMap["documentation"] 
          : ["(none found)"],
        buildOutputs: architectureMap["buildOutputs"].length > 0 
          ? architectureMap["buildOutputs"] 
          : ["(none found)"],
      };
    },
  },
];
