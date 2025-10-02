import { describe, it, expect, jest } from '@jest/globals';

describe('Unit: platform-check module', () => {
  describe('checkPlatform', () => {
    it('should not throw on macOS ARM', async () => {
      const { checkPlatform } = await import('../../src/lib/platform-check.js');
      
      // If running on actual macOS ARM, should not throw
      if (process.platform === 'darwin' && process.arch === 'arm64') {
        expect(() => checkPlatform()).not.toThrow();
      }
    });

    it('should throw on non-macOS platforms', async () => {
      const { checkPlatform } = await import('../../src/lib/platform-check.js');
      
      // If not on macOS ARM, should throw
      if (process.platform !== 'darwin' || process.arch !== 'arm64') {
        expect(() => checkPlatform()).toThrow(/macOS.*ARM|Apple Silicon/i);
      }
    });

    it('should provide helpful error message', async () => {
      const { checkPlatform } = await import('../../src/lib/platform-check.js');
      
      if (process.platform !== 'darwin' || process.arch !== 'arm64') {
        try {
          checkPlatform();
          expect(true).toBe(false); // Should not reach here
        } catch (error) {
          expect(error.message).toMatch(/macOS/i);
          expect(error.message).toMatch(/ARM|Apple Silicon/i);
        }
      }
    });
  });

  describe('getPlatformInfo', () => {
    it('should return current platform information', async () => {
      const { getPlatformInfo } = await import('../../src/lib/platform-check.js');
      
      const info = getPlatformInfo();
      
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('isSupported');
      
      expect(typeof info.platform).toBe('string');
      expect(typeof info.arch).toBe('string');
      expect(typeof info.isSupported).toBe('boolean');
    });

    it('should mark macOS ARM as supported', async () => {
      const { getPlatformInfo } = await import('../../src/lib/platform-check.js');
      
      const info = getPlatformInfo();
      
      if (info.platform === 'darwin' && info.arch === 'arm64') {
        expect(info.isSupported).toBe(true);
      } else {
        expect(info.isSupported).toBe(false);
      }
    });
  });

  describe('isMacOSArm', () => {
    it('should correctly identify macOS ARM', async () => {
      const { isMacOSArm } = await import('../../src/lib/platform-check.js');
      
      const result = isMacOSArm();
      
      const expected = process.platform === 'darwin' && process.arch === 'arm64';
      expect(result).toBe(expected);
    });
  });
});


