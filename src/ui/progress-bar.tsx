/**
 * Progress Bar Components - Visual progress indicators for long operations
 */

import React from "react";
import { Box, Text } from "ink";
import { colors } from "./theme";

interface ProgressBarProps {
  progress: number;      // 0-100
  width?: number;        // Character width
  showPercentage?: boolean;
  label?: string;
  color?: string;
  showETA?: boolean;
  startTime?: number;
}

interface MultiProgressBarProps {
  items: Array<{
    label: string;
    progress: number;
    status?: "pending" | "active" | "complete" | "error";
  }>;
  width?: number;
}

interface IndeterminateProgressProps {
  width?: number;
  label?: string;
  color?: string;
}

/**
 * Calculate ETA based on progress and elapsed time
 */
function calculateETA(progress: number, startTime: number): string {
  if (progress <= 0) return "calculating...";
  
  const elapsed = Date.now() - startTime;
  const totalEstimated = (elapsed / progress) * 100;
  const remaining = totalEstimated - elapsed;
  
  if (remaining < 1000) return "< 1s";
  if (remaining < 60000) return `${Math.ceil(remaining / 1000)}s`;
  if (remaining < 3600000) return `${Math.ceil(remaining / 60000)}m`;
  return `${Math.ceil(remaining / 3600000)}h`;
}

/**
 * Basic progress bar
 */
export function ProgressBar({
  progress,
  width = 30,
  showPercentage = true,
  label,
  color = colors.primary,
  showETA = false,
  startTime,
}: ProgressBarProps): React.JSX.Element {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clampedProgress / 100) * width);
  const empty = width - filled;
  
  const filledChar = "█";
  const emptyChar = "░";
  
  return (
    <Box>
      {label && (
        <Text color={colors.text}>{label} </Text>
      )}
      <Text>[</Text>
      <Text color={color}>{filledChar.repeat(filled)}</Text>
      <Text color={colors.textDim}>{emptyChar.repeat(empty)}</Text>
      <Text>]</Text>
      {showPercentage && (
        <Text color={colors.textMuted}> {clampedProgress.toFixed(0)}%</Text>
      )}
      {showETA && startTime && progress > 0 && progress < 100 && (
        <Text color={colors.textDim}> ETA: {calculateETA(progress, startTime)}</Text>
      )}
    </Box>
  );
}

/**
 * Slim/compact progress bar
 */
export function SlimProgressBar({
  progress,
  width = 20,
  color = colors.primary,
}: {
  progress: number;
  width?: number;
  color?: string;
}): React.JSX.Element {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const filled = Math.round((clampedProgress / 100) * width);
  const empty = width - filled;
  
  return (
    <Text>
      <Text color={color}>{"━".repeat(filled)}</Text>
      <Text color={colors.border}>{"─".repeat(empty)}</Text>
    </Text>
  );
}

/**
 * Multiple progress bars for parallel operations
 */
export function MultiProgressBar({
  items,
  width = 25,
}: MultiProgressBarProps): React.JSX.Element {
  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const statusIcon = item.status === "complete" ? "✓"
          : item.status === "error" ? "✗"
          : item.status === "active" ? "◐"
          : "○";
        
        const statusColor = item.status === "complete" ? colors.success
          : item.status === "error" ? colors.error
          : item.status === "active" ? colors.primary
          : colors.textMuted;
        
        return (
          <Box key={i}>
            <Text color={statusColor}>{statusIcon} </Text>
            <Text color={colors.text}>{item.label.padEnd(15)}</Text>
            <SlimProgressBar 
              progress={item.progress} 
              width={width} 
              color={statusColor}
            />
            <Text color={colors.textMuted}> {item.progress}%</Text>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Indeterminate progress bar (for unknown duration)
 */
export function IndeterminateProgress({
  width = 30,
  label,
  color = colors.primary,
}: IndeterminateProgressProps): React.JSX.Element {
  // Use a bouncing indicator pattern
  const [position, setPosition] = React.useState(0);
  const indicatorWidth = 5;
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setPosition(p => (p + 1) % (width - indicatorWidth + 1));
    }, 100);
    return () => clearInterval(interval);
  }, [width]);
  
  const before = "─".repeat(position);
  const indicator = "━".repeat(indicatorWidth);
  const after = "─".repeat(Math.max(0, width - position - indicatorWidth));
  
  return (
    <Box>
      {label && (
        <Text color={colors.text}>{label} </Text>
      )}
      <Text>[</Text>
      <Text color={colors.border}>{before}</Text>
      <Text color={color}>{indicator}</Text>
      <Text color={colors.border}>{after}</Text>
      <Text>]</Text>
    </Box>
  );
}

/**
 * Download/upload progress with speed and size
 */
export function TransferProgress({
  current,
  total,
  speed,
  label,
  width = 25,
}: {
  current: number;    // bytes
  total: number;      // bytes
  speed?: number;     // bytes per second
  label?: string;
  width?: number;
}): React.JSX.Element {
  const progress = total > 0 ? (current / total) * 100 : 0;
  
  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  };
  
  return (
    <Box>
      {label && <Text color={colors.text}>{label} </Text>}
      <ProgressBar progress={progress} width={width} showPercentage={false} />
      <Text color={colors.textMuted}>
        {" "}{formatBytes(current)}/{formatBytes(total)}
        {speed && ` (${formatBytes(speed)}/s)`}
      </Text>
    </Box>
  );
}

/**
 * Step progress indicator
 */
export function StepProgress({
  steps,
  currentStep,
}: {
  steps: string[];
  currentStep: number;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        const icon = isComplete ? "✓" : isCurrent ? "◐" : "○";
        const color = isComplete ? colors.success 
          : isCurrent ? colors.primary 
          : colors.textMuted;
        
        return (
          <Box key={i}>
            <Text color={color}>{icon} </Text>
            <Text color={isCurrent ? colors.text : colors.textMuted}>
              {i + 1}. {step}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export default ProgressBar;
