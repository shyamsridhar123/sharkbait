/**
 * Debugger Agent - Error diagnosis and fix implementation
 */

import { BaseAgent } from "./base-agent";
import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { PromptingMode } from "./types";
import { DEBUGGER_PROMPT, getModePrompt } from "./prompts";

/**
 * Debugger Agent - Specialized for bug diagnosis and fixing
 */
export class DebuggerAgent extends BaseAgent {
  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry, {
      name: "debugger",
      description: "Diagnoses bugs and implements fixes",
      color: "red",
      tools: [
        "read_file",
        "edit_file",
        "search_files",
        "grep_search",
        "run_command",
        "git_diff",
        "git_log",
      ],
      systemPrompt: DEBUGGER_PROMPT,
      modes: ["trace", "hypothesis", "fix"],
    });
  }

  /**
   * Get mode-specific prompt for debugger
   */
  protected getModePrompt(mode: PromptingMode): string | undefined {
    switch (mode) {
      case "trace":
        return `## Mode: Execution Trace
Focus on tracing the execution path to find the bug.

**Process:**
1. Start from the error location or symptom
2. Work backwards through the call stack
3. Identify the data flow
4. Find where expectations diverge from reality
5. Document the complete trace

**Output Format:**
\`\`\`
Trace: [Error Name]

1. Entry Point: [file:line]
   - Input: [values]
   - Expected: [behavior]

2. [file:line] → [file:line]
   - State: [variable values]
   
3. Bug Location: [file:line]
   - Actual: [what happened]
   - Expected: [what should happen]
   - Cause: [why it's wrong]
\`\`\``;

      case "hypothesis":
        return `## Mode: Hypothesis Testing
Focus on forming and testing theories about the bug.

**Scientific Debugging Method:**
1. Observe: Document the exact symptoms
2. Hypothesize: Form a theory about the cause
3. Predict: What would be true if hypothesis is correct?
4. Test: Search for evidence to confirm/refute
5. Iterate: Refine hypothesis based on findings

**Output Format:**
## Hypothesis Log

### Hypothesis 1: [Theory]
- **Prediction**: If this is true, then [X] should be [Y]
- **Test**: [How to verify]
- **Result**: Confirmed ✅ / Refuted ❌
- **Evidence**: [What was found]

### Conclusion
Based on testing, the most likely cause is [X].`;

      case "fix":
        return `## Mode: Implement Fix
Focus on implementing a minimal, targeted fix.

**Fix Guidelines:**
- Make the smallest change that fixes the issue
- Don't refactor unrelated code
- Add tests to prevent regression
- Document why the fix works

**Process:**
1. Confirm understanding of the root cause
2. Identify the minimal change needed
3. Consider side effects
4. Implement the fix
5. Verify the fix resolves the issue
6. Check for regressions

**Output Format:**
## Fix: [Bug Description]

### Root Cause
[Brief explanation]

### Solution
[What we're changing and why]

### Changes
- \`file:line\`: [Change description]

### Verification
[How to verify the fix works]

### Regression Risk
[Areas to test for side effects]`;

      default:
        return getModePrompt(mode);
    }
  }
}
