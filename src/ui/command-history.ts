/**
 * Command History and Autocomplete - Track and suggest commands
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const HISTORY_FILE = join(homedir(), ".sharkbait", "history.json");
const MAX_HISTORY = 500;

export interface HistoryEntry {
  command: string;
  timestamp: number;
  success?: boolean;
}

/**
 * Command history manager
 */
export class CommandHistory {
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private searchBuffer: string = "";
  
  constructor() {
    this.load();
  }
  
  /**
   * Load history from disk
   */
  private load(): void {
    try {
      if (existsSync(HISTORY_FILE)) {
        const data = readFileSync(HISTORY_FILE, "utf-8");
        this.history = JSON.parse(data);
      }
    } catch {
      this.history = [];
    }
  }
  
  /**
   * Save history to disk
   */
  private save(): void {
    try {
      const dir = join(homedir(), ".sharkbait");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(HISTORY_FILE, JSON.stringify(this.history.slice(-MAX_HISTORY)));
    } catch {
      // Ignore save errors
    }
  }
  
  /**
   * Add a command to history
   */
  add(command: string, success = true): void {
    const trimmed = command.trim();
    if (!trimmed) return;
    
    // Don't add duplicates of the last command
    const lastEntry = this.history[this.history.length - 1];
    if (lastEntry && lastEntry.command === trimmed) {
      return;
    }
    
    this.history.push({
      command: trimmed,
      timestamp: Date.now(),
      success,
    });
    
    this.currentIndex = -1;
    this.save();
  }
  
  /**
   * Navigate up in history (older)
   */
  up(currentInput: string): string | null {
    if (this.history.length === 0) return null;
    
    // Initialize search if starting fresh
    if (this.currentIndex === -1) {
      this.searchBuffer = currentInput;
    }
    
    // Find next matching entry
    let startIndex = this.currentIndex === -1 
      ? this.history.length - 1 
      : this.currentIndex - 1;
    
    for (let i = startIndex; i >= 0; i--) {
      const entry = this.history[i];
      if (!entry) continue;
      if (!this.searchBuffer || entry.command.startsWith(this.searchBuffer)) {
        this.currentIndex = i;
        return entry.command;
      }
    }
    
    return null;
  }
  
  /**
   * Navigate down in history (newer)
   */
  down(currentInput: string): string | null {
    if (this.currentIndex === -1) return null;
    
    for (let i = this.currentIndex + 1; i < this.history.length; i++) {
      const entry = this.history[i];
      if (!entry) continue;
      if (!this.searchBuffer || entry.command.startsWith(this.searchBuffer)) {
        this.currentIndex = i;
        return entry.command;
      }
    }
    
    // Reached the end, return to current input
    this.currentIndex = -1;
    return this.searchBuffer;
  }
  
  /**
   * Reset navigation
   */
  reset(): void {
    this.currentIndex = -1;
    this.searchBuffer = "";
  }
  
  /**
   * Get all history entries
   */
  getAll(): HistoryEntry[] {
    return [...this.history];
  }
  
  /**
   * Get recent commands
   */
  getRecent(count = 10): string[] {
    return this.history
      .slice(-count)
      .reverse()
      .map(e => e.command);
  }
  
  /**
   * Search history
   */
  search(query: string): HistoryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(e => 
      e.command.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Clear all history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.save();
  }
}

/**
 * Slash command autocomplete
 */
export interface CompletionItem {
  value: string;
  description?: string;
  type: "command" | "file" | "history" | "suggestion";
}

export class Autocomplete {
  private commands: Map<string, string> = new Map();
  
  /**
   * Register a command for autocomplete
   */
  registerCommand(name: string, description: string): void {
    this.commands.set(name, description);
  }
  
  /**
   * Register multiple commands
   */
  registerCommands(commands: Array<{ name: string; description: string }>): void {
    for (const cmd of commands) {
      this.registerCommand(cmd.name, cmd.description);
    }
  }
  
  /**
   * Get completions for input
   */
  complete(input: string): CompletionItem[] {
    const trimmed = input.trim();
    
    if (!trimmed) {
      // Show popular commands
      return Array.from(this.commands.entries())
        .slice(0, 5)
        .map(([name, desc]) => ({
          value: `/${name}`,
          description: desc,
          type: "command" as const,
        }));
    }
    
    if (trimmed.startsWith("/")) {
      // Complete slash commands
      const prefix = trimmed.slice(1).toLowerCase();
      return Array.from(this.commands.entries())
        .filter(([name]) => name.toLowerCase().startsWith(prefix))
        .map(([name, desc]) => ({
          value: `/${name}`,
          description: desc,
          type: "command" as const,
        }));
    }
    
    return [];
  }
  
  /**
   * Get the best completion for tab completion
   */
  getBestCompletion(input: string): string | null {
    const completions = this.complete(input);
    if (completions.length === 1) {
      return completions[0]?.value ?? null;
    }
    return null;
  }
}

// Global instances
export const globalHistory = new CommandHistory();
export const globalAutocomplete = new Autocomplete();

export default CommandHistory;
