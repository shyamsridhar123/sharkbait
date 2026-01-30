/**
 * Welcome Screen - Claude Code inspired startup screen
 */

import React from "react";
import { Box, Text } from "ink";
import { Logo } from "./logo";
import { colors, box } from "./theme";

interface WelcomeProps {
  version: string;
  workingDir: string;
}

export function WelcomeScreen({ version, workingDir }: WelcomeProps): React.JSX.Element {
  const tips = [
    "Type your request and press Enter to send",
    "Use /help for available commands",
    "Press Ctrl+C or ESC to exit",
  ];

  return (
    <Box flexDirection="column" padding={0}>
      {/* Logo */}
      <Box justifyContent="center" marginBottom={0}>
        <Logo variant="full" version={version} />
      </Box>

      {/* Directory Info */}
      <Box flexDirection="column" alignItems="center" marginBottom={0}>
        <Text color={colors.textDim}>
          Working in: <Text color={colors.textMuted}>{workingDir}</Text>
        </Text>
      </Box>

      {/* Divider */}
      <Box justifyContent="center" marginY={0}>
        <Text color={colors.border}>
          {box.horizontal.repeat(70)}
        </Text>
      </Box>

      {/* Tips */}
      <Box flexDirection="column" alignItems="center">
        {tips.map((tip, i) => (
          <Text key={i} color={colors.textDim}>
            <Text color={colors.primary}>•</Text> {tip}
          </Text>
        ))}
      </Box>

      {/* Divider */}
      <Box justifyContent="center" marginY={0}>
        <Text color={colors.border}>
          {box.horizontal.repeat(70)}
        </Text>
      </Box>
    </Box>
  );
}
