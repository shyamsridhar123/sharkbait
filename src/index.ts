/**
 * Sharkbait CLI - Main Application Module
 *
 * Main entry point for the application inspired by Claude Code architecture.
 * This module bootstraps the application and manages the lifecycle of all subsystems.
 */

import { loadConfig, type Config } from "./utils/config.js";
import { logger } from "./utils/logger.js";
import { AzureOpenAIClient } from "./llm/azure-openai.js";
import { ToolRegistry } from "./tools/registry.js";
import { HookRegistry } from "./hooks/registry.js";
import { initErrorHandling } from "./utils/errors.js";
import { initTelemetry, type TelemetryClient } from "./utils/telemetry.js";

/**
 * Application instance that holds references to all initialized subsystems
 */
export interface AppInstance {
  config: Config;
  llm: AzureOpenAIClient;
  tools: ToolRegistry;
  hooks: HookRegistry;
  telemetry: TelemetryClient | null;
}

/**
 * Initialize all application subsystems
 * @param options Optional configuration overrides
 * @returns Initialized application instance
 */
export async function initialize(options: Partial<Config> = {}): Promise<AppInstance> {
  // Set up error handling first
  initErrorHandling();

  try {
    logger.info("Starting Sharkbait CLI...");

    // Load configuration
    const config = await loadConfig(options);

    // Initialize LLM client
    const llm = new AzureOpenAIClient({
      endpoint: config.azure.endpoint,
      apiKey: config.azure.apiKey,
      deployment: config.azure.deployment,
      apiVersion: config.azure.apiVersion,
    });

    // Initialize tool registry
    const tools = new ToolRegistry();

    // Initialize hook registry
    const hooks = new HookRegistry();
    await hooks.loadBuiltins();

    // Initialize telemetry if enabled
    const telemetry = config.telemetry?.enabled
      ? await initTelemetry(config)
      : null;

    logger.info("Sharkbait CLI initialized successfully");

    return {
      config,
      llm,
      tools,
      hooks,
      telemetry,
    };
  } catch (error) {
    logger.error("Failed to initialize Sharkbait:", error);
    throw error;
  }
}

/**
 * Gracefully shut down the application
 * @param app Application instance to shut down
 */
export async function shutdown(app: AppInstance): Promise<void> {
  logger.info("Shutting down Sharkbait CLI...");

  try {
    // Submit telemetry if enabled
    if (app.telemetry) {
      await app.telemetry.flush();
    }

    logger.info("Sharkbait CLI shutdown complete");
  } catch (error) {
    logger.error("Error during shutdown:", error);
  }
}

/**
 * Handle process signals for clean shutdown
 * @param app Application instance
 */
export function setupProcessHandlers(app: AppInstance): void {
  let shuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info(`Received ${signal} signal`);
    await shutdown(app);
    process.exit(0);
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Promise Rejection:", reason);
    console.error("Unhandled rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    console.error("Uncaught exception:", error);
    process.exit(1);
  });
}
