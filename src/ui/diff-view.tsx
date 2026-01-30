/**
 * Diff View Component - Display code changes with red/green diff colors
 */

import React from "react";
import { Box, Text } from "ink";
import { colors, box } from "./theme";
import { basename } from "path";

interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
  lineNumber?: number;
}

interface DiffViewProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  context?: number; // Number of context lines (default: 3)
}

/**
 * Simple line-by-line diff algorithm
 */
function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  
  // Simple diff: show removed lines, then added lines
  // For more sophisticated diffing, we'd use a proper LCS algorithm
  let i = 0, j = 0;
  
  while (i < oldLines.length || j < newLines.length) {
    if (i >= oldLines.length) {
      // Remaining new lines are additions
      result.push({ type: "add", content: newLines[j] ?? "", lineNumber: j + 1 });
      j++;
    } else if (j >= newLines.length) {
      // Remaining old lines are deletions
      result.push({ type: "remove", content: oldLines[i] ?? "", lineNumber: i + 1 });
      i++;
    } else if (oldLines[i] === newLines[j]) {
      // Lines match - context
      result.push({ type: "context", content: oldLines[i] ?? "", lineNumber: i + 1 });
      i++;
      j++;
    } else {
      // Lines differ - find the next matching point
      // Simple approach: mark old as removed, new as added
      result.push({ type: "remove", content: oldLines[i] ?? "", lineNumber: i + 1 });
      result.push({ type: "add", content: newLines[j] ?? "", lineNumber: j + 1 });
      i++;
      j++;
    }
  }
  
  return result;
}

/**
 * Collapse context lines, showing only N lines around changes
 */
function collapseContext(lines: DiffLine[], contextLines: number): DiffLine[] {
  if (contextLines === 0) {
    return lines.filter(l => l.type !== "context");
  }
  
  const result: DiffLine[] = [];
  
  // Find indices of non-context lines
  const changeIndices: number[] = [];
  lines.forEach((line, idx) => {
    if (line.type !== "context") {
      changeIndices.push(idx);
    }
  });
  
  if (changeIndices.length === 0) {
    return []; // No changes
  }
  
  // Build set of indices to show
  const showIndices = new Set<number>();
  for (const idx of changeIndices) {
    showIndices.add(idx);
    // Add context before
    for (let c = 1; c <= contextLines; c++) {
      if (idx - c >= 0) showIndices.add(idx - c);
    }
    // Add context after
    for (let c = 1; c <= contextLines; c++) {
      if (idx + c < lines.length) showIndices.add(idx + c);
    }
  }
  
  let lastShownIdx = -2;
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (showIndices.has(idx) && line) {
      if (lastShownIdx !== -2 && idx - lastShownIdx > 1) {
        // Gap - add ellipsis
        result.push({ type: "context", content: "..." });
      }
      result.push(line);
      lastShownIdx = idx;
    }
  }
  
  return result;
}

export function DiffView({ 
  filePath, 
  oldContent, 
  newContent,
  context = 3
}: DiffViewProps): React.JSX.Element {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  
  const allDiff = computeDiff(oldLines, newLines);
  const diff = collapseContext(allDiff, context);
  
  const addCount = diff.filter(l => l.type === "add").length;
  const removeCount = diff.filter(l => l.type === "remove").length;
  
  if (addCount === 0 && removeCount === 0) {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text color={colors.textMuted}>No changes detected</Text>
      </Box>
    );
  }

  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={colors.border}
      marginY={1}
    >
      {/* Header */}
      <Box paddingX={1} borderBottom>
        <Text bold color={colors.text}>{basename(filePath)}</Text>
        <Text color={colors.textMuted}> ({filePath})</Text>
      </Box>
      
      {/* Stats */}
      <Box paddingX={1}>
        <Text color={colors.success}>+{addCount}</Text>
        <Text color={colors.textMuted}> / </Text>
        <Text color={colors.error}>-{removeCount}</Text>
      </Box>
      
      {/* Diff lines */}
      <Box flexDirection="column" paddingX={1}>
        {diff.map((line, idx) => {
          const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
          const textColor = line.type === "add" 
            ? colors.success 
            : line.type === "remove" 
              ? colors.error 
              : colors.textMuted;
          const bgColor = line.type === "add"
            ? "#1a3d1a"
            : line.type === "remove"
              ? "#3d1a1a"
              : undefined;
          
          return (
            <Box key={idx}>
              <Text color={textColor} backgroundColor={bgColor}>
                {prefix} {line.content}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
