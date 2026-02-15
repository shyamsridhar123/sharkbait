/**
 * Retry Utility - Exponential backoff retry logic for transient failures
 * Inspired by Claude Code's error handling patterns
 */

import { log } from "../utils/logger";

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;
  
  /**
   * Base delay in milliseconds for exponential backoff (default: 1000)
   */
  baseDelay?: number;
  
  /**
   * Maximum delay in milliseconds (default: 30000)
   */
  maxDelay?: number;
  
  /**
   * Custom function to determine if an error is retryable
   */
  isRetryable?: (error: unknown) => boolean;
  
  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  isRetryable: isDefaultRetryableError,
};

/**
 * Determines if an error is retryable based on status code and error type
 */
function isDefaultRetryableError(error: unknown): boolean {
  // Check for status code in error object
  const statusCode = extractStatusCode(error);
  
  if (statusCode !== undefined) {
    // Rate limiting (429) - always retry
    if (statusCode === 429) {
      return true;
    }
    
    // Server errors (500, 502, 503, 504) - retry
    if (statusCode >= 500 && statusCode < 600) {
      return true;
    }
    
    // Auth errors (401, 403) - do NOT retry
    if (statusCode === 401 || statusCode === 403) {
      return false;
    }
    
    // Client errors (400-499 except 429) - do NOT retry
    if (statusCode >= 400 && statusCode < 500) {
      return false;
    }
  }
  
  // Check error message for retryable patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    // Rate limiting
    if (message.includes("rate limit") || message.includes("too many requests")) {
      return true;
    }
    
    // Network errors
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("etimedout") ||
      message.includes("socket hang up")
    ) {
      return true;
    }
    
    // Temporary service issues
    if (
      message.includes("service unavailable") ||
      message.includes("bad gateway") ||
      message.includes("gateway timeout")
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extracts HTTP status code from an error object
 */
function extractStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  
  // Check common status code properties
  if ("status" in error && typeof error["status"] === "number") {
    return error["status"];
  }
  
  if ("statusCode" in error && typeof error["statusCode"] === "number") {
    return error["statusCode"];
  }
  
  if ("code" in error && typeof error["code"] === "number") {
    return error["code"];
  }
  
  // Check response object
  if ("response" in error && error["response"] && typeof error["response"] === "object") {
    const response = error["response"] as Record<string, unknown>;
    if ("status" in response && typeof response["status"] === "number") {
      return response["status"];
    }
  }
  
  return undefined;
}

/**
 * Calculates delay for exponential backoff with jitter
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential backoff: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  
  // Add random jitter (0-1000ms) to prevent thundering herd
  const jitter = Math.random() * 1000;
  
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - The async function to retry
 * @param options - Retry configuration options
 * @returns The result of the function if successful
 * @throws The last error if all retries fail
 * 
 * @example
 * ```ts
 * const result = await withRetry(
 *   async () => {
 *     return await apiCall();
 *   },
 *   {
 *     maxRetries: 3,
 *     baseDelay: 1000,
 *     maxDelay: 30000,
 *     onRetry: (error, attempt, delay) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries,
    baseDelay,
    maxDelay,
    isRetryable,
    onRetry,
  } = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  
  let lastError: unknown = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (!isRetryable(error)) {
        log.debug(`Error is not retryable, throwing immediately`);
        throw error;
      }
      
      // Check if we have more retries left
      if (attempt === maxRetries - 1) {
        log.debug(`Max retries (${maxRetries}) reached, throwing error`);
        throw error;
      }
      
      // Calculate backoff delay
      const delay = calculateBackoff(attempt, baseDelay, maxDelay);
      
      // Log retry attempt
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.warn(
        `Retryable error occurred: ${errorMessage}. ` +
        `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`
      );
      
      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }
      
      // Wait before retrying
      await sleep(delay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Export utility functions for testing or custom usage
 */
export const retryUtils = {
  isDefaultRetryableError,
  extractStatusCode,
  calculateBackoff,
  sleep,
};
