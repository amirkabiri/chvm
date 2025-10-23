/**
 * Logger module - Logging with file support
 */

import fs from 'fs/promises';
import { existsSync, appendFileSync, statSync, mkdirSync } from 'fs';
import { join } from 'path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface Logger {
  debug: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

export interface LoggerOptions {
  chvmHome: string;
  level?: LogLevel;
}

export interface RotateOptions {
  maxSize?: number;
  maxFiles?: number;
}

export function createLogger(options: LoggerOptions): Logger {
  const { chvmHome, level = 'info' } = options;
  const currentLevel = LOG_LEVELS[level] || LOG_LEVELS.info;
  const logsDir = join(chvmHome, 'logs');
  const logFile = join(logsDir, 'chvm.log');

  // Ensure logs directory exists
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }

  const log = (logLevel: LogLevel, message: string): void => {
    if (LOG_LEVELS[logLevel] < currentLevel) {
      return;
    }

    const formatted = formatLogMessage(logLevel, message);

    try {
      appendFileSync(logFile, formatted + '\n', 'utf8');
    } catch (err) {
      // Silently fail if we can't write to log
    }
  };

  return {
    debug: (message: string) => log('debug', message),
    info: (message: string) => log('info', message),
    warn: (message: string) => log('warn', message),
    error: (message: string) => log('error', message),
  };
}

export function formatLogMessage(level: LogLevel, message: string): string {
  const timestamp = new Date().toISOString();
  return `${timestamp} [${level.toLowerCase()}] ${message}`;
}

export async function rotateLogFile(
  logFile: string,
  options: RotateOptions = {}
): Promise<void> {
  const { maxSize = 1024 * 1024 * 10, maxFiles = 5 } = options; // 10MB default

  if (!existsSync(logFile)) {
    return;
  }

  const stats = statSync(logFile);

  if (stats.size <= maxSize) {
    return;
  }

  // Rotate existing logs
  for (let i = maxFiles - 1; i >= 1; i--) {
    const oldFile = `${logFile}.${i}`;
    const newFile = `${logFile}.${i + 1}`;

    if (existsSync(oldFile)) {
      if (i === maxFiles - 1) {
        await fs.unlink(oldFile);
      } else {
        await fs.rename(oldFile, newFile);
      }
    }
  }

  // Move current log to .1
  await fs.rename(logFile, `${logFile}.1`);
}

export async function clearLogs(chvmHome: string): Promise<void> {
  const logsDir = join(chvmHome, 'logs');

  if (!existsSync(logsDir)) {
    return;
  }

  const files = await fs.readdir(logsDir);

  for (const file of files) {
    await fs.unlink(join(logsDir, file));
  }
}
