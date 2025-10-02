import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import { join } from 'path';

// Mock chvm home for testing
let testChvmDir;

describe('Unit: storage module', () => {
  beforeEach(() => {
    testChvmDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-storage-test-'));
  });

  afterEach(() => {
    if (testChvmDir && fs.existsSync(testChvmDir)) {
      fs.rmSync(testChvmDir, { recursive: true, force: true });
    }
  });

  describe('getChvmHome', () => {
    it('should return CHVM_HOME env if set', async () => {
      process.env.CHVM_HOME = testChvmDir;
      
      const { getChvmHome } = await import('../../src/lib/storage.js');
      const home = getChvmHome();
      
      expect(home).toBe(testChvmDir);
      delete process.env.CHVM_HOME;
    });

    it('should return ~/.chvm by default', async () => {
      delete process.env.CHVM_HOME;
      
      const { getChvmHome } = await import('../../src/lib/storage.js');
      const home = getChvmHome();
      
      expect(home).toContain('.chvm');
    });
  });

  describe('ensureChvmDir', () => {
    it('should create chvm directory structure', async () => {
      const { ensureChvmDir } = await import('../../src/lib/storage.js');
      
      await ensureChvmDir(testChvmDir);
      
      expect(fs.existsSync(testChvmDir)).toBe(true);
      expect(fs.existsSync(join(testChvmDir, 'installs'))).toBe(true);
      expect(fs.existsSync(join(testChvmDir, 'profiles'))).toBe(true);
      expect(fs.existsSync(join(testChvmDir, 'tmp'))).toBe(true);
      expect(fs.existsSync(join(testChvmDir, 'logs'))).toBe(true);
    });
  });

  describe('readAvailableVersions', () => {
    it('should return empty array when file does not exist', async () => {
      const { readAvailableVersions } = await import('../../src/lib/storage.js');
      
      const versions = await readAvailableVersions(testChvmDir);
      
      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBe(0);
    });

    it('should parse and return available.json', async () => {
      const availablePath = join(testChvmDir, 'available.json');
      const mockData = [
        { version: '92.0.4515.159', revision: '882387', platform: 'Mac_Arm' }
      ];
      
      fs.writeFileSync(availablePath, JSON.stringify(mockData, null, 2));
      
      const { readAvailableVersions } = await import('../../src/lib/storage.js');
      const versions = await readAvailableVersions(testChvmDir);
      
      expect(versions).toEqual(mockData);
    });

    it('should handle corrupted JSON gracefully', async () => {
      const availablePath = join(testChvmDir, 'available.json');
      fs.writeFileSync(availablePath, 'invalid json {{{');
      
      const { readAvailableVersions } = await import('../../src/lib/storage.js');
      
      await expect(readAvailableVersions(testChvmDir)).rejects.toThrow();
    });
  });

  describe('writeAvailableVersions', () => {
    it('should write data to available.json', async () => {
      const mockData = [
        { version: '92.0.4515.159', revision: '882387', platform: 'Mac_Arm' }
      ];
      
      const { writeAvailableVersions } = await import('../../src/lib/storage.js');
      await writeAvailableVersions(testChvmDir, mockData);
      
      const availablePath = join(testChvmDir, 'available.json');
      expect(fs.existsSync(availablePath)).toBe(true);
      
      const written = JSON.parse(fs.readFileSync(availablePath, 'utf8'));
      expect(written).toEqual(mockData);
    });
  });

  describe('readInstalledVersions', () => {
    it('should return empty object when file does not exist', async () => {
      const { readInstalledVersions } = await import('../../src/lib/storage.js');
      
      const installed = await readInstalledVersions(testChvmDir);
      
      expect(typeof installed).toBe('object');
      expect(Object.keys(installed).length).toBe(0);
    });

    it('should parse and return installed.json', async () => {
      const installedPath = join(testChvmDir, 'installed.json');
      const mockData = {
        '92.0.4515.159': {
          revision: '882387',
          path: '/path/to/app',
          installedAt: '2025-10-01T00:00:00Z',
          size: 116242173
        }
      };
      
      fs.writeFileSync(installedPath, JSON.stringify(mockData, null, 2));
      
      const { readInstalledVersions } = await import('../../src/lib/storage.js');
      const installed = await readInstalledVersions(testChvmDir);
      
      expect(installed).toEqual(mockData);
    });
  });

  describe('writeInstalledVersions', () => {
    it('should write data to installed.json', async () => {
      const mockData = {
        '92.0.4515.159': {
          revision: '882387',
          path: '/path/to/app',
          installedAt: '2025-10-01T00:00:00Z',
          size: 116242173
        }
      };
      
      const { writeInstalledVersions } = await import('../../src/lib/storage.js');
      await writeInstalledVersions(testChvmDir, mockData);
      
      const installedPath = join(testChvmDir, 'installed.json');
      expect(fs.existsSync(installedPath)).toBe(true);
      
      const written = JSON.parse(fs.readFileSync(installedPath, 'utf8'));
      expect(written).toEqual(mockData);
    });
  });

  describe('addInstalledVersion', () => {
    it('should add a version to installed.json', async () => {
      const { addInstalledVersion, readInstalledVersions } = await import('../../src/lib/storage.js');
      
      await addInstalledVersion(testChvmDir, {
        version: '92.0.4515.159',
        revision: '882387',
        path: '/path/to/app',
        size: 116242173
      });
      
      const installed = await readInstalledVersions(testChvmDir);
      
      expect(installed).toHaveProperty('92.0.4515.159');
      expect(installed['92.0.4515.159'].revision).toBe('882387');
      expect(installed['92.0.4515.159'].installedAt).toBeDefined();
    });

    it('should merge with existing installed versions', async () => {
      const installedPath = join(testChvmDir, 'installed.json');
      fs.writeFileSync(installedPath, JSON.stringify({
        '91.0.4472.124': {
          revision: '870763',
          path: '/path/to/app1',
          installedAt: '2025-09-01T00:00:00Z',
          size: 110000000
        }
      }, null, 2));
      
      const { addInstalledVersion, readInstalledVersions } = await import('../../src/lib/storage.js');
      
      await addInstalledVersion(testChvmDir, {
        version: '92.0.4515.159',
        revision: '882387',
        path: '/path/to/app2',
        size: 116242173
      });
      
      const installed = await readInstalledVersions(testChvmDir);
      
      expect(Object.keys(installed).length).toBe(2);
      expect(installed).toHaveProperty('91.0.4472.124');
      expect(installed).toHaveProperty('92.0.4515.159');
    });
  });

  describe('removeInstalledVersion', () => {
    it('should remove a version from installed.json', async () => {
      const installedPath = join(testChvmDir, 'installed.json');
      fs.writeFileSync(installedPath, JSON.stringify({
        '92.0.4515.159': {
          revision: '882387',
          path: '/path/to/app',
          installedAt: '2025-10-01T00:00:00Z',
          size: 116242173
        }
      }, null, 2));
      
      const { removeInstalledVersion, readInstalledVersions } = await import('../../src/lib/storage.js');
      
      await removeInstalledVersion(testChvmDir, '92.0.4515.159');
      
      const installed = await readInstalledVersions(testChvmDir);
      
      expect(installed).not.toHaveProperty('92.0.4515.159');
    });

    it('should not fail if version does not exist', async () => {
      const { removeInstalledVersion } = await import('../../src/lib/storage.js');
      
      await expect(
        removeInstalledVersion(testChvmDir, 'nonexistent')
      ).resolves.not.toThrow();
    });
  });
});


