/**
 * Sharkbait Theme - Claude Code inspired color scheme
 */

// Primary brand color (coral/salmon like Claude's orange)
export const BRAND_COLOR = "#E07A5F";
export const BRAND_COLOR_LIGHT = "#F4A261";

// Semantic colors
export const colors = {
  // Brand
  primary: BRAND_COLOR,
  primaryLight: BRAND_COLOR_LIGHT,
  
  // Roles
  user: "#81B29A",       // Soft green
  assistant: BRAND_COLOR, // Brand coral
  system: "#F2CC8F",      // Soft yellow
  
  // Status
  success: "#81B29A",
  error: "#E07A5F", 
  warning: "#F2CC8F",
  info: "#3D405B",
  
  // UI
  muted: "#6B7280",
  border: "#374151",
  background: "#1F2937",
  
  // Text
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  textDim: "#6B7280",
} as const;

// Spinner frames (braille characters for smooth animation)
export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

// Alternate spinner with dots
export const DOTS_FRAMES = ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"];

// Status icons
export const icons = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  thinking: "◐",
  tool: "⚡",
  file: "📄",
  folder: "📁",
  code: "💻",
  shark: "🦈",
} as const;

// Box drawing characters
export const box = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
} as const;
