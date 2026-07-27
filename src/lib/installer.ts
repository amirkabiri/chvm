import fs from 'fs/promises';
import AdmZip from 'adm-zip';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';
import { isWindows, isMacOS, isLinux } from './platform-check.js';

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
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    let extractedFiles = 0;

    for (const entry of entries) {
      const targetPath = join(targetDir, entry.entryName);

      if (entry.isDirectory) {
        await fs.mkdir(targetPath, { recursive: true });
      } else {
        // Ensure parent directory exists
        await fs.mkdir(dirname(targetPath), { recursive: true });

        // Extract file
        const content = entry.getData();
        await fs.writeFile(targetPath, content);

        // Preserve Unix file permissions from zip entry
        const unixMode = (entry.attr >> 16) & 0xffff;
        if (unixMode !== 0) {
          await fs.chmod(targetPath, unixMode);
        }

        extractedFiles++;

        if (onProgress) {
          onProgress({
            extractedFiles,
          });
        }
      }
    }

    // Final progress callback if no files were extracted but callback exists
    if (onProgress && extractedFiles === 0) {
      onProgress({ extractedFiles: 0 });
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
    let installedPath = await installFn(tmpDir);

    // Normalize install path on Windows / Linux
    if (isWindows()) {
      installedPath = resolveWindowsAppPath(installedPath);
    } else if (isLinux()) {
      installedPath = resolveLinuxAppPath(installedPath);
    }

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
  if (isMacOS()) {
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
      console.log('Error setting permissions:', err);
    }

    return true;
  }

  if (isWindows()) {
    const directExe = join(appPath, 'chrome.exe');
    const headlessExe = join(appPath, 'chrome-headless-shell.exe');
    const nestedExe = join(appPath, 'chrome-win', 'chrome.exe');

    if (existsSync(directExe)) return true;
    if (existsSync(headlessExe)) return true;
    if (existsSync(nestedExe)) return true;

    return false;
  }

  if (isLinux()) {
    const directBin = join(appPath, 'chrome');
    const nestedBin = join(appPath, 'chrome-linux', 'chrome');

    if (existsSync(directBin)) return true;
    if (existsSync(nestedBin)) return true;

    return false;
  }

  return false;
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

export function resolveWindowsAppPath(installDir: string): string {
  const directExe = join(installDir, 'chrome.exe');
  const nestedExe = join(installDir, 'chrome-win', 'chrome.exe');

  if (existsSync(directExe)) return installDir;
  if (existsSync(nestedExe)) return join(installDir, 'chrome-win');

  return installDir;
}

export function resolveLinuxAppPath(installDir: string): string {
  const directBin = join(installDir, 'chrome');
  const nestedBin = join(installDir, 'chrome-linux', 'chrome');

  if (existsSync(directBin)) return installDir;
  if (existsSync(nestedBin)) return join(installDir, 'chrome-linux');

  return installDir;
}
