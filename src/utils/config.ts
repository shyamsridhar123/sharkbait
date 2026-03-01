/**
 * Configuration - Load and validate configuration from multiple sources
 * Uses JSON.parse (not require) and deep merge for safety
 */

import { join } from "path";
import { homedir } from "os";
import { readFileSync, existsSync } from "fs";
import { ConfigError } from "./errors";

export interface Config {
  azure: {
    endpoint: string;
    apiKey: string;
    deployment: string;
    apiVersion: string;
  };
  features: {
    beads: boolean;
    confirmDestructive: boolean;
  };
  ui: {
    theme: "dark" | "light";
    showSpinner: boolean;
  };
  limits: {
    maxContextTokens: number;
    maxIterations: number;
  };
  paths: {
    configDir: string;
    defaultWorkingDir: string | null;
  };
}

let cachedConfig: Config | null = null;

/**
 * Deep merge source into target. Only merges plain objects — arrays and
 * primitives from source overwrite target values.
 */
function deepMerge(
  target: Record<string, any>,
  source: Record<string, unknown>
): Record<string, any> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const targetVal = result[key];
    const sourceVal = source[key];

    if (
      targetVal &&
      sourceVal &&
      typeof targetVal === "object" &&
      typeof sourceVal === "object" &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, any>,
        sourceVal as Record<string, unknown>
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}

/**
 * Safely load a JSON config file. Returns null if not found or invalid.
 * Uses JSON.parse (NOT require) to prevent code execution.
 */
function loadJsonConfig(filePath: string): Record<string, unknown> | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configDir = join(homedir(), ".sharkbait");

  // 1. Start with defaults
  let config: Config = {
    azure: {
      endpoint: "",
      apiKey: "",
      deployment: "gpt-codex-5.2",
      apiVersion: "2025-03-01-preview",
    },
    features: {
      beads: true,
      confirmDestructive: true,
    },
    ui: {
      theme: "dark",
      showSpinner: true,
    },
    limits: {
      maxContextTokens: 100000,
      maxIterations: 50,
    },
    paths: {
      configDir,
      defaultWorkingDir: null,
    },
  };

  // 2. Load from global config file (deep merge — partial configs are safe)
  const globalConfigPath = join(configDir, "config.json");
  const globalConfig = loadJsonConfig(globalConfigPath);
  if (globalConfig) {
    config = deepMerge(config as any, globalConfig) as Config;
  }

  // 3. Load from project config file (deep merge)
  const projectConfigPath = join(process.cwd(), ".sharkbait.json");
  const projectConfig = loadJsonConfig(projectConfigPath);
  if (projectConfig) {
    // Project config CANNOT override security-critical settings
    delete projectConfig["features"];
    config = deepMerge(config as any, projectConfig) as Config;
  }

  // 4. Override with environment variables
  if (process.env["AZURE_OPENAI_ENDPOINT"]) {
    config.azure.endpoint = process.env["AZURE_OPENAI_ENDPOINT"];
  }
  if (process.env["AZURE_OPENAI_API_KEY"]) {
    config.azure.apiKey = process.env["AZURE_OPENAI_API_KEY"];
  }
  if (process.env["AZURE_OPENAI_CODEX_DEPLOYMENT"]) {
    config.azure.deployment = process.env["AZURE_OPENAI_CODEX_DEPLOYMENT"];
  } else if (process.env["AZURE_OPENAI_DEPLOYMENT"]) {
    config.azure.deployment = process.env["AZURE_OPENAI_DEPLOYMENT"];
  }
  if (process.env["AZURE_OPENAI_API_VERSION"]) {
    config.azure.apiVersion = process.env["AZURE_OPENAI_API_VERSION"];
  }
  if (process.env["SHARKBAIT_MAX_CONTEXT_TOKENS"]) {
    config.limits.maxContextTokens = parseInt(
      process.env["SHARKBAIT_MAX_CONTEXT_TOKENS"],
      10
    );
  }
  if (process.env["SHARKBAIT_CONFIRM_DESTRUCTIVE"]) {
    config.features.confirmDestructive =
      process.env["SHARKBAIT_CONFIRM_DESTRUCTIVE"] !== "false";
  }
  if (process.env["SHARKBAIT_WORKING_DIR"]) {
    config.paths.defaultWorkingDir = process.env["SHARKBAIT_WORKING_DIR"];
  }

  cachedConfig = config;
  return config;
}

/**
 * Get the effective working directory
 */
export function getWorkingDir(cliOption?: string): string {
  if (cliOption) {
    return cliOption;
  }

  const config = loadConfig();
  if (config.paths.defaultWorkingDir) {
    return config.paths.defaultWorkingDir;
  }

  return process.cwd();
}

/**
 * Get the config directory path (~/.sharkbait)
 */
export function getConfigDir(): string {
  return join(homedir(), ".sharkbait");
}

/**
 * Ensure the config directory exists
 */
export async function ensureConfigDir(): Promise<string> {
  const configDir = getConfigDir();
  const { mkdir } = await import("fs/promises");
  await mkdir(configDir, { recursive: true });
  return configDir;
}

export function validateConfig(config: Config): void {
  if (!config.azure.endpoint) {
    throw new ConfigError(
      "Azure OpenAI endpoint is required. Set AZURE_OPENAI_ENDPOINT environment variable."
    );
  }
  // apiKey is no longer required — Azure Identity is used when absent.
  // Log the auth method for debugging.
  if (!config.azure.apiKey) {
    // Will use DefaultAzureCredential at runtime
  }
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
