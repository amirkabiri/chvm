import { describe, it, expect } from '@jest/globals';

describe('Unit: platform-check module', () => {
  describe('getPlatformInfo', () => {
    it('should return current platform information', async () => {
      const { getPlatformInfo } = await import(
        '../../src/lib/platform-check.js'
      );

      const info = getPlatformInfo();

      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('isSupported');

      expect(typeof info.platform).toBe('string');
      expect(typeof info.arch).toBe('string');
      expect(typeof info.isSupported).toBe('boolean');
    });

    it('should mark supported desktop platforms as supported', async () => {
      const { getPlatformInfo, isSupportedPlatform } = await import(
        '../../src/lib/platform-check.js'
      );

      const info = getPlatformInfo();
      expect(info.isSupported).toBe(isSupportedPlatform());
    });
  });

  describe('isMacOSArm', () => {
    it('should correctly identify macOS ARM', async () => {
      const { isMacOSArm } = await import('../../src/lib/platform-check.js');

      const result = isMacOSArm();

      const expected =
        process.platform === 'darwin' && process.arch === 'arm64';
      expect(result).toBe(expected);
    });
  });

  describe('getChromiumPlatformPrefix', () => {
    it('should return a prefix for the current platform when supported', async () => {
      const { getChromiumPlatformPrefix, isSupportedPlatform } = await import(
        '../../src/lib/platform-check.js'
      );

      if (!isSupportedPlatform()) {
        expect(() => getChromiumPlatformPrefix()).toThrow(/Unsupported platform/);
        return;
      }

      const prefix = getChromiumPlatformPrefix();
      expect(typeof prefix).toBe('string');
      expect(prefix.length).toBeGreaterThan(0);
    });
  });

  describe('getChromiumZipName', () => {
    it('should return a zip name for the current platform when supported', async () => {
      const { getChromiumZipName, isSupportedPlatform } = await import(
        '../../src/lib/platform-check.js'
      );

      if (!isSupportedPlatform()) {
        expect(() => getChromiumZipName()).toThrow(/Unsupported platform/);
        return;
      }

      const zipName = getChromiumZipName();
      expect(zipName).toMatch(/^chrome-(mac|win|linux)\.zip$/);
    });
  });
});
