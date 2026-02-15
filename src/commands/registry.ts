/**
 * Command Registry
 *
 * Centralized command registration and execution system inspired by Claude Code.
 * Provides command categorization, help generation, and dynamic command loading.
 */

import type { AppInstance } from "../index.js";

/**
 * Command definition interface
 */
export interface CommandDefinition {
  /** Command name (e.g., "chat", "ask", "review") */
  name: string;

  /** Short description of the command */
  description: string;

  /** Detailed usage information */
  usage?: string;

  /** Command category for grouping in help */
  category?: string;

  /** Whether command requires authentication */
  requiresAuth?: boolean;

  /** Whether to hide from help output */
  hidden?: boolean;

  /** Command options/flags */
  options?: CommandOption[];

  /** Command examples */
  examples?: string[];

  /** Command handler function */
  handler: CommandHandler;
}

/**
 * Command option definition
 */
export interface CommandOption {
  /** Option flag (e.g., "-c, --context <files>") */
  flags: string;

  /** Option description */
  description: string;

  /** Default value */
  defaultValue?: any;
}

/**
 * Command handler function type
 */
export type CommandHandler = (
  args: string[],
  options: Record<string, any>,
  app: AppInstance
) => Promise<void> | void;

/**
 * Command Registry class
 */
export class CommandRegistry {
  private commands = new Map<string, CommandDefinition>();

  /**
   * Register a command
   */
  register(command: CommandDefinition): void {
    if (this.commands.has(command.name)) {
      throw new Error(`Command '${command.name}' is already registered`);
    }
    this.commands.set(command.name, command);
  }

  /**
   * Get a command by name
   */
  get(name: string): CommandDefinition | undefined {
    return this.commands.get(name);
  }

  /**
   * Check if a command exists
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * List all registered commands
   */
  list(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get all unique categories
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const command of this.commands.values()) {
      if (command.category) {
        categories.add(command.category);
      }
    }
    return Array.from(categories).sort();
  }

  /**
   * Get commands by category
   */
  getByCategory(category: string): CommandDefinition[] {
    return this.list().filter((cmd) => cmd.category === category);
  }

  /**
   * Get uncategorized commands
   */
  getUncategorized(): CommandDefinition[] {
    return this.list().filter((cmd) => !cmd.category && !cmd.hidden);
  }

  /**
   * Execute a command
   */
  async execute(
    name: string,
    args: string[],
    options: Record<string, any>,
    app: AppInstance
  ): Promise<void> {
    const command = this.get(name);

    if (!command) {
      throw new Error(`Unknown command: ${name}`);
    }

    await command.handler(args, options, app);
  }

  /**
   * Generate help text for a specific command
   */
  generateCommandHelp(command: CommandDefinition): string {
    const lines: string[] = [];

    lines.push(`Command: ${command.name}`);
    lines.push("");
    lines.push(`Description:`);
    lines.push(`  ${command.description}`);
    lines.push("");

    if (command.usage) {
      lines.push(`Usage:`);
      lines.push(`  ${command.usage}`);
      lines.push("");
    }

    if (command.options && command.options.length > 0) {
      lines.push(`Options:`);
      for (const option of command.options) {
        const defaultText = option.defaultValue
          ? ` (default: ${option.defaultValue})`
          : "";
        lines.push(`  ${option.flags.padEnd(25)} ${option.description}${defaultText}`);
      }
      lines.push("");
    }

    if (command.examples && command.examples.length > 0) {
      lines.push(`Examples:`);
      for (const example of command.examples) {
        lines.push(`  ${example}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Generate general help text
   */
  generateHelp(version: string): string {
    const lines: string[] = [];

    lines.push(`Sharkbait CLI v${version}`);
    lines.push("");
    lines.push("AI-powered coding assistant for the command line.");
    lines.push("");
    lines.push("Usage:");
    lines.push("  sharkbait <command> [arguments] [options]");
    lines.push("");
    lines.push("Available Commands:");
    lines.push("");

    // Uncategorized commands
    const uncategorized = this.getUncategorized();
    if (uncategorized.length > 0) {
      for (const cmd of uncategorized.sort((a, b) => a.name.localeCompare(b.name))) {
        lines.push(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
      }
      lines.push("");
    }

    // Categorized commands
    const categories = this.getCategories();
    for (const category of categories) {
      lines.push(`${category}:`);
      const commands = this.getByCategory(category);
      for (const cmd of commands.filter((c) => !c.hidden).sort((a, b) => a.name.localeCompare(b.name))) {
        lines.push(`  ${cmd.name.padEnd(15)} ${cmd.description}`);
      }
      lines.push("");
    }

    lines.push("For more information on a specific command, use:");
    lines.push("  sharkbait help <command>");
    lines.push("");
    lines.push("Examples:");
    lines.push('  $ sharkbait ask "How do I implement a binary search tree?"');
    lines.push("  $ sharkbait review path/to/file.ts");
    lines.push("  $ sharkbait run \"Add input validation to the API\"");
    lines.push("");

    return lines.join("\n");
  }
}

/**
 * Global command registry instance
 */
export const commandRegistry = new CommandRegistry();
