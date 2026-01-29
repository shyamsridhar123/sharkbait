/**
 * Tool Call View Component - Displays tool execution status
 */

import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./spinner";

interface ToolCallViewProps {
  name: string;
  status: "running" | "success" | "error";
  result?: string;
  error?: string;
}

export function ToolCallView({ name, status, result, error }: ToolCallViewProps): React.JSX.Element {
  const statusIcon = {
    running: null,
    success: "✓",
    error: "✗",
  };

  const statusColor = {
    running: "cyan",
    success: "green",
    error: "red",
  } as const;

  return (
    <Box flexDirection="column" marginLeft={2} marginY={1}>
      <Box>
        {status === "running" ? (
          <Spinner text={name} />
        ) : (
          <>
            <Text color={statusColor[status]}>{statusIcon[status]} </Text>
            <Text bold>{name}</Text>
          </>
        )}
      </Box>
      
      {result && status === "success" && (
        <Box marginLeft={2}>
          <Text color="gray" wrap="truncate-end">
            {result.length > 100 ? result.substring(0, 100) + "..." : result}
          </Text>
        </Box>
      )}
      
      {error && status === "error" && (
        <Box marginLeft={2}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
