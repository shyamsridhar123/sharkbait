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
}

let cachedConfig: Config | null = null;

export function loadConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  // 1. Start with defaults
  const config: Config = {
    azure: {
      endpoint: "",
      apiKey: "",
      deployment: "gpt-codex-5.2",
      apiVersion: "2024-10-21",
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
  };

  // 2. Load from global config file if exists
  const globalConfigPath = join(homedir(), ".sharkbait", "config.json");
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

  cachedConfig = config;
  return config;
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
