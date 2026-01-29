/**
 * Status Bar Component - Shows current session status
 */

import React from "react";
import { Box, Text } from "ink";
import { colors, icons } from "./theme";

interface StatusBarProps {
  model?: string;
  tokens?: number;
  cost?: number;
  mode?: "chat" | "agent" | "plan";
}

export function StatusBar({ 
  model, 
  tokens = 0, 
  cost = 0,
  mode = "chat" 
}: StatusBarProps): React.JSX.Element {
  // Get model from config if not provided
  const displayModel = model || process.env["AZURE_OPENAI_CODEX_DEPLOYMENT"] || process.env["AZURE_OPENAI_DEPLOYMENT"] || "unknown";
  const modeColors = {
    chat: colors.success,
    agent: colors.primary,
    plan: colors.warning,
  };

  const modeLabels = {
    chat: "Chat",
    agent: "Agent",
    plan: "Plan",
  };

  return (
    <Box 
      borderStyle="round" 
      borderColor={colors.border}
      paddingX={1}
      justifyContent="space-between"
    >
      {/* Left side - Mode */}
      <Box>
        <Text color={modeColors[mode]}>
          {icons.shark} {modeLabels[mode]}
        </Text>
      </Box>

      {/* Center - Model */}
      <Box>
        <Text color={colors.textMuted}>
          ChatModel: <Text color={colors.text}>{displayModel}</Text>
        </Text>
      </Box>

      {/* Right side - Tokens & Cost */}
      <Box marginLeft={2}>
        <Text color={colors.textMuted}>
          <Text color={colors.text}>{tokens.toLocaleString()}</Text> tokens
          {cost > 0 && (
            <Text> | ${cost.toFixed(4)}</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
}
