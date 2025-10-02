/**
 * Lock module - File locking for concurrent operations
 */

import lockfile from 'proper-lockfile';
import { join } from 'path';
import { existsSync } from 'fs';
import fs from 'fs/promises';

export async function acquireLock(chvmHome, options = {}) {
  const { timeout = 5000, staleTimeout = 60000 } = options;
  const lockFile = join(chvmHome, 'chvm.lock');
  
  // Ensure lock file exists
  if (!existsSync(lockFile)) {
    await fs.writeFile(lockFile, JSON.stringify({
      pid: process.pid,
      timestamp: Date.now()
    }), 'utf8');
  }

  try {
    const release = await lockfile.lock(lockFile, {
      retries: {
        retries: Math.floor(timeout / 100),
        minTimeout: 100,
        maxTimeout: 1000
      },
      stale: staleTimeout,
      realpath: false
    });

    return release;
  } catch (error) {
    throw new Error(`Failed to acquire lock: ${error.message}`);
  }
}

export async function releaseLock(release) {
  if (typeof release === 'function') {
    await release();
  }
}

export async function withLock(chvmHome, fn, options = {}) {
  const release = await acquireLock(chvmHome, options);
  
  try {
    const result = await fn();
    return result;
  } finally {
    await releaseLock(release);
  }
}

export async function isLocked(chvmHome, options = {}) {
  const { staleTimeout = 60000 } = options;
  const lockFile = join(chvmHome, 'chvm.lock');
  
  if (!existsSync(lockFile)) {
    return false;
  }

  try {
    const locked = await lockfile.check(lockFile, {
      stale: staleTimeout,
      realpath: false
    });
    
    return locked;
  } catch (error) {
    return false;
  }
}


