/**
 * Spinner Component - Loading indicator
 */

import React, { useState, useEffect } from "react";
import { Text } from "ink";

interface SpinnerProps {
  text?: string;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ text = "Loading..." }: SpinnerProps): React.JSX.Element {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);

    return () => clearInterval(timer);
  }, []);

  return (
    <Text>
      <Text color="cyan">{SPINNER_FRAMES[frameIndex]}</Text>
      <Text> {text}</Text>
    </Text>
  );
}
