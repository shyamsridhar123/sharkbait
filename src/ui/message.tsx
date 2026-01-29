/**
 * Message View Component - Renders a chat message
 */

import React from "react";
import { Box, Text } from "ink";

interface MessageViewProps {
  role: "user" | "assistant" | "system";
  content: string;
}

export function MessageView({ role, content }: MessageViewProps): React.JSX.Element {
  const roleColors = {
    user: "cyan",
    assistant: "green",
    system: "yellow",
  } as const;

  const roleLabels = {
    user: "You",
    assistant: "Sharkbait",
    system: "System",
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={roleColors[role]}>
        {roleLabels[role]}:
      </Text>
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
}
