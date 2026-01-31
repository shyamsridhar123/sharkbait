/**
 * UI Module - Claude Code inspired Ink-based terminal UI components
 */

// Main components
export { App } from "./app";
export { MessageView } from "./message";
export { Spinner } from "./spinner";
export { ToolCallView } from "./tool-call";

// New enhanced components
export { DiffView } from "./diff-view";
export { ConfirmDialog, isConfirmation } from "./confirm-dialog";
export { ParallelProgressView } from "./parallel-progress";

// Syntax highlighting
export { 
  CodeBlock, 
  InlineCode, 
  HighlightedContent,
  parseCodeBlocks,
  getSupportedLanguages,
  isLanguageSupported,
} from "./syntax-highlight";

// Beads task display
export {
  BeadsTaskView,
  BeadsTaskList,
  ActiveTaskIndicator,
  TaskNotification,
  type BeadsTask,
} from "./beads-task-view";

// GitHub UI components
export {
  PRView,
  IssueView,
  PRCreatedNotification,
  IssueCreatedNotification,
  PRConfirmation,
  IssueConfirmation,
  type GitHubPR,
  type GitHubIssue,
} from "./github-ui";

// Progress bars
export {
  ProgressBar,
  SlimProgressBar,
  MultiProgressBar,
  IndeterminateProgress,
  TransferProgress,
  StepProgress,
} from "./progress-bar";

// Command history and autocomplete
export {
  CommandHistory,
  Autocomplete,
  globalHistory,
  globalAutocomplete,
  type HistoryEntry,
  type CompletionItem,
} from "./command-history";

// Claude Code-inspired components
export { Logo, InlineLogo } from "./logo";
export { WelcomeScreen } from "./welcome";
export { StatusBar } from "./status-bar";
export { InputPrompt } from "./input-prompt";

// Theme and styling
export { colors, icons, box, SPINNER_FRAMES, DOTS_FRAMES } from "./theme";
