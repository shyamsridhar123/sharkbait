/**
 * Syntax Highlighter Component - Terminal syntax highlighting for code blocks
 * Uses cli-highlight for language-aware syntax highlighting
 */

import React from "react";
import { Box, Text } from "ink";
import { highlight, supportsLanguage, listLanguages } from "cli-highlight";
import { colors } from "./theme";

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  startLine?: number;
  maxLines?: number;
  title?: string;
}

/**
 * Highlight code with terminal colors
 */
function highlightCode(code: string, language?: string): string {
  try {
    // If language is specified and supported, use it
    if (language && supportsLanguage(language)) {
      return highlight(code, { language, ignoreIllegals: true });
    }
    
    // Auto-detect language
    return highlight(code, { ignoreIllegals: true });
  } catch {
    // Return unhighlighted code on error
    return code;
  }
}

/**
 * Parse a markdown string and extract code blocks
 */
export function parseCodeBlocks(content: string): Array<{
  type: "text" | "code";
  content: string;
  language?: string;
}> {
  const blocks: Array<{ type: "text" | "code"; content: string; language?: string }> = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index);
      if (textContent.trim()) {
        blocks.push({ type: "text", content: textContent });
      }
    }
    
    // Add the code block
    blocks.push({
      type: "code",
      language: match[1] || undefined,
      content: match[2] || "",
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex);
    if (remaining.trim()) {
      blocks.push({ type: "text", content: remaining });
    }
  }
  
  return blocks;
}

/**
 * Code block component with syntax highlighting
 */
export function CodeBlock({
  code,
  language,
  showLineNumbers = false,
  startLine = 1,
  maxLines,
  title,
}: CodeBlockProps): React.JSX.Element {
  const lines = code.split("\n");
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const truncated = maxLines && lines.length > maxLines;
  
  // Highlight the entire code
  const highlighted = highlightCode(code, language);
  const highlightedLines = highlighted.split("\n");
  
  // Calculate line number width
  const lineNumWidth = showLineNumbers 
    ? String(startLine + displayLines.length - 1).length + 1
    : 0;
  
  return (
    <Box flexDirection="column" marginY={1}>
      {/* Header */}
      {(title || language) && (
        <Box>
          <Text color={colors.textMuted}>
            {"┌─"}
            {language && <Text color={colors.primary}> {language} </Text>}
            {title && <Text color={colors.text}> {title} </Text>}
            {"─".repeat(40)}
          </Text>
        </Box>
      )}
      
      {/* Code content */}
      <Box flexDirection="column" paddingX={1}>
        {highlightedLines.slice(0, maxLines || highlightedLines.length).map((line, i) => (
          <Box key={i}>
            {showLineNumbers && (
              <Text color={colors.textDim}>
                {String(startLine + i).padStart(lineNumWidth)} │ 
              </Text>
            )}
            <Text>{line}</Text>
          </Box>
        ))}
        
        {truncated && (
          <Text color={colors.textMuted} italic>
            ... {lines.length - (maxLines || 0)} more lines ...
          </Text>
        )}
      </Box>
      
      {/* Footer */}
      {(title || language) && (
        <Text color={colors.textMuted}>
          {"└" + "─".repeat(45)}
        </Text>
      )}
    </Box>
  );
}

/**
 * Inline code with simple highlighting
 */
export function InlineCode({ children }: { children: string }): React.JSX.Element {
  return (
    <Text backgroundColor={colors.background} color={colors.primary}>
      {` ${children} `}
    </Text>
  );
}

/**
 * Highlighted content - parses markdown and highlights code blocks
 */
export function HighlightedContent({ content }: { content: string }): React.JSX.Element {
  const blocks = parseCodeBlocks(content);
  
  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => {
        if (block.type === "code") {
          return (
            <CodeBlock
              key={i}
              code={block.content}
              language={block.language}
            />
          );
        }
        return <Text key={i}>{block.content}</Text>;
      })}
    </Box>
  );
}

/**
 * Get list of supported languages
 */
export function getSupportedLanguages(): string[] {
  return listLanguages();
}

/**
 * Check if a language is supported
 */
export function isLanguageSupported(language: string): boolean {
  return supportsLanguage(language);
}

export default CodeBlock;
