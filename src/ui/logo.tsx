/**
 * Logo Component - Displays the Sharkbait ASCII art logo
 */

import React from "react";
import { Box, Text } from "ink";
import * as fs from "fs";
import * as path from "path";
import { colors } from "./theme";

// Try to load the logo from file
function loadLogo(): string {
  try {
    const logoPath = path.join(process.cwd(), "public/images/ascii-art.txt");
    return fs.readFileSync(logoPath, "utf8");
  } catch {
    // Fallback text logo if file not found
    return TEXT_LOGO;
  }
}

// Simple text-based logo fallback
const TEXT_LOGO = `
   _____ _   _          _____  _  ______  _    _ _____
  / ____| | | |   /\   |  __ \| |/ /  _ \| |  | |_   _|
 | (___ | |_| |  /  \  | |__) | ' /| |_) | |  | | | |
  \___ \|  _  | / /\ \ |  _  /|  < |  _ <| |  | | | |
  ____) | | | |/ ____ \| | \ \| . \| |_) | |__| |_| |_
 |_____/|_| |_/_/    \_\_|  \_\_|\_\____/ \____/|_____|
`.trim();

interface LogoProps {
  variant?: "full" | "medium" | "compact" | "inline";
  showTagline?: boolean;
}

export function Logo({ variant = "full", showTagline = true }: LogoProps): React.JSX.Element {
  // Always try to load the actual ASCII art for full and medium
  const logoText = variant === "inline" ? "" : loadLogo();

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={colors.primary}>{logoText}</Text>
      {variant !== "inline" && (
        <Box marginTop={1}>
          <Text bold color={colors.primary}>SHARKBAIT</Text>
        </Box>
      )}
      {showTagline && variant !== "inline" && (
        <Text color={colors.textMuted}>AI Coding Assistant</Text>
      )}
    </Box>
  );
}

// Inline logo for headers
export function InlineLogo(): React.JSX.Element {
  return (
    <Text>
      <Text color={colors.primary}>🦈</Text>
      <Text bold color={colors.primary}> sharkbait</Text>
    </Text>
  );
}
