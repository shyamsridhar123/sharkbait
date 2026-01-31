/**
 * Message View Component - Claude Code inspired message rendering
 * Now with syntax highlighting for code blocks
 */

import React from "react";
import { Box, Text } from "ink";
import { colors, icons } from "./theme";
import { HighlightedContent, parseCodeBlocks } from "./syntax-highlight";

interface MessageViewProps {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  enableHighlighting?: boolean;
}

export function MessageView({ 
  role, 
  content, 
  timestamp,
  enableHighlighting = true,
}: MessageViewProps): React.JSX.Element {
  const roleConfig = {
    user: {
      color: colors.user,
      label: "You",
      icon: "❯",
    },
    assistant: {
      color: colors.assistant,
      label: "Sharkbait",
      icon: icons.shark,
    },
    system: {
      color: colors.system,
      label: "System",
      icon: icons.info,
    },
  };

  const config = roleConfig[role];
  const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { 
    hour: "2-digit", 
    minute: "2-digit" 
  }) : null;

  // Check if content has code blocks
  const hasCodeBlocks = content.includes("```");

  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Header row */}
      <Box>
        <Text color={config.color}>{config.icon} </Text>
        <Text bold color={config.color}>{config.label}</Text>
        {time && (
          <Text color={colors.textDim}> • {time}</Text>
        )}
      </Box>
      
      {/* Message content - use highlighting for assistant messages with code */}
      <Box marginLeft={3} marginTop={0}>
        {enableHighlighting && hasCodeBlocks && role === "assistant" ? (
          <HighlightedContent content={content} />
        ) : (
          <Text wrap="wrap" color={role === "system" ? colors.textMuted : colors.text}>
            {content}
          </Text>
        )}
      </Box>
    </Box>
  );
}
