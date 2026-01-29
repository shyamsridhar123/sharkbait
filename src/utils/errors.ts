/**
 * Error Types - Custom error classes for Sharkbait
 */

export class SharkbaitError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SharkbaitError";
    this.code = code;
    
    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SharkbaitError);
    }
  }
}

export class LLMError extends SharkbaitError {
  public readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message, "LLM_ERROR");
    this.name = "LLMError";
    this.statusCode = statusCode;
  }

  isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  isServerError(): boolean {
    return this.statusCode !== undefined && this.statusCode >= 500;
  }

  isRetryable(): boolean {
    return this.isRateLimited() || this.isServerError();
  }
}

export class ToolError extends SharkbaitError {
  public readonly toolName: string;

  constructor(message: string, toolName: string) {
    super(message, "TOOL_ERROR");
    this.name = "ToolError";
    this.toolName = toolName;
  }
}

export class ConfigError extends SharkbaitError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}

export class ValidationError extends SharkbaitError {
  public readonly field: string | undefined;

  constructor(message: string, field?: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
    this.field = field;
  }
}

export class SecurityError extends SharkbaitError {
  constructor(message: string) {
    super(message, "SECURITY_ERROR");
    this.name = "SecurityError";
  }
}
