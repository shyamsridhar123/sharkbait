# Claude Code-Inspired Architecture Implementation

This document describes the architectural improvements made to Sharkbait inspired by the [Claude Code source code transpilation](https://github.com/ghuntley/claude-code-source-code-transpilation) project.

## Overview

The goal was to make Sharkbait's architecture "like Claude Code" by adopting its modular, well-structured approach to building a CLI-based AI coding assistant.

## Key Improvements Implemented

### 1. Modular Initialization System (`src/index.ts`)

**Inspired by:** `claude-code/src/index.ts`

Created a centralized application initialization module that:
- Manages the lifecycle of all subsystems
- Provides an `AppInstance` interface that holds references to all initialized components
- Implements graceful shutdown procedures
- Sets up process signal handlers (SIGINT, SIGTERM)
- Handles unhandled rejections and uncaught exceptions

**Benefits:**
- Clear separation of concerns
- Easy to test individual subsystems
- Proper resource cleanup on shutdown
- Better error handling at the application level

### 2. Command Registry System (`src/commands/registry.ts`)

**Inspired by:** Claude Code's command management system

Implemented a centralized command registry that provides:
- **Command Registration:** Dynamic command registration with metadata
- **Command Categories:** Group commands for better help organization
- **Command Discovery:** List, search, and retrieve commands programmatically
- **Help Generation:** Automatic help text generation for individual commands and general help
- **Command Execution:** Centralized command execution with error handling

**Command Definition Interface:**
```typescript
interface CommandDefinition {
  name: string;              // Command name (e.g., "chat", "ask")
  description: string;       // Short description
  usage?: string;           // Usage pattern
  category?: string;        // Category for grouping
  requiresAuth?: boolean;   // Whether auth is needed
  hidden?: boolean;         // Hide from help
  options?: CommandOption[]; // Command options/flags
  examples?: string[];      // Usage examples
  handler: CommandHandler;  // Command implementation
}
```

**Benefits:**
- Centralized command management
- Consistent help system
- Easy to add new commands
- Better command discovery for users

### 3. Enhanced CLI Entry Point (`src/cli-new.ts`)

**Inspired by:** `claude-code/src/cli.ts`

Created a new enhanced CLI that:
- Uses the AppInstance pattern for dependency management
- Integrates with the command registry
- Provides comprehensive help with command categories
- Handles errors gracefully with proper exit codes
- Sets up signal handlers for clean shutdown

**Features:**
- `sharkbait help` - General help with categorized commands
- `sharkbait help <command>` - Detailed help for specific commands
- `sharkbait version` - Version information
- Automatic default to `chat` command when no arguments provided
- Proper error classification (UserError vs unexpected errors)

### 4. Command Registration Module (`src/commands/register.ts`)

Centralized registration of all commands with the registry, including:
- Core commands: `chat`, `ask`, `run`
- Code quality commands: `review`
- Setup commands: `init`
- Built-in commands: `help`, `version`

Each command includes:
- Description and usage information
- Available options and flags
- Example usage
- Command handler implementation

### 5. Enhanced Error Handling

**Inspired by:** Claude Code's error classification system

Added `UserError` class for expected errors caused by user input:
```typescript
export class UserError extends SharkbaitError {
  constructor(message: string, details?: string)
}
```

**Benefits:**
- Better error messages for users
- Proper exit codes (1 for user errors, 2 for unexpected errors)
- Clearer distinction between expected and unexpected failures

### 6. AppInstance Pattern

**Inspired by:** Claude Code's subsystem management

The `AppInstance` interface provides a clean way to manage all application components:
```typescript
interface AppInstance {
  config: Config;
  llm: AzureOpenAIClient;
  tools: ToolRegistry;
  hooks: HookRegistry;
  telemetry: TelemetryClient | null;
}
```

**Benefits:**
- All subsystems initialized in one place
- Easy to pass dependencies to commands
- Clear ownership of resources
- Simplified testing and mocking

## Architecture Comparison

### Before (Original Sharkbait)
```
cli.ts (monolithic)
├── Direct command imports
├── Direct command handlers
└── Basic error handling
```

### After (Claude Code-Inspired)
```
index.ts (application lifecycle)
├── Initialize subsystems
├── Setup handlers
└── Graceful shutdown

cli-new.ts (entry point)
├── Parse arguments
├── Display help/version
├── Execute command via registry
└── Handle errors

commands/
├── registry.ts (command management)
├── register.ts (command registration)
├── ask.ts, run.ts, review.ts, etc. (handlers)
└── ...
```

## Migration Path

The new architecture is designed to be backwards compatible. The original `cli.ts` remains functional, while the new `cli-new.ts` provides the enhanced experience.

**To adopt the new CLI:**
1. Update `package.json` bin entry to point to `cli-new.ts`
2. Rebuild the binary
3. Test existing commands work as expected

**Rollback:**
Simply revert the bin entry back to `cli.ts`

## Key Differences from Claude Code

While inspired by Claude Code's architecture, some differences remain:

| Feature | Claude Code | Sharkbait |
|---------|-------------|-----------|
| **Authentication** | OAuth with Anthropic Console | Azure OpenAI API keys (env vars) |
| **AI Provider** | Anthropic Claude API | Azure OpenAI |
| **Memory System** | Built-in (unknown implementation) | Beads (external CLI tool) |
| **Runtime** | Node.js | Bun |
| **Terminal UI** | Custom (from deobfuscation) | Ink (React for terminals) |
| **Tool System** | 10-15 tools (estimated) | 33+ tools across 6 categories |

## Benefits of This Architecture

1. **Modularity:** Each subsystem is independently initialized and manageable
2. **Testability:** Easy to mock and test individual components
3. **Maintainability:** Clear structure makes it easy to add new features
4. **Error Handling:** Comprehensive error classification and handling
5. **User Experience:** Better help system, clearer error messages
6. **Robustness:** Graceful shutdown, proper resource cleanup
7. **Extensibility:** Easy to add new commands, tools, or subsystems

## Future Enhancements

Following Claude Code's patterns, potential future improvements include:

1. **Authentication Manager:** Implement OAuth-style authentication management
2. **Plugin System:** Allow users to add custom commands and tools
3. **Configuration UI:** Interactive configuration wizard
4. **Telemetry Improvements:** More comprehensive opt-in telemetry
5. **Background Services:** Long-running background analysis tasks
6. **Multi-Project Support:** Workspace-level configuration and management

## References

- [Claude Code Source Code Transpilation](https://github.com/ghuntley/claude-code-source-code-transpilation)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/agents/claude-code/introduction)
- [Sharkbait Documentation](../docs/)

## Conclusion

By adopting architectural patterns from Claude Code, Sharkbait now has a more robust, maintainable, and extensible foundation. The modular design makes it easier to understand, test, and enhance the codebase while providing users with a better command-line experience.
