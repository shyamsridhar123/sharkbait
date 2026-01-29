/**
 * Slash Command System - Types and interfaces
 */

import type { Agent } from "../../agent/agent";

/**
 * Context passed to command handlers
 */
export interface CommandContext {
  /** Current working directory */
  currentDir: string;
  /** Function to update working directory */
  setCurrentDir: (dir: string) => void;
  /** Function to add a message to the chat */
  addMessage: (role: "user" | "assistant" | "system", content: string) => void;
  /** Function to clear all messages */
  clearMessages: () => void;
  /** Function to show welcome screen */
  showWelcome: () => void;
  /** The agent instance */
  agent: Agent;
  /** App version */
  version: string;
  /** Exit the application */
  exit: () => void;
  /** Set pending confirmation */
  setPendingConfirm: (confirm: { type: string; data: any } | null) => void;
  /** Current beads enabled state */
  beadsEnabled: boolean;
  /** Toggle beads */
  setBeadsEnabled: (enabled: boolean) => void;
  /** Context files */
  contextFiles: string[];
  /** Set context files */
  setContextFiles: (files: string[]) => void;
}

/**
 * Result of a command execution
 */
export interface CommandResult {
  /** Whether the command was handled */
  handled: boolean;
  /** Optional message to display */
  message?: string;
  /** Whether this is an error message */
  isError?: boolean;
}

/**
 * Slash command definition
 */
export interface SlashCommand {
  /** Primary command name (without the /) */
  name: string;
  /** Alternative names for the command */
  aliases?: string[];
  /** Short description for /help */
  description: string;
  /** Usage examples */
  usage?: string;
  /** Argument specification */
  args?: string;
  /** Command category for grouping in /help */
  category: "navigation" | "session" | "config" | "action" | "info";
  /** The command handler */
  handler: (args: string, ctx: CommandContext) => Promise<CommandResult> | CommandResult;
}
