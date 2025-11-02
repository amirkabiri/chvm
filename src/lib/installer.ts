/**
 * Installer module - Atomic install with command-line unzip
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExtractProgress {
  extractedFiles: number;
}

export async function extractZip(
  zipPath: string,
  targetDir: string,
  onProgress?: (progress: ExtractProgress) => void
): Promise<void> {
  await fs.mkdir(targetDir, { recursive: true });

  try {
    // Use command-line unzip
    // -q: quiet mode
    // -d: extract to directory
    await execAsync(`unzip -q "${zipPath}" -d "${targetDir}"`);

    if (onProgress) {
      // After extraction, count the files
      const fileCount = await countFiles(targetDir);
      onProgress({ extractedFiles: fileCount });
    }
  } catch (error) {
    throw new Error(`Failed to extract zip: ${(error as Error).message}`);
  }
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;

  async function traverse(path: string): Promise<void> {
    try {
      const items = await fs.readdir(path);
      for (const item of items) {
        const fullPath = join(path, item);
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          await traverse(fullPath);
        } else {
          count++;
        }
      }
    } catch (err) {
      // Ignore errors
    }
  }

  await traverse(dir);
  return count;
}

export async function atomicInstall(
  installFn: (tmpDir: string) => Promise<string>,
  finalPath: string,
  chvmHome: string
): Promise<void> {
  const tmpDir = join(
    chvmHome,
    'tmp',
    `install-${randomBytes(8).toString('hex')}`
  );

  try {
    // Create temp directory
    await fs.mkdir(tmpDir, { recursive: true });

    // Run install function
    const installedPath = await installFn(tmpDir);

    // Move to final location atomically
    await moveDirectory(installedPath, finalPath);

    // Cleanup temp directory
    await cleanupTempDirectory(tmpDir);
  } catch (error) {
    // Cleanup on failure
    if (existsSync(tmpDir)) {
      await cleanupTempDirectory(tmpDir);
    }
    throw error;
  }
}

export async function verifyAppBundle(appPath: string): Promise<boolean> {
  if (!existsSync(appPath)) {
    return false;
  }

  // Check for required macOS app structure
  const contentsDir = join(appPath, 'Contents');
  const macOSDir = join(contentsDir, 'MacOS');

  if (!existsSync(contentsDir)) {
    return false;
  }

  if (!existsSync(macOSDir)) {
    return false;
  }

  // Fix executable permissions for all files in MacOS directory
  try {
    const files = await fs.readdir(macOSDir);
    for (const file of files) {
      const filePath = join(macOSDir, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        // Make executable: chmod +x
        await fs.chmod(filePath, 0o755);
      }
    }
  } catch (err) {
    // If we can't set permissions, continue anyway
  }

  return true;
}

export async function calculateDirectorySize(dirPath: string): Promise<number> {
  if (!existsSync(dirPath)) {
    throw new Error(`Directory does not exist: ${dirPath}`);
  }

  let totalSize = 0;

  async function traverse(path: string): Promise<void> {
    const stats = await fs.stat(path);

    if (stats.isDirectory()) {
      const files = await fs.readdir(path);
      for (const file of files) {
        await traverse(join(path, file));
      }
    } else {
      totalSize += stats.size;
    }
  }

  await traverse(dirPath);
  return totalSize;
}

export async function moveDirectory(
  source: string,
  dest: string
): Promise<void> {
  try {
    // Try atomic rename first
    await fs.rename(source, dest);
  } catch (error) {
    // If rename fails (cross-device), copy and delete
    await fs.cp(source, dest, { recursive: true });
    await fs.rm(source, { recursive: true, force: true });
  }
}

export async function cleanupTempDirectory(tmpDir: string): Promise<void> {
  if (existsSync(tmpDir)) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
