/**
 * Spinner Component - Claude Code inspired loading indicator with shimmer
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

// Shimmer effect colors for the text
const SHIMMER_COLORS = [
  colors.textDim,
  colors.textMuted, 
  colors.text,
  colors.primary,
  colors.text,
  colors.textMuted,
  colors.textDim,
];

export function Spinner({ 
  text = "Thinking...", 
  variant = "braille",
  showTokens = false,
  tokens = 0,
}: SpinnerProps): React.JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);
  const [shimmerIndex, setShimmerIndex] = useState(0);
  
  const frames = variant === "dots" ? DOTS_FRAMES : SPINNER_FRAMES;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % frames.length);
      setShimmerIndex(prev => (prev + 1) % SHIMMER_COLORS.length);
    }, 80);

    return () => clearInterval(timer);
  }, [frames.length]);

  // Create shimmer effect on text
  const shimmerText = text.split("").map((char, i) => {
    const colorIndex = (shimmerIndex + i) % SHIMMER_COLORS.length;
    return (
      <Text key={i} color={SHIMMER_COLORS[colorIndex]}>
        {char}
      </Text>
    );
  });

  return (
    <Box>
      <Text color={colors.primary}>{frames[frameIndex]} </Text>
      <Text>{shimmerText}</Text>
      {showTokens && tokens > 0 && (
        <Text color={colors.textDim}> ({tokens.toLocaleString()} tokens)</Text>
      )}
    </Box>
  );
}
