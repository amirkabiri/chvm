import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import { join } from 'path';

let testDir;

describe('Unit: lock module', () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-lock-test-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('acquireLock', () => {
    it('should acquire lock successfully', async () => {
      const { acquireLock, releaseLock } = await import('../../src/lib/lock.js');
      
      const release = await acquireLock(testDir);
      
      expect(release).toBeDefined();
      expect(typeof release).toBe('function');
      
      await release();
    });

    it('should create lock file', async () => {
      const { acquireLock, releaseLock } = await import('../../src/lib/lock.js');
      
      const release = await acquireLock(testDir);
      
      const lockFile = join(testDir, 'chvm.lock');
      expect(fs.existsSync(lockFile)).toBe(true);
      
      await release();
    });

    it('should prevent concurrent locks', async () => {
      const { acquireLock } = await import('../../src/lib/lock.js');
      
      const release1 = await acquireLock(testDir);
      
      // Second lock should wait or fail
      const lockPromise = acquireLock(testDir, { timeout: 1000 });
      
      await expect(lockPromise).rejects.toThrow(/lock|timeout/i);
      
      await release1();
    }, 10000);

    it('should release lock properly', async () => {
      const { acquireLock } = await import('../../src/lib/lock.js');
      
      const release1 = await acquireLock(testDir);
      await release1();
      
      // Should be able to acquire again after release
      const release2 = await acquireLock(testDir);
      expect(release2).toBeDefined();
      
      await release2();
    });

    it('should handle stale locks', async () => {
      const { acquireLock } = await import('../../src/lib/lock.js');
      
      // Create a stale lock file
      const lockFile = join(testDir, 'chvm.lock');
      fs.writeFileSync(lockFile, JSON.stringify({
        pid: 99999, // Non-existent process
        timestamp: Date.now() - 1000 * 60 * 60 // 1 hour ago
      }));
      
      // Should be able to acquire despite stale lock
      const release = await acquireLock(testDir, { staleTimeout: 30000 });
      
      expect(release).toBeDefined();
      
      await release();
    });
  });

  describe('withLock', () => {
    it('should execute function with lock', async () => {
      const { withLock } = await import('../../src/lib/lock.js');
      
      let executed = false;
      
      await withLock(testDir, async () => {
        executed = true;
      });
      
      expect(executed).toBe(true);
    });

    it('should release lock after execution', async () => {
      const { withLock, acquireLock } = await import('../../src/lib/lock.js');
      
      await withLock(testDir, async () => {
        // Do something
      });
      
      // Should be able to acquire lock again
      const release = await acquireLock(testDir);
      expect(release).toBeDefined();
      
      await release();
    });

    it('should release lock even on error', async () => {
      const { withLock, acquireLock } = await import('../../src/lib/lock.js');
      
      await expect(
        withLock(testDir, async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
      
      // Lock should be released
      const release = await acquireLock(testDir);
      expect(release).toBeDefined();
      
      await release();
    });

    it('should return function result', async () => {
      const { withLock } = await import('../../src/lib/lock.js');
      
      const result = await withLock(testDir, async () => {
        return 'success';
      });
      
      expect(result).toBe('success');
    });
  });

  describe('isLocked', () => {
    it('should return true when locked', async () => {
      const { acquireLock, isLocked } = await import('../../src/lib/lock.js');
      
      const release = await acquireLock(testDir);
      
      const locked = await isLocked(testDir);
      expect(locked).toBe(true);
      
      await release();
    });

    it('should return false when not locked', async () => {
      const { isLocked } = await import('../../src/lib/lock.js');
      
      const locked = await isLocked(testDir);
      expect(locked).toBe(false);
    });

    it('should detect stale locks correctly', async () => {
      const { isLocked } = await import('../../src/lib/lock.js');
      
      // Create a stale lock
      const lockFile = join(testDir, 'chvm.lock');
      fs.writeFileSync(lockFile, JSON.stringify({
        pid: 99999,
        timestamp: Date.now() - 1000 * 60 * 60
      }));
      
      const locked = await isLocked(testDir, { staleTimeout: 30000 });
      
      // Stale lock should be considered as not locked
      expect(locked).toBe(false);
    });
  });
});


