/**
 * Explorer Agent - Codebase navigation and understanding
 */

import { BaseAgent } from "./base-agent";
import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { PromptingMode } from "./types";
import { EXPLORER_PROMPT, getModePrompt } from "./prompts";

/**
 * Explorer Agent - Specialized for code exploration and explanation
 */
export class ExplorerAgent extends BaseAgent {
  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry, {
      name: "explorer",
      description: "Explores and explains codebase structure",
      color: "magenta",
      tools: [
        "read_file",
        "search_files",
        "grep_search",
        "list_directory",
      ],
      systemPrompt: EXPLORER_PROMPT,
      modes: ["map", "dependencies", "patterns"],
    });
  }

  /**
   * Get mode-specific prompt for explorer
   */
  protected getModePrompt(mode: PromptingMode): string | undefined {
    switch (mode) {
      case "map":
        return `## Mode: Architecture Map
Focus on mapping the overall architecture.

**Deliverables:**
1. High-level component overview
2. Directory structure explanation
3. Entry points and main flows
4. Key abstractions and their purposes
5. Configuration and setup

**Output Format:**
\`\`\`
# Architecture Map: [Project Name]

## Overview
[1-2 paragraph summary]

## Directory Structure
\`\`\`
src/
├── module1/    # [Purpose]
├── module2/    # [Purpose]
└── index.ts    # [Entry point]
\`\`\`

## Key Components
| Component | Location | Purpose |
|-----------|----------|---------|
| X         | src/x.ts | ...     |

## Main Flows
1. [Flow 1]: [Description]
2. [Flow 2]: [Description]

## Entry Points
- CLI: src/cli.ts
- API: src/server.ts
\`\`\``;

      case "dependencies":
        return `## Mode: Dependency Analysis
Focus on understanding code dependencies.

**Analyze:**
1. Import/export relationships
2. Circular dependencies
3. External package usage
4. Module coupling
5. Shared utilities

**Output Format:**
## Dependency Analysis: [File/Module]

### Direct Dependencies
| Dependency | Type | Purpose |
|------------|------|---------|
| ./utils    | Internal | Helper functions |
| lodash     | External | Data manipulation |

### Dependents (What uses this)
- \`file1.ts\`: Uses [function/class]
- \`file2.ts\`: Uses [function/class]

### Dependency Graph
\`\`\`
[ASCII diagram or Mermaid syntax]
\`\`\`

### Issues Found
- ⚠️ Circular dependency: A → B → A
- ⚠️ Heavy external dependency: [package]`;

      case "patterns":
        return `## Mode: Pattern Recognition
Focus on identifying design patterns and conventions.

**Look for:**
1. Creational patterns (Factory, Singleton, Builder)
2. Structural patterns (Adapter, Decorator, Facade)
3. Behavioral patterns (Observer, Strategy, Command)
4. Project-specific patterns
5. Anti-patterns and code smells

**Output Format:**
## Patterns Analysis: [Scope]

### Patterns Identified

#### [Pattern Name]
- **Type**: [Creational/Structural/Behavioral]
- **Location**: \`file:line\`
- **Purpose**: [Why it's used here]
- **Implementation Quality**: Good/Adequate/Needs Improvement

### Project Conventions
- Naming: [Convention observed]
- File organization: [Pattern]
- Error handling: [Approach]

### Anti-Patterns Found
- ⚠️ [Anti-pattern] at \`file:line\`: [Description]

### Recommendations
- Consider using [pattern] for [situation]`;

      default:
        return getModePrompt(mode);
    }
  }
}
