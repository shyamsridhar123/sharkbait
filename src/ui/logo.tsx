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
  const possiblePaths = [
    // From sharkbait project directory (when running via bun from source)
    path.join(__dirname, "../../public/images/ascii-art.txt"),
    path.join(__dirname, "../public/images/ascii-art.txt"),
    // Hardcoded sharkbait install location
    "C:/Users/shyamsridhar/code/sharkbait/sharkbait/public/images/ascii-art.txt",
    // From current working directory (legacy)
    path.join(process.cwd(), "public/images/ascii-art.txt"),
  ];
  
  for (const logoPath of possiblePaths) {
    try {
      if (fs.existsSync(logoPath)) {
        return fs.readFileSync(logoPath, "utf8");
      }
    } catch {
      // Try next path
    }
  }
  
  // Fallback text logo if file not found
  return TEXT_LOGO;
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
  version?: string;
}

export function Logo({ variant = "full", version = "0.1.0" }: LogoProps): React.JSX.Element {
  // Always try to load the actual ASCII art for full and medium
  const logoText = variant === "inline" ? "" : loadLogo();

  return (
    <Box flexDirection="column" alignItems="center">
      <Text color={colors.primary}>{logoText}</Text>
      {variant !== "inline" && (
        <Box marginTop={0}>
          <Text bold color={colors.primary}>SHARKBAIT</Text>
          <Text color={colors.textMuted}> v{version}</Text>
        </Box>
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
