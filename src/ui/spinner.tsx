/**
 * Spinner Component - Simple loading indicator
 */

import React, { useState, useEffect } from "react";
import { Text, Box } from "ink";
import { colors, SPINNER_FRAMES, DOTS_FRAMES } from "./theme";

interface SpinnerProps {
  text?: string;
  variant?: "braille" | "dots";
  showTokens?: boolean;
  tokens?: number;
}

export function Spinner({ 
  text = "Thinking...", 
  variant = "braille",
  showTokens = false,
  tokens = 0,
}: SpinnerProps): React.JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);
  
  const frames = variant === "dots" ? DOTS_FRAMES : SPINNER_FRAMES;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
    }, 100);  // Slower animation to reduce flicker

    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <Box>
      <Text color={colors.primary}>{frames[frameIndex]} </Text>
      <Text color={colors.text}>{text}</Text>
      {showTokens && tokens > 0 && (
        <Text color={colors.textDim}> ({tokens.toLocaleString()} tokens)</Text>
      )}
    </Box>
  );
}
