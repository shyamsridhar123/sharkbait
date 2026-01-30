/**
 * Parallel Progress View Component - Visualize parallel agent execution
 */

import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./spinner";
import { colors, icons } from "./theme";

interface AgentProgress {
  name: string;
  mode?: string;
  status: "pending" | "running" | "complete" | "error";
  progress?: number; // 0-100
  duration?: number; // ms
  error?: string;
}

interface ParallelProgressViewProps {
  title?: string;
  agents: AgentProgress[];
  strategy: "all" | "race" | "quorum";
  quorumSize?: number;
}

/**
 * Render a progress bar
 */
function ProgressBar({ 
  progress = 0, 
  width = 20 
}: { progress: number; width?: number }): React.JSX.Element {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  
  return (
    <Text>
      <Text color={colors.primary}>{"█".repeat(filled)}</Text>
      <Text color={colors.border}>{"░".repeat(empty)}</Text>
      <Text color={colors.textMuted}> {progress}%</Text>
    </Text>
  );
}

/**
 * Get status icon and color
 */
function getStatusDisplay(status: AgentProgress["status"]): { icon: string; color: string } {
  switch (status) {
    case "pending":
      return { icon: "○", color: colors.textMuted };
    case "running":
      return { icon: "◐", color: colors.primary };
    case "complete":
      return { icon: icons.success, color: colors.success };
    case "error":
      return { icon: icons.error, color: colors.error };
  }
}

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ParallelProgressView({
  title = "Parallel Execution",
  agents,
  strategy,
  quorumSize,
}: ParallelProgressViewProps): React.JSX.Element {
  const completedCount = agents.filter(a => a.status === "complete").length;
  const errorCount = agents.filter(a => a.status === "error").length;
  const runningCount = agents.filter(a => a.status === "running").length;
  
  // Strategy description
  const strategyText = strategy === "all" 
    ? "Waiting for all agents"
    : strategy === "race"
      ? "First to complete wins"
      : `Quorum: ${quorumSize || Math.ceil(agents.length / 2)} required`;
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={colors.border}
      marginY={1}
    >
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color={colors.primary}>{title}</Text>
        <Text color={colors.textMuted}>
          Strategy: {strategy} | {completedCount}/{agents.length} complete
        </Text>
      </Box>
      
      {/* Strategy info */}
      <Box paddingX={1}>
        <Text color={colors.textDim}>{strategyText}</Text>
      </Box>
      
      {/* Agent progress rows */}
      <Box flexDirection="column" paddingX={1} marginTop={1}>
        {agents.map((agent, idx) => {
          const { icon, color } = getStatusDisplay(agent.status);
          
          return (
            <Box key={idx} marginBottom={0}>
              {/* Status icon */}
              <Box width={3}>
                {agent.status === "running" ? (
                  <Text color={color}>◐</Text>
                ) : (
                  <Text color={color}>{icon}</Text>
                )}
              </Box>
              
              {/* Agent name */}
              <Box width={15}>
                <Text color={colors.text}>
                  {agent.name}
                  {agent.mode && (
                    <Text color={colors.textMuted}> ({agent.mode})</Text>
                  )}
                </Text>
              </Box>
              
              {/* Progress/Status */}
              <Box flexGrow={1}>
                {agent.status === "running" && agent.progress !== undefined ? (
                  <ProgressBar progress={agent.progress} />
                ) : agent.status === "complete" ? (
                  <Text color={colors.success}>
                    Complete {agent.duration && `(${formatDuration(agent.duration)})`}
                  </Text>
                ) : agent.status === "error" ? (
                  <Text color={colors.error}>
                    {agent.error || "Failed"}
                  </Text>
                ) : (
                  <Text color={colors.textMuted}>Pending</Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
      
      {/* Summary */}
      {runningCount === 0 && (completedCount > 0 || errorCount > 0) && (
        <Box paddingX={1} marginTop={1}>
          <Text color={completedCount > 0 ? colors.success : colors.error}>
            {icons.success} {completedCount} complete, {icons.error} {errorCount} errors
          </Text>
        </Box>
      )}
    </Box>
  );
}
