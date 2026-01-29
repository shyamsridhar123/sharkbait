#!/usr/bin/env npx tsx

/**
 * UI Demo - Preview the Sharkbait UI components
 * Static version to avoid screen shaking from animation re-renders
 */

import React from "react";
import { render, Box, Text } from "ink";
import { Logo } from "./logo";
import { MessageView } from "./message";
import { StatusBar } from "./status-bar";
import { InputPrompt } from "./input-prompt";
import { colors, box, icons } from "./theme";

function Demo(): React.JSX.Element {
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color={colors.primary}>
          ═══════════════════ SHARKBAIT UI DEMO ═══════════════════
        </Text>
      </Box>

      {/* Logo - using your actual ASCII art */}
      <Box marginBottom={1}>
        <Text color={colors.textMuted}>Logo (from public/images/ascii-art.txt):</Text>
      </Box>
      <Logo variant="full" showTagline={false} />

      <Box justifyContent="center" marginY={1}>
        <Text color={colors.border}>{box.horizontal.repeat(60)}</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column">
        <Text color={colors.textMuted}>Message Components:</Text>
        <Box marginTop={1} flexDirection="column">
          <MessageView 
            role="user" 
            content="Can you help me refactor this function?" 
            timestamp={new Date()}
          />
          <MessageView 
            role="assistant" 
            content="I'll analyze the function and suggest improvements. Let me read the file first." 
            timestamp={new Date()}
          />
          <MessageView 
            role="system" 
            content="Context loaded: 3 files, 450 tokens" 
            timestamp={new Date()}
          />
        </Box>
      </Box>

      <Box justifyContent="center" marginY={1}>
        <Text color={colors.border}>{box.horizontal.repeat(60)}</Text>
      </Box>

      {/* Tool calls - static display */}
      <Box flexDirection="column">
        <Text color={colors.textMuted}>Tool Call Display:</Text>
        <Box marginLeft={3} marginTop={1} flexDirection="column">
          <Box borderStyle="round" borderColor={colors.success} paddingX={1}>
            <Text color={colors.success}>{icons.success} </Text>
            <Text bold>read_file</Text>
            <Text color={colors.textDim}> (0.2s)</Text>
          </Box>
          <Box borderStyle="round" borderColor={colors.error} paddingX={1} marginTop={1}>
            <Text color={colors.error}>{icons.error} </Text>
            <Text bold>write_file</Text>
            <Text color={colors.textDim}> - Permission denied</Text>
          </Box>
        </Box>
      </Box>

      <Box justifyContent="center" marginY={1}>
        <Text color={colors.border}>{box.horizontal.repeat(60)}</Text>
      </Box>

      {/* Input prompt */}
      <Box flexDirection="column">
        <Text color={colors.textMuted}>Input Prompt:</Text>
        <Box marginTop={1}>
          <InputPrompt value="refactor the auth module" />
        </Box>
      </Box>

      <Box justifyContent="center" marginY={1}>
        <Text color={colors.border}>{box.horizontal.repeat(60)}</Text>
      </Box>

      {/* Status bar */}
      <Box flexDirection="column">
        <Text color={colors.textMuted}>Status Bar:</Text>
        <Box marginTop={1}>
          <StatusBar mode="chat" model="gpt-4o" tokens={2500} cost={0.0234} />
        </Box>
      </Box>

      {/* Footer */}
      <Box marginTop={2} justifyContent="center">
        <Text color={colors.textDim}>
          Press Ctrl+C to exit
        </Text>
      </Box>
    </Box>
  );
}

render(<Demo />);
