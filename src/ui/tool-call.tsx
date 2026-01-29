/**
 * Tool Call View Component - Claude Code inspired tool execution display
 */

import React from "react";
import { Box, Text } from "ink";
import { Spinner } from "./spinner";
import { colors, icons, box } from "./theme";

interface ToolCallViewProps {
  name: string;
  status: "running" | "success" | "error";
  result?: string;
  error?: string;
  duration?: number;
}

export function ToolCallView({ 
  name, 
  status, 
  result, 
  error,
  duration 
}: ToolCallViewProps): React.JSX.Element {
  const statusConfig = {
    running: { icon: icons.tool, color: colors.primary },
    success: { icon: icons.success, color: colors.success },
    error: { icon: icons.error, color: colors.error },
  };

  const config = statusConfig[status];
  const durationText = duration ? `${(duration / 1000).toFixed(1)}s` : null;

  return (
    <Box 
      flexDirection="column" 
      marginLeft={3} 
      marginY={0}
      borderStyle="round"
      borderColor={colors.border}
      paddingX={1}
    >
      {/* Tool header */}
      <Box>
        {status === "running" ? (
          <Spinner text={name} variant="dots" />
        ) : (
          <>
            <Text color={config.color}>{config.icon} </Text>
            <Text bold color={colors.text}>{name}</Text>
            {durationText && (
              <Text color={colors.textDim}> ({durationText})</Text>
            )}
          </>
        )}
      </Box>
      
      {/* Success result */}
      {result && status === "success" && (
        <Box marginLeft={2} marginTop={0}>
          <Text color={colors.textMuted} wrap="truncate-end">
            {box.vertical} {result.length > 80 ? result.substring(0, 80) + "..." : result}
          </Text>
        </Box>
      )}
      
      {/* Error message */}
      {error && status === "error" && (
        <Box marginLeft={2} marginTop={0}>
          <Text color={colors.error}>
            {box.vertical} {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
