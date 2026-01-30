/**
 * Coder Agent - Code writing, editing, and refactoring
 */

import { BaseAgent } from "./base-agent";
import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { PromptingMode } from "./types";
import { CODER_PROMPT, getModePrompt } from "./prompts";

/**
 * Coder Agent - Specialized for code generation and modification
 */
export class CoderAgent extends BaseAgent {
  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry, {
      name: "coder",
      description: "Writes, edits, and refactors code",
      color: "green",
      tools: [
        "read_file",
        "write_file",
        "edit_file",
        "list_directory",
        "search_files",
        "grep_search",
        "run_command",
      ],
      systemPrompt: CODER_PROMPT,
      modes: ["write", "refactor", "test", "docs"],
    });
  }

  /**
   * Get mode-specific prompt for coder
   */
  protected getModePrompt(mode: PromptingMode): string | undefined {
    switch (mode) {
      case "write":
        return `## Mode: Write New Code
Focus on creating clean, well-structured new code.
- Follow existing patterns in the codebase
- Write comprehensive error handling
- Add appropriate comments and documentation
- Consider testability from the start`;

      case "refactor":
        return `## Mode: Refactor
Focus on improving existing code without changing behavior.
- Identify code smells and technical debt
- Apply design patterns where appropriate
- Improve naming and readability
- Extract common functionality
- Ensure all tests still pass after changes`;

      case "test":
        return `## Mode: Write Tests
Focus on creating comprehensive test coverage.
- Write unit tests for individual functions
- Create integration tests for workflows
- Test edge cases and error conditions
- Use meaningful test descriptions
- Mock external dependencies appropriately`;

      case "docs":
        return `## Mode: Documentation
Focus on improving code documentation.
- Add JSDoc/TSDoc comments to functions
- Document complex algorithms
- Add inline comments for non-obvious logic
- Create or update README files
- Document API endpoints and interfaces`;

      default:
        return getModePrompt(mode);
    }
  }
}
