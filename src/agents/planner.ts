/**
 * Planner Agent - Architecture design and task breakdown
 */

import { BaseAgent } from "./base-agent";
import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { PromptingMode } from "./types";
import { PLANNER_PROMPT, getModePrompt } from "./prompts";

/**
 * Planner Agent - Specialized for planning and architecture
 */
export class PlannerAgent extends BaseAgent {
  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry, {
      name: "planner",
      description: "Creates implementation plans and architectural designs",
      color: "cyan",
      tools: [
        "read_file",
        "search_files",
        "grep_search",
        "list_directory",
        "beads_create",
        "beads_ready",
        "beads_show",
      ],
      systemPrompt: PLANNER_PROMPT,
      modes: ["architecture", "tasks", "estimate"],
    });
  }

  /**
   * Get mode-specific prompt for planner
   */
  protected getModePrompt(mode: PromptingMode): string | undefined {
    switch (mode) {
      case "architecture":
        return `## Mode: Architecture Design
Focus on high-level system architecture.

**Deliverables:**
1. Component diagram with responsibilities
2. Data flow between components
3. Interface definitions
4. Technology choices with rationale
5. Scalability considerations
6. Error handling strategy

**Process:**
1. Understand requirements and constraints
2. Review existing architecture
3. Identify integration points
4. Design component boundaries
5. Define interfaces and contracts
6. Consider failure modes

**Output Format:**
Use diagrams (ASCII or Mermaid syntax).
Document each component's responsibility.
Explain integration patterns.`;

      case "tasks":
        return `## Mode: Task Breakdown
Focus on creating actionable task lists.

**Requirements:**
- Each task should be completable in 2-4 hours
- Tasks should have clear acceptance criteria
- Dependencies should be explicit
- Tasks should be ordered by priority

**Process:**
1. Identify major work areas
2. Break each area into discrete tasks
3. Order tasks by dependency
4. Add acceptance criteria
5. Identify risks and blockers

**Output Format:**
\`\`\`
## Task: [Title]
- **ID**: [Unique ID]
- **Priority**: P0/P1/P2
- **Dependencies**: [List of task IDs]
- **Acceptance Criteria**:
  - [ ] Criterion 1
  - [ ] Criterion 2
- **Notes**: [Any additional context]
\`\`\``;

      case "estimate":
        return `## Mode: Estimation
Focus on providing realistic time and complexity estimates.

**Estimation Factors:**
- Complexity of the work
- Familiarity with the codebase
- Risk and uncertainty
- Testing requirements
- Code review overhead
- Deployment considerations

**Output Format:**
| Task | Best Case | Likely | Worst Case | Confidence |
|------|-----------|--------|------------|------------|
| X    | 2h        | 4h     | 8h         | Medium     |

**Include:**
- Overall estimate range
- Key risk factors
- Assumptions made
- Recommendations for reducing uncertainty`;

      default:
        return getModePrompt(mode);
    }
  }
}
