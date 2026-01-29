/**
 * Tool Definitions - JSON schemas for all tools (OpenAI format)
 */

import { fileTools } from "./file-ops";
import { shellTools } from "./shell";
import { beadsTools } from "./beads";
import { gitTools } from "./git";
import { githubTools } from "./github";

const allTools = [
  ...fileTools,
  ...shellTools,
  ...beadsTools,
  ...gitTools,
  ...githubTools,
];

export const TOOL_DEFINITIONS = allTools.map(tool => ({
  type: "function" as const,
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));

// Export categorized tool counts for documentation
export const TOOL_COUNTS = {
  fileOperations: fileTools.length,
  shell: shellTools.length,
  beads: beadsTools.length,
  git: gitTools.length,
  github: githubTools.length,
  total: allTools.length,
};
