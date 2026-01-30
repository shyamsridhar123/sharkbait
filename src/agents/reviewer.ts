/**
 * Reviewer Agent - Code review with multiple analysis modes
 */

import { BaseAgent } from "./base-agent";
import type { AzureOpenAIClient } from "../llm/azure-openai";
import type { ToolRegistry } from "../tools";
import type { PromptingMode } from "./types";
import { REVIEWER_PROMPT, getModePrompt } from "./prompts";

/**
 * Reviewer Agent - Specialized for code review and analysis
 */
export class ReviewerAgent extends BaseAgent {
  constructor(llm: AzureOpenAIClient, toolRegistry: ToolRegistry) {
    super(llm, toolRegistry, {
      name: "reviewer",
      description: "Reviews code for bugs, security, style, and performance",
      color: "yellow",
      tools: [
        "read_file",
        "search_files",
        "grep_search",
        "list_directory",
        "git_diff",
        "git_status",
        "git_log",
      ],
      systemPrompt: REVIEWER_PROMPT,
      modes: ["bugs", "security", "style", "performance"],
    });
  }

  /**
   * Get mode-specific prompt for reviewer
   */
  protected getModePrompt(mode: PromptingMode): string | undefined {
    switch (mode) {
      case "bugs":
        return `## Mode: Bug Detection
Focus exclusively on finding bugs and logic errors.

**Look for:**
- Null/undefined reference errors
- Off-by-one errors in loops
- Race conditions in async code
- Incorrect boolean logic
- Missing error handling
- Resource leaks (unclosed handles, connections)
- Edge cases not handled
- Type coercion issues
- Incorrect comparisons (== vs ===)

**Output Format:**
For each bug found:
- File and line number
- Bug description
- Severity (Critical/High/Medium/Low)
- Suggested fix
- Confidence score (0-100)`;

      case "security":
        return `## Mode: Security Audit
Focus exclusively on security vulnerabilities.

**Check for (OWASP Top 10):**
- SQL/NoSQL injection
- XSS (Cross-site scripting)
- CSRF vulnerabilities
- Broken authentication
- Sensitive data exposure
- Security misconfiguration
- Insecure deserialization
- Using components with known vulnerabilities
- Insufficient logging
- Path traversal
- Command injection
- Hardcoded secrets

**Output Format:**
For each vulnerability:
- File and line number
- Vulnerability type (CWE number if known)
- Impact description
- Recommended remediation
- CVSS-like severity score`;

      case "style":
        return `## Mode: Style Review
Focus exclusively on code style and conventions.

**Check for:**
- Naming conventions (camelCase, PascalCase, etc.)
- Consistent formatting
- Import organization
- Dead code
- Unused variables
- Overly complex expressions
- Magic numbers/strings
- Missing or incorrect comments
- Inconsistent patterns
- File organization

**Output Format:**
Group findings by category.
Suggest specific corrections.`;

      case "performance":
        return `## Mode: Performance Analysis
Focus exclusively on performance issues.

**Look for:**
- N+1 query patterns
- Unnecessary re-renders (React)
- Memory leaks
- Inefficient algorithms (O(n²) when O(n) possible)
- Blocking operations in async contexts
- Large bundle imports
- Missing memoization
- Excessive DOM manipulation
- Unnecessary object creation in loops
- Missing indexes (database)
- Redundant API calls

**Output Format:**
For each issue:
- Location and description
- Performance impact estimate
- Suggested optimization
- Trade-offs to consider`;

      default:
        return getModePrompt(mode);
    }
  }
}
