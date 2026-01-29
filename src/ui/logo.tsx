/**
 * Logo Component - Displays the Sharkbait ASCII art logo
 */

import React from "react";
import { Box, Text } from "ink";
import * as fs from "fs";
import * as path from "path";
import { colors } from "./theme";

// Try to load the logo from file, fallback to inline version
function loadLogo(): string {
  try {
    const logoPath = path.join(process.cwd(), "public/images/ascii-art.txt");
    return fs.readFileSync(logoPath, "utf8");
  } catch {
    // Fallback compact logo if file not found
    return COMPACT_LOGO;
  }
}

// Compact version for when full logo is too big
const COMPACT_LOGO = `
      ⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⣿
    ⠀⠀⠀⠀⠀⣠⣴⣾⣿⣿⣿⣿⣿⣿
    ⠀⠀⣠⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
    ⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿
    ⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠋
    ⠹⣿⣿⣿⣿⣿⣿⣿⣿⠿⠋⠁
    ⠀⠈⠻⣿⣿⡿⠟⠋
`.trim();

interface LogoProps {
  variant?: "full" | "compact" | "inline";
  showTagline?: boolean;
}

export function Logo({ variant = "compact", showTagline = true }: LogoProps): React.JSX.Element {
  const logoText = variant === "full" ? loadLogo() : COMPACT_LOGO;

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
