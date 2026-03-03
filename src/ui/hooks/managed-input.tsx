/**
 * ManagedInput - Self-contained input component
 *
 * Manages its own input state and useInput handler so that keystrokes
 * only re-render this component, NOT the parent conversation tree.
 * This is the primary fix for the flickering bug — isolating fast-changing
 * input state from the expensive message rendering tree.
 */

import React, { useState, memo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { InputPrompt } from "../input-prompt";
import { colors } from "../theme";

interface ManagedInputProps {
  /** Called when user presses Enter with non-empty input */
  onSubmit: (value: string) => void;
  /** Whether to show the input (false when loading) */
  visible: boolean;
  /** Is the app currently executing a request */
  isExecuting: boolean;
  /** Abort controller ref for cancelling operations */
  onCancel: () => void;
}

export const ManagedInput = memo(function ManagedInput({
  onSubmit,
  visible,
  isExecuting,
  onCancel,
}: ManagedInputProps): React.JSX.Element | null {
  const [input, setInput] = useState("");
  const { exit } = useApp();

  useInput((inputChar, key) => {
    // Handle Ctrl+C — cancel operation or exit
    if (key.ctrl && inputChar === "c") {
      if (isExecuting) {
        onCancel();
      } else if (!input.trim()) {
        exit();
      }
      return;
    }

    if (key.escape) {
      exit();
      return;
    }

    // Only process text input when visible (not loading)
    if (!visible) return;

    if (key.return && input.trim()) {
      onSubmit(input.trim());
      setInput("");
      return;
    }

    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (!key.ctrl && !key.meta && inputChar) {
      setInput(prev => prev + inputChar);
    }
  });

  if (!visible) return null;

  return <InputPrompt value={input} />;
});
