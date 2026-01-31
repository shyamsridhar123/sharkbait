/**
 * Configuration - Load and validate configuration from multiple sources
 */

import { join } from "path";
import { homedir } from "os";
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
    configDir: string;      // Default: ~/.sharkbait
    defaultWorkingDir: string | null;  // Default working directory (null = use cwd)
  };
}

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Config directory path
  const configDir = join(homedir(), ".sharkbait");

  // 1. Start with defaults
  const config: Config = {
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

  // 2. Load from global config file if exists
  const globalConfigPath = join(configDir, "config.json");
  try {
    const globalConfig = require(globalConfigPath);
    Object.assign(config, globalConfig);
  } catch {
    // Global config doesn't exist, that's okay
  }

  // 3. Load from project config file if exists
  try {
    const projectConfig = require(join(process.cwd(), ".sharkbait.json"));
    Object.assign(config, projectConfig);
  } catch {
    // Project config doesn't exist, that's okay
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
    config.limits.maxContextTokens = parseInt(process.env["SHARKBAIT_MAX_CONTEXT_TOKENS"], 10);
  }
  if (process.env["SHARKBAIT_CONFIRM_DESTRUCTIVE"]) {
    config.features.confirmDestructive = process.env["SHARKBAIT_CONFIRM_DESTRUCTIVE"] !== "false";
  }
  if (process.env["SHARKBAIT_WORKING_DIR"]) {
    config.paths.defaultWorkingDir = process.env["SHARKBAIT_WORKING_DIR"];
  }

  cachedConfig = config;
  return config;
}

/**
 * Get the effective working directory
 * Priority: CLI option > env var > config file > process.cwd()
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
  if (!config.azure.apiKey) {
    throw new ConfigError(
      "Azure OpenAI API key is required. Set AZURE_OPENAI_API_KEY environment variable."
    );
  }
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
