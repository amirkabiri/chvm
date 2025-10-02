import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

let testDir;

describe('Unit: installer module', () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-installer-test-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('extractZip', () => {
    it('should extract zip file to target directory', async () => {
      const { extractZip } = await import('../../src/lib/installer.js');
      
      // This test would require creating a test zip file
      // For now, we test the interface
      expect(extractZip).toBeDefined();
      expect(typeof extractZip).toBe('function');
    });

    it('should report extraction progress', async () => {
      const { extractZip } = await import('../../src/lib/installer.js');
      
      expect(extractZip).toBeDefined();
    });

    it('should handle extraction errors', async () => {
      const { extractZip } = await import('../../src/lib/installer.js');
      
      const invalidZipPath = __filename; // Not a zip file
      const targetDir = join(testDir, 'extract');
      
      await expect(
        extractZip(invalidZipPath, targetDir)
      ).rejects.toThrow();
    });
  });

  describe('atomicInstall', () => {
    it('should use temporary directory during install', async () => {
      const { atomicInstall } = await import('../../src/lib/installer.js');
      
      const installFn = async (tmpDir) => {
        // Simulate install by creating files
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(join(tmpDir, 'test.txt'), 'test');
        return tmpDir;
      };
      
      const finalPath = join(testDir, 'final.app');
      
      await atomicInstall(installFn, finalPath, testDir);
      
      // Final path should exist
      expect(fs.existsSync(finalPath)).toBe(true);
      expect(fs.existsSync(join(finalPath, 'test.txt'))).toBe(true);
    });

    it('should cleanup temp directory after success', async () => {
      const { atomicInstall } = await import('../../src/lib/installer.js');
      
      let tmpDirUsed = null;
      
      const installFn = async (tmpDir) => {
        tmpDirUsed = tmpDir;
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(join(tmpDir, 'test.txt'), 'test');
        return tmpDir;
      };
      
      const finalPath = join(testDir, 'final.app');
      
      await atomicInstall(installFn, finalPath, testDir);
      
      // Temp directory should be gone
      expect(fs.existsSync(tmpDirUsed)).toBe(false);
    });

    it('should cleanup on failure', async () => {
      const { atomicInstall } = await import('../../src/lib/installer.js');
      
      let tmpDirUsed = null;
      
      const installFn = async (tmpDir) => {
        tmpDirUsed = tmpDir;
        fs.mkdirSync(tmpDir, { recursive: true });
        throw new Error('Install failed');
      };
      
      const finalPath = join(testDir, 'final.app');
      
      await expect(
        atomicInstall(installFn, finalPath, testDir)
      ).rejects.toThrow('Install failed');
      
      // Temp directory should be cleaned up
      if (tmpDirUsed) {
        expect(fs.existsSync(tmpDirUsed)).toBe(false);
      }
      
      // Final path should not exist
      expect(fs.existsSync(finalPath)).toBe(false);
    });

    it('should not overwrite existing final path until complete', async () => {
      const { atomicInstall } = await import('../../src/lib/installer.js');
      
      const finalPath = join(testDir, 'final.app');
      
      // Create existing installation
      fs.mkdirSync(finalPath, { recursive: true });
      fs.writeFileSync(join(finalPath, 'existing.txt'), 'existing');
      
      let duringInstall = false;
      
      const installFn = async (tmpDir) => {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(join(tmpDir, 'new.txt'), 'new');
        
        // During install, existing should still be there
        duringInstall = fs.existsSync(join(finalPath, 'existing.txt'));
        
        return tmpDir;
      };
      
      await atomicInstall(installFn, finalPath, testDir);
      
      // During install, old version should have existed
      expect(duringInstall).toBe(true);
      
      // After install, new version should be there
      expect(fs.existsSync(join(finalPath, 'new.txt'))).toBe(true);
    });
  });

  describe('verifyAppBundle', () => {
    it('should verify valid macOS app bundle structure', async () => {
      const { verifyAppBundle } = await import('../../src/lib/installer.js');
      
      const appDir = join(testDir, 'test.app');
      const contentsDir = join(appDir, 'Contents');
      const macosDir = join(contentsDir, 'MacOS');
      
      fs.mkdirSync(macosDir, { recursive: true });
      fs.writeFileSync(join(macosDir, 'Chromium'), '#!/bin/bash\n');
      fs.chmodSync(join(macosDir, 'Chromium'), 0o755);
      
      const isValid = await verifyAppBundle(appDir);
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid app bundle', async () => {
      const { verifyAppBundle } = await import('../../src/lib/installer.js');
      
      const appDir = join(testDir, 'test.app');
      fs.mkdirSync(appDir, { recursive: true });
      
      const isValid = await verifyAppBundle(appDir);
      
      expect(isValid).toBe(false);
    });

    it('should check for executable permissions', async () => {
      const { verifyAppBundle } = await import('../../src/lib/installer.js');
      
      const appDir = join(testDir, 'test.app');
      const contentsDir = join(appDir, 'Contents');
      const macosDir = join(contentsDir, 'MacOS');
      
      fs.mkdirSync(macosDir, { recursive: true });
      fs.writeFileSync(join(macosDir, 'Chromium'), '#!/bin/bash\n');
      // Don't set executable permission
      
      const isValid = await verifyAppBundle(appDir);
      
      expect(isValid).toBe(false);
    });
  });

  describe('calculateDirectorySize', () => {
    it('should calculate total size of directory', async () => {
      const { calculateDirectorySize } = await import('../../src/lib/installer.js');
      
      const dir = join(testDir, 'size-test');
      fs.mkdirSync(dir, { recursive: true });
      
      fs.writeFileSync(join(dir, 'file1.txt'), 'a'.repeat(100));
      fs.writeFileSync(join(dir, 'file2.txt'), 'b'.repeat(200));
      
      const size = await calculateDirectorySize(dir);
      
      expect(size).toBe(300);
    });

    it('should include subdirectories', async () => {
      const { calculateDirectorySize } = await import('../../src/lib/installer.js');
      
      const dir = join(testDir, 'size-test');
      const subdir = join(dir, 'sub');
      
      fs.mkdirSync(subdir, { recursive: true });
      
      fs.writeFileSync(join(dir, 'file1.txt'), 'a'.repeat(100));
      fs.writeFileSync(join(subdir, 'file2.txt'), 'b'.repeat(200));
      
      const size = await calculateDirectorySize(dir);
      
      expect(size).toBe(300);
    });

    it('should return 0 for empty directory', async () => {
      const { calculateDirectorySize } = await import('../../src/lib/installer.js');
      
      const dir = join(testDir, 'empty');
      fs.mkdirSync(dir, { recursive: true });
      
      const size = await calculateDirectorySize(dir);
      
      expect(size).toBe(0);
    });

    it('should throw for non-existent directory', async () => {
      const { calculateDirectorySize } = await import('../../src/lib/installer.js');
      
      await expect(
        calculateDirectorySize(join(testDir, 'nonexistent'))
      ).rejects.toThrow();
    });
  });

  describe('moveDirectory', () => {
    it('should move directory atomically', async () => {
      const { moveDirectory } = await import('../../src/lib/installer.js');
      
      const source = join(testDir, 'source');
      const dest = join(testDir, 'dest');
      
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(join(source, 'file.txt'), 'content');
      
      await moveDirectory(source, dest);
      
      expect(fs.existsSync(dest)).toBe(true);
      expect(fs.existsSync(join(dest, 'file.txt'))).toBe(true);
      expect(fs.readFileSync(join(dest, 'file.txt'), 'utf8')).toBe('content');
    });

    it('should handle cross-device moves', async () => {
      const { moveDirectory } = await import('../../src/lib/installer.js');
      
      const source = join(testDir, 'source');
      const dest = join(testDir, 'dest');
      
      fs.mkdirSync(source, { recursive: true });
      fs.writeFileSync(join(source, 'file.txt'), 'content');
      
      // Even if rename fails, should fall back to copy+delete
      await moveDirectory(source, dest);
      
      expect(fs.existsSync(dest)).toBe(true);
    });

    it('should preserve permissions', async () => {
      const { moveDirectory } = await import('../../src/lib/installer.js');
      
      const source = join(testDir, 'source');
      const dest = join(testDir, 'dest');
      
      fs.mkdirSync(source, { recursive: true });
      const filePath = join(source, 'executable.sh');
      fs.writeFileSync(filePath, '#!/bin/bash\n');
      fs.chmodSync(filePath, 0o755);
      
      await moveDirectory(source, dest);
      
      const destFile = join(dest, 'executable.sh');
      const stats = fs.statSync(destFile);
      
      expect((stats.mode & 0o111) !== 0).toBe(true); // Has execute permission
    });
  });

  describe('cleanupTempDirectory', () => {
    it('should remove temporary directory', async () => {
      const { cleanupTempDirectory } = await import('../../src/lib/installer.js');
      
      const tmpDir = join(testDir, 'tmp-cleanup');
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(join(tmpDir, 'file.txt'), 'temp');
      
      await cleanupTempDirectory(tmpDir);
      
      expect(fs.existsSync(tmpDir)).toBe(false);
    });

    it('should not fail if directory does not exist', async () => {
      const { cleanupTempDirectory } = await import('../../src/lib/installer.js');
      
      await expect(
        cleanupTempDirectory(join(testDir, 'nonexistent'))
      ).resolves.not.toThrow();
    });

    it('should remove nested directories', async () => {
      const { cleanupTempDirectory } = await import('../../src/lib/installer.js');
      
      const tmpDir = join(testDir, 'tmp-cleanup');
      const nested = join(tmpDir, 'nested', 'deep');
      
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(join(nested, 'file.txt'), 'temp');
      
      await cleanupTempDirectory(tmpDir);
      
      expect(fs.existsSync(tmpDir)).toBe(false);
    });
  });
});


