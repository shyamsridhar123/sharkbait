/**
 * Input Prompt Component - User input with Claude Code styling
 */

import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme";

interface InputPromptProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
}

export function InputPrompt({ 
  value, 
  placeholder = "Send a message...",
  disabled = false 
}: InputPromptProps): React.JSX.Element {
  return (
    <Box 
      borderStyle="round" 
      borderColor={disabled ? colors.border : colors.primary}
      paddingX={1}
    >
      <Text color={colors.primary}>❯ </Text>
      {value ? (
        <Text>{value}</Text>
      ) : (
        <Text color={colors.textDim}>{placeholder}</Text>
      )}
      {!disabled && <Text color={colors.primary}>▋</Text>}
    </Box>
  );
}
