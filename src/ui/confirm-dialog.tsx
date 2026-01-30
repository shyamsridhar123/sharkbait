/**
 * Confirm Dialog Component - Prompt user for confirmation on destructive actions
 */

import React from "react";
import { Box, Text } from "ink";
import { colors, icons } from "./theme";

interface ConfirmDialogProps {
  message: string;
  details?: string;
  showDiff?: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ConfirmDialog({
  message,
  details,
  showDiff,
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={colors.warning}
      paddingX={1}
      marginY={1}
    >
      {/* Warning header */}
      <Box>
        <Text color={colors.warning}>{icons.warning} </Text>
        <Text bold color={colors.warning}>Confirmation Required</Text>
      </Box>
      
      {/* Message */}
      <Box marginTop={1}>
        <Text color={colors.text}>{message}</Text>
      </Box>
      
      {/* Details */}
      {details && (
        <Box marginTop={1} marginLeft={2}>
          <Text color={colors.textMuted}>{details}</Text>
        </Box>
      )}
      
      {/* Diff preview if provided */}
      {showDiff && (
        <Box marginTop={1}>
          {showDiff}
        </Box>
      )}
      
      {/* Prompt */}
      <Box marginTop={1}>
        <Text color={colors.primary}>
          Type <Text bold>y</Text> or <Text bold>yes</Text> to confirm, 
          anything else to cancel:
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Check if a response is affirmative
 */
export function isConfirmation(response: string): boolean {
  const normalized = response.toLowerCase().trim();
  return normalized === "y" || normalized === "yes";
}
