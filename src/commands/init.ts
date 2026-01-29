/**
 * Init Command - Initialize Sharkbait in a project
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { log } from "../utils/logger";

export async function initProject(): Promise<void> {
  log.info("Initializing Sharkbait in current project...");

  const cwd = process.cwd();

  // Create .sharkbait.json config file
  const configPath = join(cwd, ".sharkbait.json");
  const defaultConfig = {
    features: {
      beads: true,
      confirmDestructive: true,
    },
    ui: {
      theme: "dark",
      showSpinner: true,
    },
  };

  try {
    await writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
    log.success(`Created ${configPath}`);
  } catch (error) {
    log.warn(`Could not create config file: ${error}`);
  }

  // Create .env.example if it doesn't exist
  const envExamplePath = join(cwd, ".env.example");
  const envExample = `# Azure OpenAI Configuration (required)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_DEPLOYMENT=gpt-codex-5.2
AZURE_OPENAI_API_VERSION=2024-10-21

# Optional Settings
SHARKBAIT_LOG_LEVEL=info
SHARKBAIT_MAX_CONTEXT_TOKENS=100000
SHARKBAIT_CONFIRM_DESTRUCTIVE=true
`;

  try {
    await writeFile(envExamplePath, envExample);
    log.success(`Created ${envExamplePath}`);
  } catch (error) {
    log.warn(`Could not create .env.example: ${error}`);
  }

  // Update .gitignore if it exists
  const gitignorePath = join(cwd, ".gitignore");
  try {
    const gitignoreContent = await Bun.file(gitignorePath).text();
    if (!gitignoreContent.includes(".env")) {
      await Bun.write(gitignorePath, gitignoreContent + "\n# Sharkbait\n.env\n");
      log.success("Updated .gitignore");
    }
  } catch {
    // .gitignore doesn't exist, that's okay
  }

  log.info("");
  log.info("Sharkbait initialized successfully!");
  log.info("");
  log.info("Next steps:");
  log.info("  1. Copy .env.example to .env and fill in your Azure OpenAI credentials");
  log.info("  2. Run 'sharkbait chat' to start an interactive session");
  log.info("");
}
