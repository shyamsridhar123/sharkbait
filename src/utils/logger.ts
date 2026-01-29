/**
 * Logger - Colorful, leveled logging for Sharkbait
 */

import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getCurrentLogLevel(): LogLevel {
  const envLevel = process.env["SHARKBAIT_LOG_LEVEL"]?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getCurrentLogLevel()];
}

function formatMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString().substring(11, 23);
  const prefix = {
    debug: chalk.gray(`[${timestamp}] [DEBUG]`),
    info: chalk.blue(`[${timestamp}] [INFO]`),
    warn: chalk.yellow(`[${timestamp}] [WARN]`),
    error: chalk.red(`[${timestamp}] [ERROR]`),
  }[level];

  return `${prefix} ${message}`;
}

export const log = {
  debug(message: string): void {
    if (shouldLog("debug")) {
      console.error(formatMessage("debug", chalk.gray(message)));
    }
  },

  info(message: string): void {
    if (shouldLog("info")) {
      console.error(formatMessage("info", message));
    }
  },

  warn(message: string): void {
    if (shouldLog("warn")) {
      console.error(formatMessage("warn", chalk.yellow(message)));
    }
  },

  error(message: string): void {
    if (shouldLog("error")) {
      console.error(formatMessage("error", chalk.red(message)));
    }
  },

  // Special methods for user-facing output (not logged to stderr)
  print(message: string): void {
    console.log(message);
  },

  success(message: string): void {
    console.log(chalk.green(`✓ ${message}`));
  },

  failure(message: string): void {
    console.log(chalk.red(`✗ ${message}`));
  },

  spinner(message: string): void {
    process.stdout.write(`\r${chalk.cyan("⠋")} ${message}`);
  },
};
