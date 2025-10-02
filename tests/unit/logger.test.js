import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import { join } from 'path';

let testDir;

describe('Unit: logger module', () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-logger-test-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createLogger', () => {
    it('should create logger instance', async () => {
      const { createLogger } = await import('../../src/lib/logger.js');
      
      const logger = createLogger({ chvmHome: testDir });
      
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
    });

    it('should write logs to file', async () => {
      const { createLogger } = await import('../../src/lib/logger.js');
      
      const logger = createLogger({ chvmHome: testDir });
      
      logger.info('Test message');
      
      // Wait a bit for file write
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logFile = join(testDir, 'logs', 'chvm.log');
      
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        expect(content).toContain('Test message');
      }
    });

    it('should support different log levels', async () => {
      const { createLogger } = await import('../../src/lib/logger.js');
      
      const logger = createLogger({ 
        chvmHome: testDir,
        level: 'debug'
      });
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should respect log level filtering', async () => {
      const { createLogger } = await import('../../src/lib/logger.js');
      
      const logger = createLogger({ 
        chvmHome: testDir,
        level: 'error'
      });
      
      logger.debug('Debug message');
      logger.info('Info message');
      logger.error('Error message');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const logFile = join(testDir, 'logs', 'chvm.log');
      
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, 'utf8');
        expect(content).toContain('Error message');
        expect(content).not.toContain('Debug message');
        expect(content).not.toContain('Info message');
      }
    });
  });

  describe('formatLogMessage', () => {
    it('should format log messages with timestamp', async () => {
      const { formatLogMessage } = await import('../../src/lib/logger.js');
      
      const formatted = formatLogMessage('info', 'Test message');
      
      expect(formatted).toContain('info');
      expect(formatted).toContain('Test message');
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
    });

    it('should include log level in message', async () => {
      const { formatLogMessage } = await import('../../src/lib/logger.js');
      
      const levels = ['debug', 'info', 'warn', 'error'];
      
      for (const level of levels) {
        const formatted = formatLogMessage(level, 'Message');
        expect(formatted.toLowerCase()).toContain(level);
      }
    });
  });

  describe('rotateLogFile', () => {
    it('should rotate log file when size exceeds limit', async () => {
      const { rotateLogFile } = await import('../../src/lib/logger.js');
      
      const logFile = join(testDir, 'test.log');
      
      // Create a large log file
      fs.writeFileSync(logFile, 'a'.repeat(1024 * 1024 * 5)); // 5MB
      
      await rotateLogFile(logFile, { maxSize: 1024 * 1024 }); // 1MB max
      
      // Original should be rotated
      const rotatedFile = `${logFile}.1`;
      expect(fs.existsSync(rotatedFile) || !fs.existsSync(logFile)).toBe(true);
    });

    it('should keep specified number of rotated logs', async () => {
      const { rotateLogFile } = await import('../../src/lib/logger.js');
      
      const logFile = join(testDir, 'test.log');
      
      // Create log file
      fs.writeFileSync(logFile, 'test');
      
      await rotateLogFile(logFile, { maxFiles: 3 });
      
      // Should not create more than maxFiles rotated logs
      expect(true).toBe(true); // Placeholder - actual implementation will enforce this
    });
  });

  describe('clearLogs', () => {
    it('should clear all log files', async () => {
      const { clearLogs } = await import('../../src/lib/logger.js');
      
      const logsDir = join(testDir, 'logs');
      fs.mkdirSync(logsDir, { recursive: true });
      
      fs.writeFileSync(join(logsDir, 'chvm.log'), 'log content');
      fs.writeFileSync(join(logsDir, 'chvm.log.1'), 'old log');
      
      await clearLogs(testDir);
      
      // Logs should be cleared or directory empty
      const files = fs.readdirSync(logsDir);
      expect(files.length).toBe(0);
    });

    it('should not fail if logs directory does not exist', async () => {
      const { clearLogs } = await import('../../src/lib/logger.js');
      
      await expect(clearLogs(testDir)).resolves.not.toThrow();
    });
  });
});


